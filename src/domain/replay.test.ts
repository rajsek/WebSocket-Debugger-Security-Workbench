import {
  createReplayQueue,
  createReplayRun,
  createSavedMessageSetFromControlledFrames,
  createSavedMessageSetFromDiscoveredFrames,
  createSavedSocketRecipeFromDiscovery,
  createSavedSocketRecipeFromTarget,
  editReplayQueueItem,
  replayArtifactSchemaVersion,
  replaySourceMismatchReason,
  validateReplayArtifact,
} from './replay';
import { initialTargetContext } from './reducer';
import type { DiscoveredSocket, FrameRecord } from './types';

describe('replay library domain', () => {
  const now = '2026-05-16T10:00:00.000Z';
  const socket: DiscoveredSocket = {
    requestId: '100.1',
    url: 'wss://example.com/socket',
    lifecycle: 'active',
    createdAt: now,
    lastActivityAt: now,
    handshake: {
      observed: true,
      requestHeaders: [{ name: 'Authorization', value: '[redacted]', redacted: true }],
      responseHeaders: [{ name: 'sec-websocket-protocol', value: 'graphql-transport-ws', redacted: false }],
      status: 101,
      statusText: 'Switching Protocols',
      protocol: 'graphql-transport-ws',
      extensions: '',
      requestTime: now,
      responseTime: now,
    },
    frameCounts: { outbound: 2, inbound: 1 },
    firstOutboundFrames: [
      {
        id: 'text-1',
        requestId: '100.1',
        direction: 'outbound',
        timestamp: now,
        opcode: 1,
        payloadKind: 'text',
        body: '{"token":"secret","subscribe":"orders"}',
        preview: '{"token":"[redacted]","subscribe":"orders"}',
        payloadLength: 39,
        redacted: true,
      },
      {
        id: 'binary-1',
        requestId: '100.1',
        direction: 'outbound',
        timestamp: now,
        opcode: 2,
        payloadKind: 'binary',
        body: '[binary frame: 13 B] hex 00 01 02',
        preview: '[binary frame: 13 B] hex 00 01 02',
        payloadLength: 13,
        redacted: false,
      },
    ],
    error: null,
    closedAt: null,
  };

  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) });
  });

  it('creates versioned socket recipes from discovery and current targets', () => {
    const discovered = createSavedSocketRecipeFromDiscovery({
      socket,
      target: { ...initialTargetContext, tabOrigin: 'https://example.com', engine: 'page' },
      now,
    });
    const current = createSavedSocketRecipeFromTarget({
      target: { ...initialTargetContext, socketUrl: 'wss://api.example.net/ws', subprotocol: 'graphql-transport-ws' },
      now,
    });

    expect(discovered.schemaVersion).toBe(replayArtifactSchemaVersion);
    expect(discovered.kind).toBe('saved-socket-recipe');
    expect(discovered.sourceRequestId).toBe('100.1');
    expect(discovered.subprotocol).toBe('graphql-transport-ws');
    expect(current.socketUrl).toBe('wss://api.example.net/ws');
  });

  it('creates message sets from outbound text frames only', () => {
    const discovered = createSavedMessageSetFromDiscoveredFrames({ socket, selectedFrameIds: ['text-1', 'binary-1'], now });
    const controlledFrames: FrameRecord[] = [
      { id: 'in-1', direction: 'inbound', timestamp: now, url: socket.url, body: '{"server":true}', metadata: {} },
      { id: 'out-1', direction: 'outbound', timestamp: now, url: socket.url, body: '{"client":true}', metadata: {} },
      { id: 'out-bin-1', direction: 'outbound', timestamp: now, url: socket.url, body: '[binary frame: 2 B] hex 00 01', metadata: { payloadKind: 'binary' } },
    ];
    const controlled = createSavedMessageSetFromControlledFrames({
      frames: controlledFrames,
      target: { ...initialTargetContext, socketUrl: socket.url },
      selectedFrameIds: ['in-1', 'out-1', 'out-bin-1'],
      now,
    });

    expect(discovered.messages.map((message) => message.body)).toEqual(['{"token":"secret","subscribe":"orders"}']);
    expect(discovered.messages[0].preview).toContain('[redacted]');
    expect(controlled.messages.map((message) => message.body)).toEqual(['{"client":true}']);
  });

  it('copies messages into an editable queue with mismatch detection', () => {
    const recipe = createSavedSocketRecipeFromDiscovery({ socket, target: initialTargetContext, now });
    const messageSet = createSavedMessageSetFromDiscoveredFrames({ socket, selectedFrameIds: ['text-1'], now });
    const mismatchedRecipe = { ...recipe, socketUrl: 'wss://other.example/socket' };
    const queue = createReplayQueue({ socketRecipe: recipe, messageSet, now });
    const edited = editReplayQueueItem(queue, queue.items[0].id, '{"changed":true}', now);

    expect(queue.sourceMismatch).toBe(false);
    expect(replaySourceMismatchReason(mismatchedRecipe, messageSet)).toContain('other.example');
    expect(edited.items[0].originalBody).toBe('{"token":"secret","subscribe":"orders"}');
    expect(edited.items[0].editedAt).toBe(now);
  });

  it('creates replay runs and rejects unsupported artifact versions', () => {
    const recipe = createSavedSocketRecipeFromDiscovery({ socket, target: initialTargetContext, now });
    const messageSet = createSavedMessageSetFromDiscoveredFrames({ socket, selectedFrameIds: ['text-1'], now });
    const queue = createReplayQueue({ socketRecipe: recipe, messageSet, now });
    const run = createReplayRun(queue, now);

    expect(run.status).toBe('running');
    expect(run.unsentMessageIds).toEqual(queue.items.map((item) => item.id));
    expect(() => validateReplayArtifact({ ...messageSet, schemaVersion: 2 })).toThrow(/Unsupported replay artifact version/);
  });
});

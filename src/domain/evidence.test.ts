import {
  createBootstrapReplayEvidenceRecord,
  createObservedSocketEvidenceRecord,
  createRecipeImportEvidenceRecord,
  createReplayRunEvidenceRecord,
  exportEvidenceMarkdown,
  redactSensitive,
} from './evidence';
import type { ConnectionRecipe, DiscoveredSocket, ReplayQueue, ReplayRun, TargetContext, WebSocketCaptureSnapshot } from './types';

describe('evidence redaction', () => {
  it('redacts sensitive fields by default', () => {
    expect(redactSensitive('Authorization: Bearer abc.def.ghi')).toBe('[redacted]');
    expect(redactSensitive('{"token":"secret-value","message":"ok"}')).toContain('[redacted]');
    expect(redactSensitive('Active tests require explicit authorization confirmation.')).toBe('Active tests require explicit authorization confirmation.');
  });

  it('exports observed socket and recipe evidence with traceability and redacted previews', () => {
    const target: TargetContext = {
      tabId: 7,
      tabOrigin: 'https://example.com',
      socketUrl: 'wss://example.com/socket',
      subprotocol: '',
      engine: 'page',
      authAssumption: 'unknown',
      executionContext: 'page-context',
      debuggerCaptureEnabled: false,
      pageCspBypassEnabled: false,
      pageCspHeaderStripEnabled: false,
      pageCspMetaProbeInjected: false,
      pageSessionStale: false,
    };
    const socket: DiscoveredSocket = {
      requestId: '100.1',
      url: 'wss://example.com/socket',
      lifecycle: 'active',
      createdAt: '2026-05-15T12:00:00.000Z',
      lastActivityAt: '2026-05-15T12:00:01.000Z',
      handshake: {
        observed: true,
        requestHeaders: [{ name: 'Authorization', value: '[redacted]', redacted: true }],
        responseHeaders: [],
        status: 101,
        statusText: 'Switching Protocols',
        protocol: '',
        extensions: '',
        requestTime: '2026-05-15T12:00:00.000Z',
        responseTime: '2026-05-15T12:00:00.100Z',
      },
      frameCounts: { outbound: 1, inbound: 2 },
      firstOutboundFrames: [
        {
          id: 'boot-1',
          requestId: '100.1',
          direction: 'outbound',
          timestamp: '2026-05-15T12:00:01.000Z',
          opcode: 1,
          payloadKind: 'text',
          body: '{"token":"secret-value","subscribe":"orders"}',
          preview: '{"token":"[redacted]","subscribe":"orders"}',
          payloadLength: 45,
          redacted: true,
        },
      ],
      error: null,
      closedAt: null,
    };
    const snapshot: WebSocketCaptureSnapshot = {
      tabId: 7,
      status: 'listening',
      startedAt: '2026-05-15T12:00:00.000Z',
      stoppedAt: null,
      message: '1 discovered socket.',
      detachReason: null,
      sockets: [socket],
    };
    const recipe: ConnectionRecipe = {
      id: 'recipe-1',
      sourceRequestId: '100.1',
      socketUrl: socket.url,
      subprotocol: '',
      recommendedEngine: 'page',
      selectedEngine: 'page',
      recommendationReason: 'Socket host matches the selected page origin.',
      tabOrigin: target.tabOrigin,
      createdAt: '2026-05-15T12:00:02.000Z',
      handshake: socket.handshake,
      bootstrapFrames: socket.firstOutboundFrames,
    };

    const markdown = exportEvidenceMarkdown([
      createObservedSocketEvidenceRecord({ socket, snapshot, target }),
      createRecipeImportEvidenceRecord(recipe, 'Imported with selected bootstrap frames queued for explicit replay.'),
      createBootstrapReplayEvidenceRecord(recipe),
    ]);

    expect(markdown).toContain('Kind: observed-runtime-traffic');
    expect(markdown).toContain('Request id: 100.1');
    expect(markdown).toContain('Frames: 1 outbound / 2 inbound');
    expect(markdown).toContain('Kind: recipe-import');
    expect(markdown).toContain('Kind: bootstrap-replay');
    expect(markdown).toContain('[redacted]');
    expect(markdown).not.toContain('secret-value');
  });

  it('exports replay-run evidence as a bounded transcript without raw payloads or response claims', () => {
    const queue: ReplayQueue = {
      id: 'queue-1',
      socketRecipe: {
        schemaVersion: 1,
        kind: 'saved-socket-recipe',
        id: 'socket-1',
        name: 'Socket',
        createdAt: '2026-05-16T10:00:00.000Z',
        updatedAt: '2026-05-16T10:00:00.000Z',
        socketUrl: 'wss://example.com/socket',
        subprotocol: '',
        selectedEngine: 'extension',
        recommendedEngine: 'extension',
        tabOrigin: 'https://example.com',
        authAssumption: 'unknown',
        sourceType: 'controlled',
        sourceRequestId: null,
        handshake: {
          observed: false,
          requestHeaders: [],
          responseHeaders: [],
          status: null,
          statusText: '',
          protocol: '',
          extensions: '',
          requestTime: null,
          responseTime: null,
        },
      },
      messageSet: {
        schemaVersion: 1,
        kind: 'saved-message-set',
        id: 'messages-1',
        name: 'Messages',
        createdAt: '2026-05-16T10:00:00.000Z',
        updatedAt: '2026-05-16T10:00:00.000Z',
        sourceType: 'controlled',
        socketUrl: 'wss://example.com/socket',
        tabOrigin: 'https://example.com',
        sourceRequestId: null,
        messages: [],
      },
      items: [
        {
          id: 'message-1',
          body: '{"token":"secret-value","op":"subscribe"}',
          preview: '{"token":"[redacted]","op":"subscribe"}',
          payloadLength: 41,
          sourceFrameId: 'frame-1',
          sourceFrameHash: 'abc123',
          sourceTimestamp: '2026-05-16T10:00:01.000Z',
          createdAt: '2026-05-16T10:00:01.000Z',
          updatedAt: '2026-05-16T10:00:02.000Z',
          status: 'sent',
          selected: true,
          sentAt: '2026-05-16T10:00:03.000Z',
          editedAt: '2026-05-16T10:00:02.000Z',
          originalBody: '{"op":"subscribe"}',
          originalPreview: '{"op":"subscribe"}',
        },
      ],
      sourceMismatch: true,
      mismatchReason: 'different socket',
      createdAt: '2026-05-16T10:00:00.000Z',
      updatedAt: '2026-05-16T10:00:03.000Z',
    };
    const run: ReplayRun = {
      id: 'run-1',
      queueId: queue.id,
      socketRecipeId: 'socket-1',
      messageSetId: 'messages-1',
      socketUrl: 'wss://example.com/socket',
      selectedEngine: 'extension',
      sourceMismatch: true,
      startedAt: '2026-05-16T10:00:03.000Z',
      endedAt: '2026-05-16T10:00:04.000Z',
      status: 'partial',
      sentMessageIds: ['message-1'],
      unsentMessageIds: ['message-2'],
      inboundFrameIds: ['in-1'],
    };

    const markdown = exportEvidenceMarkdown([
      createReplayRunEvidenceRecord({ queue, run, inboundTranscriptPreviews: ['{"token":"server-secret","event":"later"}'] }),
    ]);

    expect(markdown).toContain('Kind: replay-run');
    expect(markdown).toContain('Status: partial');
    expect(markdown).toContain('Source mismatch: yes');
    expect(markdown).toContain('Later inbound transcript');
    expect(markdown).not.toContain('secret-value');
    expect(markdown).not.toContain('server-secret');
    expect(markdown).not.toMatch(/request\/response/i);
  });
});

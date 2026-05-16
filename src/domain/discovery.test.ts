import {
  createConnectionRecipe,
  createObservedFrameSummary,
  parseWebSocketCdpEvent,
  redactHandshakeHeaders,
  reduceDiscoveredSockets,
} from './discovery';
import { initialTargetContext } from './reducer';
import type { DiscoveredSocket, WebSocketCaptureEvent } from './types';

describe('WebSocket discovery domain', () => {
  const now = '2026-05-15T12:00:00.000Z';

  it('parses CDP WebSocket events and keeps requestId as socket identity', () => {
    const created = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const sent = parseWebSocketCdpEvent(
      'Network.webSocketFrameSent',
      {
        requestId: '100.1',
        timestamp: 1,
        response: {
          opcode: 1,
          payloadData: '{"subscribe":"orders"}',
        },
      },
      now,
    );
    const closed = parseWebSocketCdpEvent('Network.webSocketClosed', { requestId: '100.1', timestamp: 2 }, now);

    let sockets: DiscoveredSocket[] = [];
    sockets = reduceDiscoveredSockets(sockets, created as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, sent as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, closed as WebSocketCaptureEvent);

    expect(sockets).toHaveLength(1);
    expect(sockets[0].requestId).toBe('100.1');
    expect(sockets[0].url).toBe('wss://app.example/ws');
    expect(sockets[0].frameCounts.outbound).toBe(1);
    expect(sockets[0].firstOutboundFrames[0].preview).toBe('{"subscribe":"orders"}');
    expect(sockets[0].lifecycle).toBe('closed');
  });

  it('lists repeated URLs as distinct sockets when request ids differ', () => {
    const first = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const second = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.2', url: 'wss://app.example/ws' }, now);

    let sockets: DiscoveredSocket[] = [];
    sockets = reduceDiscoveredSockets(sockets, first as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, second as WebSocketCaptureEvent);

    expect(sockets.map((socket) => socket.requestId)).toEqual(['100.1', '100.2']);
    expect(new Set(sockets.map((socket) => socket.url))).toEqual(new Set(['wss://app.example/ws']));
  });

  it('marks handshake metadata as not observed when CDP handshake events are absent', () => {
    const created = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const sockets = reduceDiscoveredSockets([], created as WebSocketCaptureEvent);

    expect(sockets[0].handshake.observed).toBe(false);
    expect(sockets[0].handshake.requestHeaders).toEqual([]);
    expect(sockets[0].handshake.responseHeaders).toEqual([]);
  });

  it('redacts sensitive handshake headers and frame previews without rewriting the replay body', () => {
    const headers = redactHandshakeHeaders({
      Authorization: 'Bearer abc.def.ghi',
      Cookie: 'sid=secret',
      Origin: 'https://app.example',
    });
    const frame = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'outbound',
      timestamp: now,
      opcode: 1,
      payloadData: '{"token":"secret-value","message":"ok"}',
    });

    expect(headers.find((header) => header.name === 'Authorization')?.value).toBe('[redacted]');
    expect(headers.find((header) => header.name === 'Cookie')?.value).toBe('[redacted]');
    expect(headers.find((header) => header.name === 'Origin')?.value).toBe('https://app.example');
    expect(frame.preview).toContain('[redacted]');
    expect(frame.body).toBe('{"token":"secret-value","message":"ok"}');
  });

  it('summarizes binary CDP frames without claiming plaintext', () => {
    const frame = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'inbound',
      timestamp: now,
      opcode: 2,
      payloadData: 'AAEC/f7/',
    });

    expect(frame.payloadKind).toBe('binary');
    expect(frame.payloadLength).toBe(6);
    expect(frame.body).toBe('[binary frame: 6 B] hex 00 01 02 fd fe ff');
    expect(frame.preview).toBe(frame.body);
    expect(frame.redacted).toBe(false);
  });

  it('creates recipes with page-engine recommendation, overrides, and selected bootstrap frames only', () => {
    const created = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const firstFrame = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'outbound',
      timestamp: now,
      opcode: 1,
      payloadData: '{"hello":1}',
    });
    const secondFrame = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'outbound',
      timestamp: now,
      opcode: 1,
      payloadData: '{"hello":2}',
    });
    let sockets = reduceDiscoveredSockets([], created as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, { type: 'frame', frame: firstFrame });
    sockets = reduceDiscoveredSockets(sockets, { type: 'frame', frame: secondFrame });

    const recipe = createConnectionRecipe({
      socket: sockets[0],
      target: { ...initialTargetContext, tabOrigin: 'https://app.example' },
      selectedFrameIds: [secondFrame.id],
      engineOverride: 'extension',
      now,
    });

    expect(recipe.sourceRequestId).toBe('100.1');
    expect(recipe.socketUrl).toBe('wss://app.example/ws');
    expect(recipe.recommendedEngine).toBe('page');
    expect(recipe.selectedEngine).toBe('extension');
    expect(recipe.bootstrapFrames.map((frame) => frame.body)).toEqual(['{"hello":2}']);
  });
});

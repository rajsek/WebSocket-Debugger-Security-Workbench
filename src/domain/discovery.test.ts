import {
  createConnectionRecipe,
  createObservedFrameSummary,
  handshakeHeaderUsage,
  observedHandshakeExtensions,
  observedHandshakeHeader,
  observedHandshakeSubprotocol,
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
    expect(sockets[0].bootstrapTranscript.map((frame) => frame.direction)).toEqual(['outbound']);
    expect(sockets[0].firstOutboundFrames[0].preview).toBe('{"subscribe":"orders"}');
    expect(sockets[0].lifecycle).toBe('closed');
  });

  it('keeps inbound and outbound bootstrap transcript rows in observed order', () => {
    const created = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const inbound = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'inbound',
      timestamp: '2026-05-15T12:00:00.500Z',
      opcode: 1,
      payloadData: '{"server":"ready"}',
    });
    const outbound = createObservedFrameSummary({
      requestId: '100.1',
      direction: 'outbound',
      timestamp: '2026-05-15T12:00:01.000Z',
      opcode: 1,
      payloadData: '{"subscribe":"orders"}',
    });

    let sockets: DiscoveredSocket[] = [];
    sockets = reduceDiscoveredSockets(sockets, created as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, { type: 'frame', frame: inbound });
    sockets = reduceDiscoveredSockets(sockets, { type: 'frame', frame: outbound });

    expect(sockets[0].frameCounts).toEqual({ inbound: 1, outbound: 1 });
    expect(sockets[0].bootstrapTranscript.map((frame) => frame.direction)).toEqual(['inbound', 'outbound']);
    expect(sockets[0].bootstrapTranscript.map((frame) => frame.role)).toEqual(['wait-checkpoint', 'sendable']);
    expect(sockets[0].firstOutboundFrames.map((frame) => frame.direction)).toEqual(['outbound']);
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
    expect(recipe.bootstrapTranscript.map((frame) => frame.direction)).toEqual(['outbound']);
    expect(recipe.bootstrapFrames.map((frame) => frame.body)).toEqual(['{"hello":2}']);
  });

  it('loads importable subprotocols from the request header when the response protocol is absent', () => {
    const created = parseWebSocketCdpEvent('Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' }, now);
    const request = parseWebSocketCdpEvent(
      'Network.webSocketWillSendHandshakeRequest',
      {
        requestId: '100.1',
        wallTime: 1,
        request: {
          headers: {
            'Sec-WebSocket-Protocol': 'graphql-transport-ws',
          },
        },
      },
      now,
    );
    const response = parseWebSocketCdpEvent(
      'Network.webSocketHandshakeResponseReceived',
      {
        requestId: '100.1',
        timestamp: 2,
        response: {
          status: 101,
          statusText: 'Switching Protocols',
          headers: {},
        },
      },
      now,
    );

    let sockets = reduceDiscoveredSockets([], created as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, request as WebSocketCaptureEvent);
    sockets = reduceDiscoveredSockets(sockets, response as WebSocketCaptureEvent);

    const recipe = createConnectionRecipe({
      socket: sockets[0],
      target: { ...initialTargetContext, tabOrigin: 'https://app.example' },
      now,
    });

    expect(sockets[0].handshake.protocol).toBe('');
    expect(recipe.subprotocol).toBe('graphql-transport-ws');
    expect(observedHandshakeSubprotocol(sockets[0].handshake)).toBe('graphql-transport-ws');
  });

  it('maps reusable WebSocket handshake fields from protocol-specific headers while keeping all headers available as context', () => {
    const handshake = {
      observed: true,
      requestHeaders: [
        { name: 'Sec-WebSocket-Protocol', value: 'graphql-transport-ws, graphql-ws', redacted: false },
        { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate; client_max_window_bits', redacted: false },
        { name: 'Origin', value: 'https://app.example', redacted: false },
      ],
      responseHeaders: [
        { name: 'Sec-WebSocket-Extensions', value: 'permessage-deflate', redacted: false },
      ],
      status: 101,
      statusText: 'Switching Protocols',
      protocol: '',
      extensions: '',
      requestTime: now,
      responseTime: now,
    };

    expect(observedHandshakeSubprotocol(handshake)).toBe('graphql-transport-ws, graphql-ws');
    expect(observedHandshakeExtensions(handshake)).toBe('permessage-deflate');
    expect(observedHandshakeHeader(handshake, 'Origin')).toBe('https://app.example');
  });

  it('classifies observed handshake headers by replay behavior', () => {
    expect(handshakeHeaderUsage('Sec-WebSocket-Protocol')).toMatchObject({
      role: 'constructor-subprotocol',
      label: 'mapped to Subprotocol',
    });
    expect(handshakeHeaderUsage('Sec-WebSocket-Extensions')).toMatchObject({
      role: 'browser-managed',
      label: 'browser-managed',
    });
    expect(handshakeHeaderUsage('Sec-WebSocket-Accept')).toMatchObject({
      role: 'browser-managed',
      label: 'browser-managed',
    });
    expect(handshakeHeaderUsage('Origin')).toMatchObject({
      role: 'browser-managed',
      label: 'browser-managed',
    });
    expect(handshakeHeaderUsage('Cookie')).toMatchObject({
      role: 'browser-managed',
      label: 'browser-managed',
    });
    expect(handshakeHeaderUsage('Authorization')).toMatchObject({
      role: 'evidence-only',
      label: 'evidence only',
    });
    expect(handshakeHeaderUsage('X-Trace-Id')).toMatchObject({
      role: 'evidence-only',
      label: 'evidence only',
    });
  });
});

import { redactSensitive } from './evidence';
import { previewBody } from './frameUtils';
import { summarizeCdpBinaryPayload } from './binaryPayload';
import { appendBootstrapTranscriptRow, selectedTranscriptRows } from './transcript';
import type {
  BootstrapTranscriptRow,
  ConnectionRecipe,
  DiscoveredSocket,
  EngineMode,
  FrameDirection,
  HandshakeSummary,
  ObservedFrameSummary,
  RedactedHeader,
  TargetContext,
  WebSocketCaptureEvent,
  WebSocketCaptureSnapshot,
  WebSocketCaptureStatus,
} from './types';

const outboundBootstrapFrameLimit = 5;
const bootstrapTranscriptFrameLimit = 12;
const sensitiveHeaderNames = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
]);

const browserManagedHandshakeHeaderNames = new Set([
  'accept-encoding',
  'accept-language',
  'cache-control',
  'connection',
  'cookie',
  'host',
  'origin',
  'pragma',
  'sec-websocket-accept',
  'sec-websocket-extensions',
  'sec-websocket-key',
  'sec-websocket-version',
  'set-cookie',
  'upgrade',
  'user-agent',
]);

export type HandshakeHeaderUsageRole = 'constructor-subprotocol' | 'browser-managed' | 'evidence-only';

export interface HandshakeHeaderUsage {
  role: HandshakeHeaderUsageRole;
  label: string;
  description: string;
}

export function createEmptyCaptureSnapshot(tabId: number, status: WebSocketCaptureStatus = 'idle', now: string | null = null): WebSocketCaptureSnapshot {
  return {
    tabId,
    status,
    startedAt: now,
    stoppedAt: null,
    message: '',
    detachReason: null,
    sockets: [],
  };
}

export function createEmptyHandshakeSummary(): HandshakeSummary {
  return {
    observed: false,
    requestHeaders: [],
    responseHeaders: [],
    status: null,
    statusText: '',
    protocol: '',
    extensions: '',
    requestTime: null,
    responseTime: null,
  };
}

export function parseWebSocketCdpEvent(method: string, params: unknown, now = new Date().toISOString()): WebSocketCaptureEvent | null {
  if (!method.startsWith('Network.webSocket')) return null;
  const record = requireRecord(params, `${method} params`);

  if (method === 'Network.webSocketCreated') {
    return {
      type: 'created',
      requestId: requireString(record.requestId, `${method}.requestId`),
      url: requireString(record.url, `${method}.url`),
      timestamp: now,
    };
  }

  if (method === 'Network.webSocketWillSendHandshakeRequest') {
    const request = optionalRecord(record.request);
    return {
      type: 'handshake-request',
      requestId: requireString(record.requestId, `${method}.requestId`),
      timestamp: cdpTimestamp(record.wallTime, now),
      headers: redactHandshakeHeaders(optionalRecord(request?.headers)),
    };
  }

  if (method === 'Network.webSocketHandshakeResponseReceived') {
    const response = optionalRecord(record.response);
    const headers = redactHandshakeHeaders(optionalRecord(response?.headers));
    return {
      type: 'handshake-response',
      requestId: requireString(record.requestId, `${method}.requestId`),
      timestamp: cdpTimestamp(record.timestamp, now),
      status: optionalNumber(response?.status),
      statusText: typeof response?.statusText === 'string' ? response.statusText : '',
      headers,
      protocol: headerValue(headers, 'sec-websocket-protocol'),
      extensions: headerValue(headers, 'sec-websocket-extensions'),
    };
  }

  if (method === 'Network.webSocketFrameSent' || method === 'Network.webSocketFrameReceived') {
    const response = requireRecord(record.response, `${method}.response`);
    const direction: FrameDirection = method === 'Network.webSocketFrameSent' ? 'outbound' : 'inbound';
    return {
      type: 'frame',
      frame: createObservedFrameSummary({
        requestId: requireString(record.requestId, `${method}.requestId`),
        direction,
        timestamp: cdpTimestamp(record.timestamp, now),
        opcode: optionalNumber(response.opcode),
        payloadData: typeof response.payloadData === 'string' ? response.payloadData : '',
      }),
    };
  }

  if (method === 'Network.webSocketFrameError') {
    return {
      type: 'error',
      requestId: requireString(record.requestId, `${method}.requestId`),
      timestamp: cdpTimestamp(record.timestamp, now),
      message: requireString(record.errorMessage, `${method}.errorMessage`),
    };
  }

  if (method === 'Network.webSocketClosed') {
    return {
      type: 'closed',
      requestId: requireString(record.requestId, `${method}.requestId`),
      timestamp: cdpTimestamp(record.timestamp, now),
    };
  }

  return null;
}

export function reduceDiscoveredSockets(sockets: DiscoveredSocket[], event: WebSocketCaptureEvent): DiscoveredSocket[] {
  if (event.type === 'created') {
    const created = createDiscoveredSocket(event.requestId, event.url, event.timestamp);
    const existing = sockets.find((socket) => socket.requestId === event.requestId);
    if (!existing) return [...sockets, created];
    return sockets.map((socket) =>
      socket.requestId === event.requestId
        ? { ...socket, url: event.url, lifecycle: 'created', createdAt: event.timestamp, lastActivityAt: event.timestamp }
        : socket,
    );
  }

  return sockets.map((socket) => {
    if (socket.requestId !== requestIdForEvent(event)) return socket;

    if (event.type === 'handshake-request') {
      return {
        ...socket,
        lifecycle: 'handshaking',
        lastActivityAt: event.timestamp,
        handshake: {
          ...socket.handshake,
          observed: true,
          requestHeaders: event.headers,
          requestTime: event.timestamp,
        },
      };
    }

    if (event.type === 'handshake-response') {
      return {
        ...socket,
        lifecycle: 'open',
        lastActivityAt: event.timestamp,
        handshake: {
          ...socket.handshake,
          observed: true,
          responseHeaders: event.headers,
          status: event.status,
          statusText: event.statusText,
          protocol: event.protocol,
          extensions: event.extensions,
          responseTime: event.timestamp,
        },
      };
    }

    if (event.type === 'frame') {
      const counts = {
        inbound: socket.frameCounts.inbound + (event.frame.direction === 'inbound' ? 1 : 0),
        outbound: socket.frameCounts.outbound + (event.frame.direction === 'outbound' ? 1 : 0),
      };
      const firstOutboundFrames =
        event.frame.direction === 'outbound' && socket.firstOutboundFrames.length < outboundBootstrapFrameLimit
          ? [...socket.firstOutboundFrames, event.frame]
          : socket.firstOutboundFrames;
      return {
        ...socket,
        lifecycle: 'active',
        lastActivityAt: event.frame.timestamp,
        frameCounts: counts,
        bootstrapTranscript: appendBootstrapTranscriptRow(socket.bootstrapTranscript ?? [], event.frame, bootstrapTranscriptFrameLimit),
        firstOutboundFrames,
      };
    }

    if (event.type === 'error') {
      return {
        ...socket,
        lifecycle: 'errored',
        lastActivityAt: event.timestamp,
        error: event.message,
      };
    }

    return {
      ...socket,
      lifecycle: 'closed',
      lastActivityAt: event.timestamp,
      closedAt: event.timestamp,
    };
  });
}

export function createObservedFrameSummary(params: {
  requestId: string;
  direction: FrameDirection;
  timestamp: string;
  opcode: number | null;
  payloadData: string;
}): ObservedFrameSummary {
  const isBinary = params.opcode === 2;
  const binarySummary = isBinary ? summarizeCdpBinaryPayload(params.payloadData) : null;
  const body = binarySummary?.body ?? params.payloadData;
  const redactedPreview = binarySummary?.body ?? previewBody(redactSensitive(params.payloadData), 180);
  return {
    id: `${params.requestId}:${params.direction}:${params.timestamp}:${params.opcode ?? 'unknown'}:${stableTextHash(params.payloadData)}`,
    requestId: params.requestId,
    direction: params.direction,
    timestamp: params.timestamp,
    opcode: params.opcode,
    payloadKind: isBinary ? 'binary' : 'text',
    body,
    preview: redactedPreview,
    payloadLength: binarySummary?.payloadLength ?? new TextEncoder().encode(params.payloadData).byteLength,
    redacted: !isBinary && redactedPreview !== previewBody(params.payloadData, 180),
  };
}

export function redactHandshakeHeaders(headers: Record<string, unknown> | null | undefined): RedactedHeader[] {
  if (!headers) return [];
  return Object.entries(headers).map(([name, rawValue]) => {
    const normalized = name.toLowerCase();
    const value = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean' ? String(rawValue) : '';
    const redacted = sensitiveHeaderNames.has(normalized) || normalized.includes('token') || normalized.includes('secret');
    return {
      name,
      value: redacted ? '[redacted]' : redactSensitive(value),
      redacted,
    };
  });
}

export function createConnectionRecipe(params: {
  socket: DiscoveredSocket;
  target: TargetContext;
  selectedFrameIds?: string[];
  engineOverride?: EngineMode;
  now?: string;
}): ConnectionRecipe {
  const recommendation = recommendEngine(params.socket.url, params.target.tabOrigin);
  const selectedFrameIds = new Set(params.selectedFrameIds ?? []);
  const bootstrapTranscript = selectedTranscriptRows(bootstrapTranscriptForSocket(params.socket), params.selectedFrameIds ?? []);
  const bootstrapFrames = bootstrapTranscript.filter((frame) => frame.direction === 'outbound' && frame.payloadKind === 'text');
  return {
    id: crypto.randomUUID(),
    sourceRequestId: params.socket.requestId,
    socketUrl: params.socket.url,
    subprotocol: observedHandshakeSubprotocol(params.socket.handshake),
    recommendedEngine: recommendation.engine,
    selectedEngine: params.engineOverride ?? recommendation.engine,
    recommendationReason: recommendation.reason,
    tabOrigin: params.target.tabOrigin,
    createdAt: params.now ?? new Date().toISOString(),
    handshake: params.socket.handshake,
    bootstrapTranscript,
    bootstrapFrames,
  };
}

export function observedHandshakeSubprotocol(handshake: HandshakeSummary): string {
  return handshake.protocol || observedHandshakeHeader(handshake, 'sec-websocket-protocol');
}

export function observedHandshakeExtensions(handshake: HandshakeSummary): string {
  return handshake.extensions || observedHandshakeHeader(handshake, 'sec-websocket-extensions');
}

export function observedHandshakeHeader(handshake: HandshakeSummary, name: string): string {
  return headerValue(handshake.responseHeaders, name) || headerValue(handshake.requestHeaders, name);
}

export function handshakeHeaderUsage(name: string): HandshakeHeaderUsage {
  const normalized = name.toLowerCase();
  if (normalized === 'sec-websocket-protocol') {
    return {
      role: 'constructor-subprotocol',
      label: 'mapped to Subprotocol',
      description: 'Applied as the WebSocket constructor protocol argument when a controlled socket is created.',
    };
  }

  if (browserManagedHandshakeHeaderNames.has(normalized) || normalized.startsWith('sec-websocket-')) {
    return {
      role: 'browser-managed',
      label: 'browser-managed',
      description: 'Observed only. Browser WebSocket creates or negotiates this header; JavaScript cannot set it directly.',
    };
  }

  return {
    role: 'evidence-only',
    label: 'evidence only',
    description: 'Observed context only. Browser WebSocket cannot replay arbitrary request headers.',
  };
}

export function bootstrapTranscriptForSocket(socket: DiscoveredSocket): BootstrapTranscriptRow[] {
  if ((socket.bootstrapTranscript ?? []).length > 0) return socket.bootstrapTranscript;
  return socket.firstOutboundFrames.map((frame) => ({
    ...frame,
    sourceFrameId: frame.id,
    sourceFrameHash: stableTextHash(frame.body),
    role: frame.payloadKind === 'text' ? 'sendable' : 'observed-only',
    checkpointMode: 'exact',
  }));
}

export function recommendEngine(socketUrl: string, tabOrigin: string): { engine: EngineMode; reason: string } {
  if (tabOrigin !== 'unknown') {
    try {
      const socketHost = new URL(socketUrl).host;
      const tabHost = new URL(tabOrigin).host;
      if (socketHost === tabHost) {
        return {
          engine: 'page',
          reason: 'Socket host matches the selected page origin; browser-managed cookies, Origin, CSP, and page context may affect reproduction.',
        };
      }
    } catch {
      return { engine: 'extension', reason: 'Socket URL could not be compared with the selected page origin.' };
    }
  }

  return {
    engine: 'extension',
    reason: 'Socket host was not tied to the selected page origin; Extension engine keeps the replay isolated.',
  };
}

function createDiscoveredSocket(requestId: string, url: string, timestamp: string): DiscoveredSocket {
  return {
    requestId,
    url,
    lifecycle: 'created',
    createdAt: timestamp,
    lastActivityAt: timestamp,
    handshake: createEmptyHandshakeSummary(),
    frameCounts: {
      inbound: 0,
      outbound: 0,
    },
    bootstrapTranscript: [],
    firstOutboundFrames: [],
    error: null,
    closedAt: null,
  };
}

function requestIdForEvent(event: Exclude<WebSocketCaptureEvent, { type: 'created' }>): string {
  return event.type === 'frame' ? event.frame.requestId : event.requestId;
}

function headerValue(headers: RedactedHeader[], name: string): string {
  const normalizedName = name.toLowerCase();
  return headers.find((header) => header.name.toLowerCase() === normalizedName)?.value ?? '';
}

function cdpTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value > 1_000_000_000) return new Date(value * 1000).toISOString();
  return fallback;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stableTextHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

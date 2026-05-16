import { createEmptyHandshakeSummary } from './discovery';
import { redactSensitive } from './evidence';
import { isReplayableTextFrame, previewBody } from './frameUtils';
import type {
  DiscoveredSocket,
  FrameRecord,
  ReplayQueue,
  ReplayQueueItem,
  ReplayRun,
  SavedMessageSet,
  SavedReplayArtifact,
  SavedReplayMessage,
  SavedSocketRecipe,
  TargetContext,
} from './types';

export const replayArtifactSchemaVersion = 1;
export const maxReplayArtifacts = 50;
export const maxReplayMessagesPerSet = 50;
export const maxReplayArtifactBytes = 200_000;

export function createSavedSocketRecipeFromDiscovery(params: {
  socket: DiscoveredSocket;
  target: TargetContext;
  name?: string;
  now?: string;
}): SavedSocketRecipe {
  const now = params.now ?? new Date().toISOString();
  const subprotocol = params.socket.handshake.protocol;
  return {
    schemaVersion: replayArtifactSchemaVersion,
    kind: 'saved-socket-recipe',
    id: crypto.randomUUID(),
    name: params.name ?? recipeName(params.socket.url),
    createdAt: now,
    updatedAt: now,
    socketUrl: params.socket.url,
    subprotocol,
    selectedEngine: params.target.engine,
    recommendedEngine: params.target.engine,
    tabOrigin: params.target.tabOrigin,
    authAssumption: subprotocol ? 'page-session' : params.target.authAssumption,
    sourceType: 'discovery',
    sourceRequestId: params.socket.requestId,
    handshake: params.socket.handshake,
  };
}

export function createSavedSocketRecipeFromTarget(params: {
  target: TargetContext;
  name?: string;
  now?: string;
}): SavedSocketRecipe {
  const now = params.now ?? new Date().toISOString();
  return {
    schemaVersion: replayArtifactSchemaVersion,
    kind: 'saved-socket-recipe',
    id: crypto.randomUUID(),
    name: params.name ?? recipeName(params.target.socketUrl),
    createdAt: now,
    updatedAt: now,
    socketUrl: params.target.socketUrl,
    subprotocol: params.target.subprotocol,
    selectedEngine: params.target.engine,
    recommendedEngine: params.target.engine,
    tabOrigin: params.target.tabOrigin,
    authAssumption: params.target.authAssumption,
    sourceType: 'controlled',
    sourceRequestId: null,
    handshake: createEmptyHandshakeSummary(),
  };
}

export function createSavedMessageSetFromDiscoveredFrames(params: {
  socket: DiscoveredSocket;
  selectedFrameIds: string[];
  name?: string;
  now?: string;
}): SavedMessageSet {
  const now = params.now ?? new Date().toISOString();
  const selected = new Set(params.selectedFrameIds);
  return {
    schemaVersion: replayArtifactSchemaVersion,
    kind: 'saved-message-set',
    id: crypto.randomUUID(),
    name: params.name ?? messageSetName(params.socket.url),
    createdAt: now,
    updatedAt: now,
    sourceType: 'discovery',
    socketUrl: params.socket.url,
    tabOrigin: 'unknown',
    sourceRequestId: params.socket.requestId,
    messages: params.socket.firstOutboundFrames
      .filter((frame) => frame.payloadKind === 'text' && frame.direction === 'outbound' && selected.has(frame.id))
      .slice(0, maxReplayMessagesPerSet)
      .map((frame) =>
        createSavedReplayMessage({
          body: frame.body,
          sourceFrameId: frame.id,
          sourceTimestamp: frame.timestamp,
          now,
        }),
      ),
  };
}

export function createSavedMessageSetFromControlledFrames(params: {
  frames: FrameRecord[];
  target: TargetContext;
  selectedFrameIds?: string[];
  name?: string;
  now?: string;
}): SavedMessageSet {
  const now = params.now ?? new Date().toISOString();
  const selected = params.selectedFrameIds ? new Set(params.selectedFrameIds) : null;
  return {
    schemaVersion: replayArtifactSchemaVersion,
    kind: 'saved-message-set',
    id: crypto.randomUUID(),
    name: params.name ?? messageSetName(params.target.socketUrl),
    createdAt: now,
    updatedAt: now,
    sourceType: 'controlled',
    socketUrl: params.target.socketUrl,
    tabOrigin: params.target.tabOrigin,
    sourceRequestId: null,
    messages: params.frames
      .filter((frame) => frame.direction === 'outbound' && isReplayableTextFrame(frame) && (!selected || selected.has(frame.id)))
      .slice(0, maxReplayMessagesPerSet)
      .map((frame) =>
        createSavedReplayMessage({
          body: frame.body,
          sourceFrameId: frame.id,
          sourceTimestamp: frame.timestamp,
          now,
        }),
      ),
  };
}

export function createReplayQueue(params: {
  socketRecipe: SavedSocketRecipe;
  messageSet: SavedMessageSet;
  now?: string;
}): ReplayQueue {
  const now = params.now ?? new Date().toISOString();
  const mismatchReason = replaySourceMismatchReason(params.socketRecipe, params.messageSet);
  return {
    id: crypto.randomUUID(),
    socketRecipe: params.socketRecipe,
    messageSet: params.messageSet,
    sourceMismatch: mismatchReason !== null,
    mismatchReason,
    createdAt: now,
    updatedAt: now,
    items: params.messageSet.messages.map((message) => createQueueItem(message)),
  };
}

export function editReplayQueueItem(queue: ReplayQueue, itemId: string, body: string, now = new Date().toISOString()): ReplayQueue {
  return {
    ...queue,
    updatedAt: now,
    items: queue.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            body,
            preview: previewReplayBody(body),
            payloadLength: body.length,
            editedAt: now,
            updatedAt: now,
            status: item.status === 'sent' ? item.status : 'queued',
          }
        : item,
    ),
  };
}

export function createReplayRun(queue: ReplayQueue, now = new Date().toISOString()): ReplayRun {
  return {
    id: crypto.randomUUID(),
    queueId: queue.id,
    socketRecipeId: queue.socketRecipe.id,
    messageSetId: queue.messageSet.id,
    socketUrl: queue.socketRecipe.socketUrl,
    selectedEngine: queue.socketRecipe.selectedEngine,
    sourceMismatch: queue.sourceMismatch,
    startedAt: now,
    endedAt: null,
    status: 'running',
    sentMessageIds: [],
    unsentMessageIds: queue.items.filter((item) => item.status !== 'sent').map((item) => item.id),
    inboundFrameIds: [],
  };
}

export function replaySourceMismatchReason(socketRecipe: SavedSocketRecipe, messageSet: SavedMessageSet): string | null {
  if (socketRecipe.socketUrl !== messageSet.socketUrl) {
    return `Message set was captured from ${messageSet.socketUrl}, not ${socketRecipe.socketUrl}.`;
  }
  if (socketRecipe.sourceRequestId && messageSet.sourceRequestId && socketRecipe.sourceRequestId !== messageSet.sourceRequestId) {
    return `Message set source request ${messageSet.sourceRequestId} differs from socket recipe request ${socketRecipe.sourceRequestId}.`;
  }
  return null;
}

export function validateReplayArtifact(value: unknown): SavedReplayArtifact {
  const record = requireRecord(value, 'Replay artifact');
  if (record.schemaVersion !== replayArtifactSchemaVersion) {
    throw new Error('Unsupported replay artifact version.');
  }
  if (record.kind === 'saved-socket-recipe') return validateSocketRecipe(record);
  if (record.kind === 'saved-message-set') return validateMessageSet(record);
  throw new Error('Unsupported replay artifact kind.');
}

export function validateReplayArtifacts(value: unknown): SavedReplayArtifact[] {
  if (!Array.isArray(value)) throw new Error('Replay import must be an artifact array.');
  if (value.length > maxReplayArtifacts) throw new Error('Replay import exceeds artifact limit.');
  return value.map(validateReplayArtifact);
}

export function assertReplayArtifactSize(artifact: SavedReplayArtifact): void {
  const size = new Blob([JSON.stringify(artifact)]).size;
  if (size > maxReplayArtifactBytes) {
    throw new Error('Replay artifact exceeds the v1 size limit.');
  }
  if (artifact.kind === 'saved-message-set' && artifact.messages.length > maxReplayMessagesPerSet) {
    throw new Error('Replay message set exceeds the v1 message limit.');
  }
}

function createSavedReplayMessage(params: {
  body: string;
  sourceFrameId: string | null;
  sourceTimestamp: string | null;
  now: string;
}): SavedReplayMessage {
  return {
    id: crypto.randomUUID(),
    body: params.body,
    preview: previewReplayBody(params.body),
    payloadLength: params.body.length,
    sourceFrameId: params.sourceFrameId,
    sourceFrameHash: stablePayloadHash(params.body),
    sourceTimestamp: params.sourceTimestamp,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function createQueueItem(message: SavedReplayMessage): ReplayQueueItem {
  return {
    ...message,
    status: 'queued',
    selected: true,
    sentAt: null,
    editedAt: null,
    originalBody: message.body,
    originalPreview: message.preview,
  };
}

function validateSocketRecipe(record: Record<string, unknown>): SavedSocketRecipe {
  requireString(record.id, 'Socket recipe id');
  requireString(record.name, 'Socket recipe name');
  requireString(record.socketUrl, 'Socket recipe URL');
  requireString(record.createdAt, 'Socket recipe createdAt');
  requireString(record.updatedAt, 'Socket recipe updatedAt');
  if (record.selectedEngine !== 'extension' && record.selectedEngine !== 'page') throw new Error('Socket recipe selected engine is invalid.');
  if (record.recommendedEngine !== 'extension' && record.recommendedEngine !== 'page') throw new Error('Socket recipe recommended engine is invalid.');
  if (typeof record.subprotocol !== 'string') throw new Error('Socket recipe subprotocol must be a string.');
  if (typeof record.sourceRequestId !== 'string' && record.sourceRequestId !== null) throw new Error('Socket recipe source request id is invalid.');
  if (!isHandshake(record.handshake)) throw new Error('Socket recipe handshake is invalid.');
  return record as unknown as SavedSocketRecipe;
}

function validateMessageSet(record: Record<string, unknown>): SavedMessageSet {
  requireString(record.id, 'Message set id');
  requireString(record.name, 'Message set name');
  requireString(record.socketUrl, 'Message set URL');
  requireString(record.createdAt, 'Message set createdAt');
  requireString(record.updatedAt, 'Message set updatedAt');
  if (typeof record.sourceRequestId !== 'string' && record.sourceRequestId !== null) throw new Error('Message set source request id is invalid.');
  if (!Array.isArray(record.messages)) throw new Error('Message set messages must be an array.');
  if (record.messages.length > maxReplayMessagesPerSet) throw new Error('Message set exceeds the v1 message limit.');
  record.messages.forEach(validateReplayMessage);
  return record as unknown as SavedMessageSet;
}

function validateReplayMessage(value: unknown): void {
  const record = requireRecord(value, 'Replay message');
  requireString(record.id, 'Replay message id');
  requireString(record.body, 'Replay message body');
  requireString(record.preview, 'Replay message preview');
  requireString(record.sourceFrameHash, 'Replay message source hash');
  requireString(record.createdAt, 'Replay message createdAt');
  requireString(record.updatedAt, 'Replay message updatedAt');
  if (typeof record.payloadLength !== 'number') throw new Error('Replay message payload length is invalid.');
  if (typeof record.sourceFrameId !== 'string' && record.sourceFrameId !== null) throw new Error('Replay message source frame id is invalid.');
  if (typeof record.sourceTimestamp !== 'string' && record.sourceTimestamp !== null) throw new Error('Replay message source timestamp is invalid.');
}

function isHandshake(value: unknown): boolean {
  const record = value as Record<string, unknown>;
  return typeof value === 'object' && value !== null && typeof record.observed === 'boolean' && Array.isArray(record.requestHeaders) && Array.isArray(record.responseHeaders);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`);
  return value;
}

function previewReplayBody(body: string): string {
  return previewBody(redactSensitive(body), 180);
}

function stablePayloadHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function recipeName(socketUrl: string): string {
  return socketUrl ? `Socket ${socketUrl}` : 'Socket recipe';
}

function messageSetName(socketUrl: string): string {
  return socketUrl ? `Messages ${socketUrl}` : 'Message set';
}

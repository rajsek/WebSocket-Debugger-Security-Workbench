import { previewBody } from './frameUtils';
import { observedHandshakeExtensions, observedHandshakeSubprotocol } from './discovery';
import type {
  ConnectionRecipe,
  DiscoveredSocket,
  EvidenceRecord,
  HandshakeSummary,
  ObservedSocketEvidenceRecord,
  RecipeImportEvidenceRecord,
  ReplayQueue,
  ReplayRun,
  ReplayRunEvidenceRecord,
  SecurityRunRequest,
  TargetContext,
  TestResultRecord,
  WebSocketCaptureSnapshot,
} from './types';

const sensitivePatterns = [
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /(["']?(authorization|cookie|token|password|secret)["']?\s*[:=]\s*)["']?[^"',\s}]+["']?/gi,
  /(["']?(jwt|session)[a-z0-9_-]*["']?\s*[:=]\s*)["']?[^"',\s}]+["']?/gi,
];

export function redactSensitive(value: string): string {
  return sensitivePatterns.reduce((current, pattern) => current.replace(pattern, '[redacted]'), value);
}

export async function hashPayload(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createEvidenceRecord(
  request: SecurityRunRequest,
  status: TestResultRecord['status'],
  response: string,
): Promise<TestResultRecord> {
  return {
    kind: 'security-test',
    id: crypto.randomUUID(),
    testId: request.test.id,
    targetOrigin: request.target.tabOrigin,
    socketUrl: request.target.socketUrl,
    timestamp: new Date().toISOString(),
    engine: request.target.engine,
    status,
    payloadHash: await hashPayload(request.payload),
    payloadPreview: previewBody(redactSensitive(request.payload)),
    responsePreview: previewBody(redactSensitive(response)),
    note: redactSensitive(request.note),
  };
}

export function createObservedSocketEvidenceRecord(params: {
  socket: DiscoveredSocket;
  snapshot: WebSocketCaptureSnapshot;
  target: TargetContext;
}): ObservedSocketEvidenceRecord {
  return {
    kind: 'observed-socket',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    targetOrigin: params.target.tabOrigin,
    socketUrl: params.socket.url,
    sourceRequestId: params.socket.requestId,
    handshake: params.socket.handshake,
    frameCounts: params.socket.frameCounts,
    firstOutboundPreviews: params.socket.firstOutboundFrames.map((frame) => frame.preview),
    captureStartedAt: params.snapshot.startedAt,
    captureStoppedAt: params.snapshot.stoppedAt,
  };
}

export function createRecipeImportEvidenceRecord(recipe: ConnectionRecipe, note: string): RecipeImportEvidenceRecord {
  return {
    kind: 'recipe-import',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    targetOrigin: recipe.tabOrigin,
    socketUrl: recipe.socketUrl,
    sourceRequestId: recipe.sourceRequestId,
    selectedEngine: recipe.selectedEngine,
    bootstrapFramePreviews: recipe.bootstrapFrames.map((frame) => frame.preview),
    transcriptFramePreviews: (recipe.bootstrapTranscript ?? recipe.bootstrapFrames).map((frame) => frame.preview),
    note,
  };
}

export function createReplayRunEvidenceRecord(params: {
  queue: ReplayQueue;
  run: ReplayRun;
  inboundTranscriptPreviews: string[];
}): ReplayRunEvidenceRecord {
  const sentItems = params.queue.items.filter((item) => params.run.sentMessageIds.includes(item.id));
  const skippedRows = params.queue.items.filter((item) => item.status === 'skipped');
  const removedRows = params.queue.items.filter((item) => item.status === 'removed');
  return {
    kind: 'replay-run',
    id: crypto.randomUUID(),
    replayRunId: params.run.id,
    timestamp: params.run.startedAt,
    endedAt: params.run.endedAt,
    targetOrigin: params.queue.socketRecipe.tabOrigin,
    socketUrl: params.run.socketUrl,
    selectedEngine: params.run.selectedEngine,
    status: params.run.status,
    sourceArtifactIds: [params.queue.socketRecipe.id, params.queue.messageSet.id],
    sourceMismatch: params.queue.sourceMismatch,
    messagePreviews: sentItems.map((item) => previewBody(redactSensitive(item.body))),
    messageHashes: sentItems.map((item) => item.sourceFrameHash),
    editedMessageCount: sentItems.filter((item) => item.editedAt !== null).length,
    sentMessageCount: params.run.sentMessageIds.length,
    unsentMessageCount: params.run.unsentMessageIds.length,
    skippedRowCount: skippedRows.length,
    removedRowCount: removedRows.length,
    checkpointOutcomes: params.run.checkpointOutcomes ?? [],
    inboundTranscriptPreviews: params.inboundTranscriptPreviews.map((body) => previewBody(redactSensitive(body))),
  };
}

export function exportEvidenceMarkdown(records: EvidenceRecord[]): string {
  const lines = ['# WebSocket Security Evidence', ''];
  for (const record of records) {
    if (record.kind === 'security-test') {
      lines.push(`## ${record.testId}`);
      lines.push(`- Kind: security-test`);
      lines.push(`- Time: ${record.timestamp}`);
      lines.push(`- Target: ${record.targetOrigin}`);
      lines.push(`- Socket: ${record.socketUrl}`);
      lines.push(`- Engine: ${record.engine}`);
      lines.push(`- Status: ${record.status}`);
      lines.push(`- Payload SHA-256: ${record.payloadHash}`);
      lines.push(`- Payload preview: ${record.payloadPreview}`);
      lines.push(`- Response preview: ${record.responsePreview}`);
      if (record.note) lines.push(`- Note: ${record.note}`);
      lines.push('');
      continue;
    }

    if (record.kind === 'observed-socket') {
      lines.push(`## Observed socket ${record.sourceRequestId}`);
      lines.push(`- Kind: observed-runtime-traffic`);
      lines.push(`- Time: ${record.timestamp}`);
      lines.push(`- Target: ${record.targetOrigin}`);
      lines.push(`- Socket: ${record.socketUrl}`);
      lines.push(`- Request id: ${record.sourceRequestId}`);
      lines.push(`- Capture started: ${record.captureStartedAt ?? 'unknown'}`);
      lines.push(`- Capture stopped: ${record.captureStoppedAt ?? 'active or unknown'}`);
      lines.push(`- Frames: ${record.frameCounts.outbound} outbound / ${record.frameCounts.inbound} inbound`);
      lines.push(`- Handshake: ${record.handshake.observed ? handshakeLine(record.handshake) : 'not observed'}`);
      if (record.firstOutboundPreviews.length > 0) {
        lines.push(`- First outbound previews: ${record.firstOutboundPreviews.join(' | ')}`);
      }
      lines.push('');
      continue;
    }

    if (record.kind === 'recipe-import') {
      lines.push(`## Recipe import ${record.sourceRequestId}`);
      lines.push(`- Kind: recipe-import`);
      lines.push(`- Time: ${record.timestamp}`);
      lines.push(`- Target: ${record.targetOrigin}`);
      lines.push(`- Socket: ${record.socketUrl}`);
      lines.push(`- Request id: ${record.sourceRequestId}`);
      lines.push(`- Engine: ${record.selectedEngine}`);
      lines.push(`- Bootstrap previews: ${record.bootstrapFramePreviews.length > 0 ? record.bootstrapFramePreviews.join(' | ') : 'none selected'}`);
      if ((record.transcriptFramePreviews ?? []).length > 0) lines.push(`- Transcript previews: ${record.transcriptFramePreviews.join(' | ')}`);
      lines.push(`- Note: ${record.note}`);
      lines.push('');
      continue;
    }

    lines.push(`## Replay run ${record.replayRunId}`);
    lines.push(`- Kind: replay-run`);
    lines.push(`- Time: ${record.timestamp}`);
    lines.push(`- Ended: ${record.endedAt ?? 'active or unknown'}`);
    lines.push(`- Target: ${record.targetOrigin}`);
    lines.push(`- Socket: ${record.socketUrl}`);
    lines.push(`- Engine: ${record.selectedEngine}`);
    lines.push(`- Status: ${record.status}`);
    lines.push(`- Source artifacts: ${record.sourceArtifactIds.join(', ')}`);
    lines.push(`- Source mismatch: ${record.sourceMismatch ? 'yes' : 'no'}`);
    lines.push(`- Sent messages: ${record.sentMessageCount}`);
    lines.push(`- Unsent messages: ${record.unsentMessageCount}`);
    lines.push(`- Skipped rows: ${record.skippedRowCount ?? 0}`);
    lines.push(`- Removed rows: ${record.removedRowCount ?? 0}`);
    lines.push(`- Edited messages: ${record.editedMessageCount}`);
    lines.push(`- Message hashes: ${record.messageHashes.join(', ') || 'none'}`);
    lines.push(`- Message previews: ${record.messagePreviews.join(' | ') || 'none'}`);
    lines.push(`- Checkpoint outcomes: ${(record.checkpointOutcomes ?? []).map((outcome) => `${outcome.status}:${outcome.rowId}`).join(', ') || 'none'}`);
    lines.push(`- Later inbound transcript: ${record.inboundTranscriptPreviews.join(' | ') || 'none observed'}`);
    lines.push('');
  }
  return lines.join('\n');
}

function handshakeLine(handshake: HandshakeSummary): string {
  const status = handshake.status === null ? 'status unknown' : `${handshake.status} ${handshake.statusText}`.trim();
  const subprotocol = observedHandshakeSubprotocol(handshake);
  const extension = observedHandshakeExtensions(handshake);
  const protocol = subprotocol ? ` protocol=${subprotocol}` : '';
  const extensions = extension ? ` extensions=${extension}` : '';
  return `${status}${protocol}${extensions}`;
}

import type {
  BootstrapTranscriptRow,
  FrameRecord,
  ObservedFrameSummary,
  ReplayCheckpointMode,
  ReplayQueueItem,
  ReplayQueueItemRole,
} from './types';

export type OrderedReplayStep =
  | { type: 'send'; item: ReplayQueueItem }
  | { type: 'wait'; item: ReplayQueueItem }
  | { type: 'blocked'; reason: string }
  | { type: 'complete' };

export function createBootstrapTranscriptRow(frame: ObservedFrameSummary): BootstrapTranscriptRow {
  return {
    ...frame,
    sourceFrameId: frame.id,
    sourceFrameHash: stablePayloadHash(frame.body),
    role: transcriptRole(frame),
    checkpointMode: 'exact',
  };
}

export function appendBootstrapTranscriptRow(
  rows: BootstrapTranscriptRow[],
  frame: ObservedFrameSummary,
  limit: number,
): BootstrapTranscriptRow[] {
  if (rows.length >= limit) return rows;
  return [...rows, createBootstrapTranscriptRow(frame)];
}

export function selectedTranscriptRows(rows: BootstrapTranscriptRow[], selectedIds: string[]): BootstrapTranscriptRow[] {
  const selected = new Set(selectedIds);
  return rows.filter((row) => selected.has(row.id));
}

export function isSendableReplayItem(item: ReplayQueueItem): boolean {
  return item.role === 'sendable' && item.direction === 'outbound' && item.payloadKind === 'text';
}

export function isActiveReplayItem(item: ReplayQueueItem): boolean {
  return item.status !== 'sent' && item.status !== 'matched' && item.status !== 'skipped' && item.status !== 'removed' && item.status !== 'timeout';
}

export function nextOrderedReplayStep(params: {
  items: ReplayQueueItem[];
  selectedIds: string[];
  withWaits: boolean;
}): OrderedReplayStep {
  const selectedIds = new Set(params.selectedIds);
  const next = params.items.find((item) => selectedIds.has(item.id) && isActiveReplayItem(item));
  if (!next) return { type: 'complete' };
  if (next.status === 'waiting') return { type: 'blocked', reason: `Waiting for checkpoint ${next.id}.` };
  if (isSendableReplayItem(next)) return { type: 'send', item: next };
  if (next.role === 'wait-checkpoint' && params.withWaits) return { type: 'wait', item: next };
  return { type: 'blocked', reason: `Row ${next.id} is not replayable in this mode.` };
}

export function nextSendableReplayItem(items: ReplayQueueItem[], selectedIds: string[]): ReplayQueueItem | null {
  const selected = new Set(selectedIds);
  return items.find((item) => selected.has(item.id) && isActiveReplayItem(item) && isSendableReplayItem(item)) ?? null;
}

export function selectedSendableReplayItems(items: ReplayQueueItem[], selectedIds: string[]): ReplayQueueItem[] {
  const selected = new Set(selectedIds);
  return items.filter((item) => selected.has(item.id) && isActiveReplayItem(item) && isSendableReplayItem(item));
}

export function transcriptCheckpointMatches(item: ReplayQueueItem, frame: FrameRecord): boolean {
  if (item.role !== 'wait-checkpoint' || frame.direction !== 'inbound') return false;
  if (item.checkpointMode === 'next-inbound') return true;
  return stablePayloadHash(frame.body) === item.sourceFrameHash;
}

function transcriptRole(frame: ObservedFrameSummary): ReplayQueueItemRole {
  if (frame.direction === 'outbound' && frame.payloadKind === 'text') return 'sendable';
  if (frame.direction === 'inbound' && frame.payloadKind === 'text') return 'wait-checkpoint';
  return 'observed-only';
}

function stablePayloadHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

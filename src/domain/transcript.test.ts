import {
  createBootstrapTranscriptRow,
  nextOrderedReplayStep,
  selectedSendableReplayItems,
  transcriptCheckpointMatches,
} from './transcript';
import { createObservedFrameSummary } from './discovery';
import type { FrameRecord, ReplayQueueItem } from './types';

describe('ordered bootstrap transcript domain', () => {
  const now = '2026-05-21T07:00:00.000Z';

  it('classifies inbound rows as checkpoints and outbound text rows as sendable', () => {
    const inbound = createBootstrapTranscriptRow(createObservedFrameSummary({
      requestId: '100.1',
      direction: 'inbound',
      timestamp: now,
      opcode: 1,
      payloadData: '{"server":"ready"}',
    }));
    const outbound = createBootstrapTranscriptRow(createObservedFrameSummary({
      requestId: '100.1',
      direction: 'outbound',
      timestamp: now,
      opcode: 1,
      payloadData: '{"subscribe":"orders"}',
    }));

    expect(inbound.role).toBe('wait-checkpoint');
    expect(outbound.role).toBe('sendable');
  });

  it('plans ordered replay with waits without treating inbound rows as sendable', () => {
    const inbound = replayItem({ id: 'in-1', direction: 'inbound', role: 'wait-checkpoint', body: '{"server":"ready"}' });
    const outbound = replayItem({ id: 'out-1', direction: 'outbound', role: 'sendable', body: '{"subscribe":"orders"}' });

    expect(nextOrderedReplayStep({ items: [inbound, outbound], selectedIds: ['in-1', 'out-1'], withWaits: true })).toEqual({
      type: 'wait',
      item: inbound,
    });
    expect(nextOrderedReplayStep({ items: [{ ...inbound, status: 'matched' }, outbound], selectedIds: ['in-1', 'out-1'], withWaits: true })).toEqual({
      type: 'send',
      item: outbound,
    });
    expect(selectedSendableReplayItems([inbound, outbound], ['in-1', 'out-1'])).toEqual([outbound]);
  });

  it('matches checkpoints by exact payload hash or next inbound mode', () => {
    const exact = replayItem({ id: 'in-1', direction: 'inbound', role: 'wait-checkpoint', body: '{"server":"ready"}' });
    const nextInbound = { ...exact, checkpointMode: 'next-inbound' as const, sourceFrameHash: 'different' };
    const inboundFrame: FrameRecord = {
      id: 'live-in-1',
      direction: 'inbound',
      timestamp: now,
      url: 'wss://example.com/socket',
      body: '{"server":"ready"}',
      metadata: {},
    };

    expect(transcriptCheckpointMatches(exact, inboundFrame)).toBe(true);
    expect(transcriptCheckpointMatches({ ...exact, sourceFrameHash: 'different' }, inboundFrame)).toBe(false);
    expect(transcriptCheckpointMatches(nextInbound, inboundFrame)).toBe(true);
    expect(transcriptCheckpointMatches(nextInbound, { ...inboundFrame, direction: 'outbound' })).toBe(false);
  });
});

function replayItem(params: {
  id: string;
  direction: 'inbound' | 'outbound';
  role: ReplayQueueItem['role'];
  body: string;
}): ReplayQueueItem {
  return {
    id: params.id,
    body: params.body,
    preview: params.body,
    payloadLength: params.body.length,
    sourceFrameId: params.id,
    sourceFrameHash: stablePayloadHash(params.body),
    sourceRequestId: '100.1',
    sourceTimestamp: '2026-05-21T07:00:00.000Z',
    direction: params.direction,
    payloadKind: 'text',
    role: params.role,
    checkpointMode: 'exact',
    createdAt: '2026-05-21T07:00:00.000Z',
    updatedAt: '2026-05-21T07:00:00.000Z',
    status: 'queued',
    selected: true,
    sentAt: null,
    editedAt: null,
    originalBody: params.body,
    originalPreview: params.body,
    matchedFrameId: null,
    timeoutAt: null,
  };
}

function stablePayloadHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

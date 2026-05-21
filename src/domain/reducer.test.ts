import { socketReducer, initialSocketState, initialTargetContext } from './reducer';
import { createReplayQueue, createSavedMessageSetFromControlledFrames, createSavedSocketRecipeFromTarget } from './replay';
import type { FrameRecord } from './types';

describe('socket reducer replay state', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `id-${Math.random()}`) });
  });

  it('loads replay queues without connecting and preserves edit/run state', () => {
    const now = '2026-05-16T10:00:00.000Z';
    const target = { ...initialTargetContext, socketUrl: 'wss://example.com/socket' };
    const frames: FrameRecord[] = [
      { id: 'out-1', direction: 'outbound', timestamp: now, url: target.socketUrl, body: '{"hello":1}', metadata: {} },
    ];
    const socketRecipe = createSavedSocketRecipeFromTarget({ target, now });
    const messageSet = createSavedMessageSetFromControlledFrames({ frames, target, now });
    const queue = createReplayQueue({ socketRecipe, messageSet, now });

    let state = socketReducer(initialSocketState, { type: 'load-replay-queue', queue });
    expect(state.status).toBe('idle');
    expect(state.target.socketUrl).toBe(target.socketUrl);
    expect(state.transportContext.source).toBe('saved-recipe');
    expect(state.transportContext.sourceArtifactId).toBe(socketRecipe.id);
    expect(state.activeReplayQueue?.items[0].status).toBe('queued');

    state = socketReducer(state, { type: 'set-target-url', url: 'wss://manual.example/socket' });
    expect(state.transportContext.source).toBe('manual');
    expect(state.transportContext.handshake.observed).toBe(false);

    state = socketReducer(state, {
      type: 'edit-replay-queue-item',
      itemId: queue.items[0].id,
      body: '{"hello":2}',
      preview: '{"hello":2}',
      updatedAt: now,
    });
    expect(state.activeReplayQueue?.items[0].editedAt).toBe(now);

    state = socketReducer(state, { type: 'start-replay-run', run: { ...createRun(queue, now), status: 'running' } });
    state = socketReducer(state, { type: 'mark-replay-item-sent', itemId: queue.items[0].id, sentAt: now });
    state = socketReducer(state, { type: 'finish-replay-run', status: 'completed', endedAt: now, inboundFrameIds: [] });

    expect(state.activeReplayQueue?.items[0].status).toBe('sent');
    expect(state.activeReplayRun?.status).toBe('completed');
  });
});

function createRun(queue: ReturnType<typeof createReplayQueue>, now: string) {
  return {
    id: 'run-1',
    queueId: queue.id,
    socketRecipeId: queue.socketRecipe.id,
    messageSetId: queue.messageSet.id,
    socketUrl: queue.socketRecipe.socketUrl,
    selectedEngine: queue.socketRecipe.selectedEngine,
    sourceMismatch: queue.sourceMismatch,
    mode: 'manual' as const,
    waitingCheckpointId: null,
    startedAt: now,
    endedAt: null,
    sentMessageIds: [],
    unsentMessageIds: queue.items.map((item) => item.id),
    inboundFrameIds: [],
    checkpointOutcomes: [],
  };
}

import { createEmptyCaptureSnapshot, createEmptyHandshakeSummary } from './discovery';
import { resendFrame } from './frameUtils';
import { securityTests } from './securityCatalog';
import { isSendableReplayItem, transcriptCheckpointMatches } from './transcript';
import type { FrameRecord, HandshakeSummary, SocketAction, SocketState, TargetContext, TransportContextState } from './types';

export const initialTargetContext: TargetContext = {
  tabId: null,
  tabOrigin: 'unknown',
  socketUrl: '',
  subprotocol: '',
  engine: 'extension',
  authAssumption: 'unknown',
  executionContext: 'extension-context',
  debuggerCaptureEnabled: false,
  pageCspBypassEnabled: false,
  pageCspHeaderStripEnabled: false,
  pageCspMetaProbeInjected: false,
  pageSessionStale: false,
};

export const initialTransportContext: TransportContextState = {
  source: 'manual',
  sourceRequestId: null,
  sourceArtifactId: null,
  handshake: createEmptyHandshakeSummary(),
};

export const initialSocketState: SocketState = {
  target: initialTargetContext,
  transportContext: initialTransportContext,
  status: 'idle',
  frames: [],
  selectedFrameId: null,
  search: '',
  directionFilter: 'all',
  editorBody: '',
  evidence: [],
  authorizationConfirmed: false,
  activeTab: 'debugger',
  selectedTestId: securityTests[0].id,
  discovery: createEmptyCaptureSnapshot(-1),
  selectedDiscoveryRequestId: null,
  replayLibraryStatus: 'idle',
  replayLibrary: [],
  replayLibraryError: null,
  activeReplayQueue: null,
  selectedReplayQueueItemIds: [],
  activeReplayRun: null,
  error: null,
};

export function socketReducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case 'set-target-url':
      return { ...state, target: { ...state.target, socketUrl: action.url }, transportContext: initialTransportContext, error: null };
    case 'set-target-subprotocol':
      return { ...state, target: { ...state.target, subprotocol: action.subprotocol }, error: null };
    case 'set-tab-context':
      const sameTab = action.tabId === state.target.tabId;
      return {
        ...state,
        target: { ...state.target, tabId: action.tabId, tabOrigin: action.origin },
        discovery: action.tabId === null ? createEmptyCaptureSnapshot(-1) : state.discovery.tabId === action.tabId ? state.discovery : createEmptyCaptureSnapshot(action.tabId),
        selectedDiscoveryRequestId: sameTab ? state.selectedDiscoveryRequestId : null,
        transportContext: sameTab ? state.transportContext : initialTransportContext,
      };
    case 'set-engine':
      return {
        ...state,
        target: {
          ...state.target,
          engine: action.engine,
          executionContext: action.engine === 'page' ? 'page-context' : 'extension-context',
        },
      };
    case 'set-status':
      return { ...state, status: action.status, error: action.error ?? null };
    case 'add-frame':
      return addFrameAndAdvanceCheckpoint(state, action.frame);
    case 'select-frame': {
      const frame = state.frames.find((candidate) => candidate.id === action.frameId);
      return { ...state, selectedFrameId: action.frameId, editorBody: frame?.body ?? state.editorBody };
    }
    case 'set-editor-body':
      return { ...state, editorBody: action.body };
    case 'set-search':
      return { ...state, search: action.search };
    case 'set-direction-filter':
      return { ...state, directionFilter: action.direction };
    case 'clear-frames':
      return { ...state, frames: [], selectedFrameId: null, editorBody: '' };
    case 'resend-selected': {
      const frame = state.frames.find((candidate) => candidate.id === state.selectedFrameId);
      if (!frame) return state;
      return { ...state, frames: [...state.frames, resendFrame(frame, action.now)] };
    }
    case 'set-authorization':
      return { ...state, authorizationConfirmed: action.confirmed };
    case 'set-active-tab':
      return { ...state, activeTab: action.tab };
    case 'select-test':
      return { ...state, selectedTestId: action.testId };
    case 'add-evidence':
      return { ...state, evidence: [action.result, ...state.evidence] };
    case 'mark-page-stale':
      return { ...state, status: state.target.engine === 'page' ? 'stale' : state.status, target: { ...state.target, pageSessionStale: true } };
    case 'set-debugger-capture':
      return { ...state, target: { ...state.target, debuggerCaptureEnabled: action.enabled } };
    case 'set-discovery-snapshot': {
      const selectedStillExists = action.snapshot.sockets.some((socket) => socket.requestId === state.selectedDiscoveryRequestId);
      return {
        ...state,
        discovery: action.snapshot,
        selectedDiscoveryRequestId: selectedStillExists ? state.selectedDiscoveryRequestId : action.snapshot.sockets[0]?.requestId ?? null,
      };
    }
    case 'select-discovered-socket':
      return { ...state, selectedDiscoveryRequestId: action.requestId };
    case 'import-connection-recipe':
      return {
        ...state,
        target: {
          ...state.target,
          socketUrl: action.recipe.socketUrl,
          subprotocol: action.recipe.subprotocol,
          engine: action.recipe.selectedEngine,
          authAssumption: inferImportedAuthAssumption(action.recipe.handshake, action.recipe.selectedEngine, state.target.authAssumption),
          executionContext: action.recipe.selectedEngine === 'page' ? 'page-context' : 'extension-context',
        },
        transportContext: {
          source: 'discovery',
          sourceRequestId: action.recipe.sourceRequestId,
          sourceArtifactId: null,
          handshake: action.recipe.handshake,
        },
        editorBody: action.recipe.bootstrapFrames[0]?.body ?? state.editorBody,
        activeTab: 'debugger',
        error: null,
      };
    case 'set-replay-library-status':
      return { ...state, replayLibraryStatus: action.status, replayLibraryError: action.error ?? null };
    case 'set-replay-library':
      return { ...state, replayLibrary: action.artifacts, replayLibraryStatus: 'ready', replayLibraryError: null };
    case 'add-replay-artifact':
      return {
        ...state,
        replayLibrary: [action.artifact, ...state.replayLibrary.filter((artifact) => artifact.id !== action.artifact.id)],
        replayLibraryStatus: 'ready',
        replayLibraryError: null,
      };
    case 'remove-replay-artifact':
      return {
        ...state,
        replayLibrary: state.replayLibrary.filter((artifact) => artifact.id !== action.artifactId),
        activeReplayQueue:
          state.activeReplayQueue?.socketRecipe.id === action.artifactId || state.activeReplayQueue?.messageSet.id === action.artifactId
            ? null
            : state.activeReplayQueue,
        selectedReplayQueueItemIds:
          state.activeReplayQueue?.socketRecipe.id === action.artifactId || state.activeReplayQueue?.messageSet.id === action.artifactId
            ? []
            : state.selectedReplayQueueItemIds,
      };
    case 'clear-replay-library':
      return { ...state, replayLibrary: [], activeReplayQueue: null, selectedReplayQueueItemIds: [] };
    case 'load-replay-queue':
      return {
        ...state,
        target: {
          ...state.target,
          socketUrl: action.queue.socketRecipe.socketUrl,
          subprotocol: action.queue.socketRecipe.subprotocol,
          engine: action.queue.socketRecipe.selectedEngine,
          authAssumption: action.queue.socketRecipe.authAssumption,
          executionContext: action.queue.socketRecipe.selectedEngine === 'page' ? 'page-context' : 'extension-context',
        },
        transportContext: {
          source: 'saved-recipe',
          sourceRequestId: action.queue.socketRecipe.sourceRequestId,
          sourceArtifactId: action.queue.socketRecipe.id,
          handshake: action.queue.socketRecipe.handshake,
        },
        activeReplayQueue: action.queue,
        selectedReplayQueueItemIds: action.queue.items.filter((item) => item.selected && item.status !== 'removed').map((item) => item.id),
        editorBody: action.queue.items[0]?.body ?? state.editorBody,
        activeTab: 'debugger',
        error: null,
      };
    case 'toggle-replay-queue-item':
      return {
        ...state,
        selectedReplayQueueItemIds: action.selected
          ? [...state.selectedReplayQueueItemIds.filter((id) => id !== action.itemId), action.itemId]
          : state.selectedReplayQueueItemIds.filter((id) => id !== action.itemId),
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              items: state.activeReplayQueue.items.map((item) => (item.id === action.itemId ? { ...item, selected: action.selected } : item)),
              updatedAt: new Date().toISOString(),
            }
          : null,
      };
    case 'edit-replay-queue-item':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              items: state.activeReplayQueue.items.map((item) =>
                item.id === action.itemId
                  ? {
                      ...item,
                      ...(isSendableReplayItem(item)
                        ? {
                            body: action.body,
                            preview: action.preview,
                            payloadLength: action.body.length,
                            updatedAt: action.updatedAt,
                            editedAt: action.updatedAt,
                            status: item.status === 'sent' ? item.status : 'queued',
                          }
                        : {}),
                    }
                  : item,
              ),
              updatedAt: action.updatedAt,
            }
          : null,
        editorBody: state.activeReplayQueue?.items.some((item) => item.id === action.itemId) ? action.body : state.editorBody,
      };
    case 'skip-replay-queue-item':
      return {
        ...state,
        selectedReplayQueueItemIds: state.selectedReplayQueueItemIds.filter((id) => id !== action.itemId),
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              waitingCheckpointId: state.activeReplayQueue.waitingCheckpointId === action.itemId ? null : state.activeReplayQueue.waitingCheckpointId,
              updatedAt: action.skippedAt,
              items: state.activeReplayQueue.items.map((item) => (item.id === action.itemId ? { ...item, status: 'skipped', updatedAt: action.skippedAt } : item)),
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              waitingCheckpointId: state.activeReplayRun.waitingCheckpointId === action.itemId ? null : state.activeReplayRun.waitingCheckpointId,
              unsentMessageIds: state.activeReplayRun.unsentMessageIds.filter((id) => id !== action.itemId),
              checkpointOutcomes: appendCheckpointOutcome(state.activeReplayRun.checkpointOutcomes, {
                rowId: action.itemId,
                sourceFrameHash: state.activeReplayQueue?.items.find((item) => item.id === action.itemId)?.sourceFrameHash ?? '',
                status: 'skipped',
                matchedFrameId: null,
                timestamp: action.skippedAt,
              }),
            }
          : null,
      };
    case 'remove-replay-queue-item':
      return {
        ...state,
        selectedReplayQueueItemIds: state.selectedReplayQueueItemIds.filter((id) => id !== action.itemId),
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              waitingCheckpointId: state.activeReplayQueue.waitingCheckpointId === action.itemId ? null : state.activeReplayQueue.waitingCheckpointId,
              updatedAt: action.removedAt,
              items: state.activeReplayQueue.items.map((item) => (item.id === action.itemId ? { ...item, status: 'removed', selected: false, updatedAt: action.removedAt } : item)),
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              waitingCheckpointId: state.activeReplayRun.waitingCheckpointId === action.itemId ? null : state.activeReplayRun.waitingCheckpointId,
              unsentMessageIds: state.activeReplayRun.unsentMessageIds.filter((id) => id !== action.itemId),
            }
          : null,
      };
    case 'clear-replay-queue':
      return { ...state, activeReplayQueue: null, selectedReplayQueueItemIds: [], activeReplayRun: null };
    case 'start-replay-run':
      return {
        ...state,
        activeReplayRun: action.run,
        activeReplayQueue: state.activeReplayQueue ? { ...state.activeReplayQueue, waitingCheckpointId: null } : null,
      };
    case 'mark-replay-item-sent':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              items: state.activeReplayQueue.items.map((item) => (item.id === action.itemId && isSendableReplayItem(item) ? { ...item, status: 'sent', sentAt: action.sentAt, updatedAt: action.sentAt } : item)),
              updatedAt: action.sentAt,
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              sentMessageIds: [...state.activeReplayRun.sentMessageIds.filter((id) => id !== action.itemId), action.itemId],
              unsentMessageIds: state.activeReplayRun.unsentMessageIds.filter((id) => id !== action.itemId),
            }
          : null,
      };
    case 'mark-replay-checkpoint-waiting':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              waitingCheckpointId: action.itemId,
              items: state.activeReplayQueue.items.map((item) =>
                item.id === action.itemId ? { ...item, status: 'waiting', timeoutAt: action.timeoutAt, updatedAt: action.timeoutAt } : item,
              ),
            }
          : null,
        activeReplayRun: state.activeReplayRun ? { ...state.activeReplayRun, waitingCheckpointId: action.itemId } : null,
      };
    case 'mark-replay-checkpoint-matched':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              waitingCheckpointId: state.activeReplayQueue.waitingCheckpointId === action.itemId ? null : state.activeReplayQueue.waitingCheckpointId,
              items: state.activeReplayQueue.items.map((item) =>
                item.id === action.itemId ? { ...item, status: 'matched', matchedFrameId: action.frameId, updatedAt: action.matchedAt } : item,
              ),
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              waitingCheckpointId: state.activeReplayRun.waitingCheckpointId === action.itemId ? null : state.activeReplayRun.waitingCheckpointId,
              inboundFrameIds: [...state.activeReplayRun.inboundFrameIds.filter((id) => id !== action.frameId), action.frameId],
              checkpointOutcomes: appendCheckpointOutcome(state.activeReplayRun.checkpointOutcomes, {
                rowId: action.itemId,
                sourceFrameHash: state.activeReplayQueue?.items.find((item) => item.id === action.itemId)?.sourceFrameHash ?? '',
                status: 'matched',
                matchedFrameId: action.frameId,
                timestamp: action.matchedAt,
              }),
            }
          : null,
      };
    case 'mark-replay-checkpoint-timeout':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              waitingCheckpointId: state.activeReplayQueue.waitingCheckpointId === action.itemId ? null : state.activeReplayQueue.waitingCheckpointId,
              items: state.activeReplayQueue.items.map((item) => (item.id === action.itemId ? { ...item, status: 'timeout', updatedAt: action.timedOutAt } : item)),
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              waitingCheckpointId: state.activeReplayRun.waitingCheckpointId === action.itemId ? null : state.activeReplayRun.waitingCheckpointId,
              checkpointOutcomes: appendCheckpointOutcome(state.activeReplayRun.checkpointOutcomes, {
                rowId: action.itemId,
                sourceFrameHash: state.activeReplayQueue?.items.find((item) => item.id === action.itemId)?.sourceFrameHash ?? '',
                status: 'timeout',
                matchedFrameId: null,
                timestamp: action.timedOutAt,
              }),
            }
          : null,
      };
    case 'finish-replay-run':
      return {
        ...state,
        activeReplayQueue: state.activeReplayQueue
          ? {
              ...state.activeReplayQueue,
              items: state.activeReplayQueue.items.map((item) =>
                isSendableReplayItem(item) && item.status === 'queued' && (action.status === 'partial' || action.status === 'failed') ? { ...item, status: 'unsent' } : item,
              ),
              waitingCheckpointId: null,
              updatedAt: action.endedAt,
            }
          : null,
        activeReplayRun: state.activeReplayRun
          ? {
              ...state.activeReplayRun,
              status: action.status,
              endedAt: action.endedAt,
              waitingCheckpointId: null,
              inboundFrameIds: action.inboundFrameIds,
              unsentMessageIds:
                state.activeReplayQueue?.items
                  .filter((item) => isSendableReplayItem(item) && item.status !== 'sent' && item.status !== 'skipped' && item.status !== 'removed')
                  .map((item) => item.id) ?? state.activeReplayRun.unsentMessageIds,
            }
          : null,
      };
    case 'set-page-csp-bypass':
      return { ...state, target: { ...state.target, pageCspBypassEnabled: action.enabled }, error: null };
    case 'set-csp-header-strip':
      return { ...state, target: { ...state.target, pageCspHeaderStripEnabled: action.enabled }, error: null };
    case 'set-csp-meta-probe':
      return { ...state, target: { ...state.target, pageCspMetaProbeInjected: action.injected }, error: null };
    default:
      return state;
  }
}

function addFrameAndAdvanceCheckpoint(state: SocketState, frame: FrameRecord): SocketState {
  const baseState = { ...state, frames: [...state.frames, frame], selectedFrameId: frame.id };
  const queue = baseState.activeReplayQueue;
  const run = baseState.activeReplayRun;
  if (!queue || !run || run.status !== 'running' || frame.direction !== 'inbound') return baseState;
  const waiting = queue.items.find((item) => item.status === 'waiting' && item.id === queue.waitingCheckpointId);
  if (!waiting || !transcriptCheckpointMatches(waiting, frame)) return baseState;
  return socketReducer(baseState, { type: 'mark-replay-checkpoint-matched', itemId: waiting.id, frameId: frame.id, matchedAt: frame.timestamp });
}

function appendCheckpointOutcome(
  outcomes: NonNullable<SocketState['activeReplayRun']>['checkpointOutcomes'],
  outcome: NonNullable<SocketState['activeReplayRun']>['checkpointOutcomes'][number],
) {
  return [...outcomes.filter((candidate) => candidate.rowId !== outcome.rowId || candidate.status !== outcome.status), outcome];
}

function inferImportedAuthAssumption(
  handshake: HandshakeSummary,
  selectedEngine: TargetContext['engine'],
  fallback: TargetContext['authAssumption'],
): TargetContext['authAssumption'] {
  if (selectedEngine === 'page') return 'page-session';
  if (handshake.requestHeaders.some((header) => header.name.toLowerCase() === 'authorization' || header.name.toLowerCase() === 'cookie')) {
    return 'manual-token';
  }
  return fallback;
}

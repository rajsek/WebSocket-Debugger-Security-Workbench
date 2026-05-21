export type EngineMode = 'extension' | 'page';
export type FrameDirection = 'inbound' | 'outbound';
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error' | 'stale';
export type SecurityCategory = 'handshake' | 'authorization' | 'injection' | 'replay' | 'size-rate' | 'logging';
export type TestMode = 'passive' | 'active';
export type TestStatus = 'blocked' | 'ready' | 'running' | 'passed' | 'warning' | 'failed';
export type WebSocketCaptureStatus = 'idle' | 'attaching' | 'listening' | 'stopped' | 'failed' | 'detached' | 'detached-by-devtools';
export type DiscoveredSocketLifecycle = 'created' | 'handshaking' | 'open' | 'active' | 'errored' | 'closed';
export type ReplayArtifactSchemaVersion = 1;
export type ReplayArtifactKind = 'saved-socket-recipe' | 'saved-message-set';
export type ReplaySourceType = 'discovery' | 'controlled' | 'manual' | 'import';
export type ReplayQueueItemRole = 'sendable' | 'wait-checkpoint' | 'observed-only';
export type ReplayQueueItemStatus = 'queued' | 'sent' | 'unsent' | 'waiting' | 'matched' | 'timeout' | 'skipped' | 'removed' | 'error';
export type ReplayCheckpointMode = 'exact' | 'next-inbound';
export type ReplayRunMode = 'manual' | 'ordered' | 'ordered-with-waits';
export type ReplayRunStatus = 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type ReplayLibraryStatus = 'idle' | 'loading' | 'ready' | 'error';
export type TransportContextSource = 'manual' | 'discovery' | 'saved-recipe';

export interface TargetContext {
  tabId: number | null;
  tabOrigin: string;
  socketUrl: string;
  subprotocol: string;
  engine: EngineMode;
  authAssumption: 'unknown' | 'page-session' | 'manual-token' | 'none';
  executionContext: 'extension-context' | 'page-context';
  debuggerCaptureEnabled: boolean;
  pageCspBypassEnabled: boolean;
  pageCspHeaderStripEnabled: boolean;
  pageCspMetaProbeInjected: boolean;
  pageSessionStale: boolean;
}

export interface FrameRecord {
  id: string;
  direction: FrameDirection;
  timestamp: string;
  url: string;
  body: string;
  metadata: Record<string, string>;
}

export interface RedactedHeader {
  name: string;
  value: string;
  redacted: boolean;
}

export interface HandshakeSummary {
  observed: boolean;
  requestHeaders: RedactedHeader[];
  responseHeaders: RedactedHeader[];
  status: number | null;
  statusText: string;
  protocol: string;
  extensions: string;
  requestTime: string | null;
  responseTime: string | null;
}

export interface ObservedFrameSummary {
  id: string;
  requestId: string;
  direction: FrameDirection;
  timestamp: string;
  opcode: number | null;
  payloadKind: 'text' | 'binary';
  body: string;
  preview: string;
  payloadLength: number;
  redacted: boolean;
}

export interface BootstrapTranscriptRow extends ObservedFrameSummary {
  sourceFrameId: string;
  sourceFrameHash: string;
  role: ReplayQueueItemRole;
  checkpointMode: ReplayCheckpointMode;
}

export interface DiscoveredSocket {
  requestId: string;
  url: string;
  lifecycle: DiscoveredSocketLifecycle;
  createdAt: string;
  lastActivityAt: string;
  handshake: HandshakeSummary;
  frameCounts: {
    inbound: number;
    outbound: number;
  };
  bootstrapTranscript: BootstrapTranscriptRow[];
  firstOutboundFrames: ObservedFrameSummary[];
  error: string | null;
  closedAt: string | null;
}

export interface WebSocketCaptureSnapshot {
  tabId: number;
  status: WebSocketCaptureStatus;
  startedAt: string | null;
  stoppedAt: string | null;
  message: string;
  detachReason: string | null;
  sockets: DiscoveredSocket[];
}

export type WebSocketCaptureEvent =
  | { type: 'created'; requestId: string; url: string; timestamp: string }
  | { type: 'handshake-request'; requestId: string; timestamp: string; headers: RedactedHeader[] }
  | { type: 'handshake-response'; requestId: string; timestamp: string; status: number | null; statusText: string; headers: RedactedHeader[]; protocol: string; extensions: string }
  | { type: 'frame'; frame: ObservedFrameSummary }
  | { type: 'error'; requestId: string; timestamp: string; message: string }
  | { type: 'closed'; requestId: string; timestamp: string };

export interface ConnectionRecipe {
  id: string;
  sourceRequestId: string;
  socketUrl: string;
  subprotocol: string;
  recommendedEngine: EngineMode;
  selectedEngine: EngineMode;
  recommendationReason: string;
  tabOrigin: string;
  createdAt: string;
  handshake: HandshakeSummary;
  bootstrapTranscript: BootstrapTranscriptRow[];
  bootstrapFrames: ObservedFrameSummary[];
}

export interface TransportContextState {
  source: TransportContextSource;
  sourceRequestId: string | null;
  sourceArtifactId: string | null;
  handshake: HandshakeSummary;
}

export interface ReplayArtifactBase {
  schemaVersion: ReplayArtifactSchemaVersion;
  kind: ReplayArtifactKind;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedSocketRecipe extends ReplayArtifactBase {
  kind: 'saved-socket-recipe';
  socketUrl: string;
  subprotocol: string;
  selectedEngine: EngineMode;
  recommendedEngine: EngineMode;
  tabOrigin: string;
  authAssumption: TargetContext['authAssumption'];
  sourceType: ReplaySourceType;
  sourceRequestId: string | null;
  handshake: HandshakeSummary;
}

export interface SavedReplayMessage {
  id: string;
  body: string;
  preview: string;
  payloadLength: number;
  sourceFrameId: string | null;
  sourceFrameHash: string;
  sourceRequestId?: string | null;
  sourceTimestamp: string | null;
  direction?: FrameDirection;
  payloadKind?: 'text' | 'binary';
  role?: ReplayQueueItemRole;
  checkpointMode?: ReplayCheckpointMode;
  createdAt: string;
  updatedAt: string;
}

export interface SavedMessageSet extends ReplayArtifactBase {
  kind: 'saved-message-set';
  sourceType: ReplaySourceType;
  socketUrl: string;
  tabOrigin: string;
  sourceRequestId: string | null;
  messages: SavedReplayMessage[];
  transcriptRows?: SavedReplayMessage[];
}

export type SavedReplayArtifact = SavedSocketRecipe | SavedMessageSet;

export interface ReplayQueueItem extends SavedReplayMessage {
  direction: FrameDirection;
  payloadKind: 'text' | 'binary';
  sourceRequestId: string | null;
  role: ReplayQueueItemRole;
  checkpointMode: ReplayCheckpointMode;
  status: ReplayQueueItemStatus;
  selected: boolean;
  sentAt: string | null;
  editedAt: string | null;
  originalBody: string;
  originalPreview: string;
  matchedFrameId: string | null;
  timeoutAt: string | null;
}

export interface ReplayQueue {
  id: string;
  socketRecipe: SavedSocketRecipe;
  messageSet: SavedMessageSet;
  items: ReplayQueueItem[];
  sourceMismatch: boolean;
  mismatchReason: string | null;
  createdAt: string;
  updatedAt: string;
  waitingCheckpointId: string | null;
}

export interface ReplayRun {
  id: string;
  queueId: string;
  socketRecipeId: string;
  messageSetId: string;
  socketUrl: string;
  selectedEngine: EngineMode;
  sourceMismatch: boolean;
  mode: ReplayRunMode;
  waitingCheckpointId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: ReplayRunStatus;
  sentMessageIds: string[];
  unsentMessageIds: string[];
  inboundFrameIds: string[];
  checkpointOutcomes: ReplayCheckpointOutcome[];
}

export interface ReplayCheckpointOutcome {
  rowId: string;
  sourceFrameHash: string;
  status: 'matched' | 'timeout' | 'skipped';
  matchedFrameId: string | null;
  timestamp: string;
}

export interface SecurityTest {
  id: string;
  category: SecurityCategory;
  mode: TestMode;
  title: string;
  description: string;
  preconditions: string[];
  owaspRefs: string[];
  defaultPayload?: string;
}

export interface SecurityRunRequest {
  test: SecurityTest;
  target: TargetContext;
  authorizationConfirmed: boolean;
  payload: string;
  note: string;
}

export interface TestResultRecord {
  kind: 'security-test';
  id: string;
  testId: string;
  targetOrigin: string;
  socketUrl: string;
  timestamp: string;
  engine: EngineMode;
  status: TestStatus;
  payloadHash: string;
  payloadPreview: string;
  responsePreview: string;
  note: string;
}

export interface ObservedSocketEvidenceRecord {
  kind: 'observed-socket';
  id: string;
  timestamp: string;
  targetOrigin: string;
  socketUrl: string;
  sourceRequestId: string;
  handshake: HandshakeSummary;
  frameCounts: {
    inbound: number;
    outbound: number;
  };
  firstOutboundPreviews: string[];
  captureStartedAt: string | null;
  captureStoppedAt: string | null;
}

export interface RecipeImportEvidenceRecord {
  kind: 'recipe-import';
  id: string;
  timestamp: string;
  targetOrigin: string;
  socketUrl: string;
  sourceRequestId: string;
  selectedEngine: EngineMode;
  bootstrapFramePreviews: string[];
  transcriptFramePreviews: string[];
  note: string;
}

export interface ReplayRunEvidenceRecord {
  kind: 'replay-run';
  id: string;
  replayRunId: string;
  timestamp: string;
  endedAt: string | null;
  targetOrigin: string;
  socketUrl: string;
  selectedEngine: EngineMode;
  status: ReplayRunStatus;
  sourceArtifactIds: string[];
  sourceMismatch: boolean;
  messagePreviews: string[];
  messageHashes: string[];
  editedMessageCount: number;
  sentMessageCount: number;
  unsentMessageCount: number;
  skippedRowCount: number;
  removedRowCount: number;
  checkpointOutcomes: ReplayCheckpointOutcome[];
  inboundTranscriptPreviews: string[];
}

export type EvidenceRecord =
  | TestResultRecord
  | ObservedSocketEvidenceRecord
  | RecipeImportEvidenceRecord
  | ReplayRunEvidenceRecord;

export type RuntimeCommand =
  | { version: 1; type: 'inject-overlay'; tabId: number }
  | { version: 1; type: 'inject-page-overlay'; tabId: number }
  | { version: 1; type: 'mark-page-stale'; tabId: number }
  | { version: 1; type: 'request-debugger-capture'; tabId: number }
  | { version: 1; type: 'start-websocket-discovery'; tabId: number }
  | { version: 1; type: 'stop-websocket-discovery'; tabId: number }
  | { version: 1; type: 'capture-websocket-discovery-with-reload'; tabId: number }
  | { version: 1; type: 'get-websocket-discovery-snapshot'; tabId: number }
  | { version: 1; type: 'set-page-csp-bypass'; tabId: number; enabled: boolean }
  | { version: 1; type: 'set-csp-header-strip'; tabId: number; enabled: boolean; reload: boolean }
  | { version: 1; type: 'inject-csp-meta-probe'; tabId: number }
  | { version: 1; type: 'get-debug-lab-state'; tabId: number };

export type RuntimeEvent =
  | { version: 1; type: 'overlay-injected'; tabId: number }
  | { version: 1; type: 'page-overlay-injected'; tabId: number }
  | { version: 1; type: 'page-session-stale'; tabId: number }
  | { version: 1; type: 'debugger-capture-permission'; tabId: number; granted: boolean }
  | { version: 1; type: 'websocket-discovery-status'; tabId: number; snapshot: WebSocketCaptureSnapshot }
  | { version: 1; type: 'websocket-discovery-snapshot'; tabId: number; snapshot: WebSocketCaptureSnapshot }
  | { version: 1; type: 'websocket-discovery-detached'; tabId: number; snapshot: WebSocketCaptureSnapshot }
  | { version: 1; type: 'page-csp-bypass-updated'; tabId: number; enabled: boolean; ok: boolean; error?: string }
  | { version: 1; type: 'csp-header-strip-updated'; tabId: number; enabled: boolean; ok: boolean; reloaded: boolean; error?: string }
  | { version: 1; type: 'csp-meta-probe-injected'; tabId: number; injected: boolean; ok: boolean; message?: string; error?: string }
  | { version: 1; type: 'debug-lab-state'; tabId: number; pageCspBypassEnabled: boolean; pageCspHeaderStripEnabled: boolean };

export interface SocketState {
  target: TargetContext;
  transportContext: TransportContextState;
  status: ConnectionStatus;
  frames: FrameRecord[];
  selectedFrameId: string | null;
  search: string;
  directionFilter: 'all' | FrameDirection;
  editorBody: string;
  evidence: EvidenceRecord[];
  authorizationConfirmed: boolean;
  activeTab: 'debugger' | 'discover' | 'replay' | 'security' | 'debug-lab' | 'evidence';
  selectedTestId: string;
  discovery: WebSocketCaptureSnapshot;
  selectedDiscoveryRequestId: string | null;
  replayLibraryStatus: ReplayLibraryStatus;
  replayLibrary: SavedReplayArtifact[];
  replayLibraryError: string | null;
  activeReplayQueue: ReplayQueue | null;
  selectedReplayQueueItemIds: string[];
  activeReplayRun: ReplayRun | null;
  error: string | null;
}

export type SocketAction =
  | { type: 'set-target-url'; url: string }
  | { type: 'set-target-subprotocol'; subprotocol: string }
  | { type: 'set-tab-context'; tabId: number | null; origin: string }
  | { type: 'set-engine'; engine: EngineMode }
  | { type: 'set-status'; status: ConnectionStatus; error?: string | null }
  | { type: 'add-frame'; frame: FrameRecord }
  | { type: 'select-frame'; frameId: string | null }
  | { type: 'set-editor-body'; body: string }
  | { type: 'set-search'; search: string }
  | { type: 'set-direction-filter'; direction: 'all' | FrameDirection }
  | { type: 'clear-frames' }
  | { type: 'resend-selected'; now: string }
  | { type: 'set-authorization'; confirmed: boolean }
  | { type: 'set-active-tab'; tab: SocketState['activeTab'] }
  | { type: 'select-test'; testId: string }
  | { type: 'add-evidence'; result: EvidenceRecord }
  | { type: 'mark-page-stale' }
  | { type: 'set-debugger-capture'; enabled: boolean }
  | { type: 'set-discovery-snapshot'; snapshot: WebSocketCaptureSnapshot }
  | { type: 'select-discovered-socket'; requestId: string | null }
  | { type: 'import-connection-recipe'; recipe: ConnectionRecipe }
  | { type: 'set-replay-library-status'; status: ReplayLibraryStatus; error?: string | null }
  | { type: 'set-replay-library'; artifacts: SavedReplayArtifact[] }
  | { type: 'add-replay-artifact'; artifact: SavedReplayArtifact }
  | { type: 'remove-replay-artifact'; artifactId: string }
  | { type: 'clear-replay-library' }
  | { type: 'load-replay-queue'; queue: ReplayQueue }
  | { type: 'toggle-replay-queue-item'; itemId: string; selected: boolean }
  | { type: 'edit-replay-queue-item'; itemId: string; body: string; preview: string; updatedAt: string }
  | { type: 'skip-replay-queue-item'; itemId: string; skippedAt: string }
  | { type: 'remove-replay-queue-item'; itemId: string; removedAt: string }
  | { type: 'clear-replay-queue' }
  | { type: 'start-replay-run'; run: ReplayRun }
  | { type: 'mark-replay-item-sent'; itemId: string; sentAt: string }
  | { type: 'mark-replay-checkpoint-waiting'; itemId: string; timeoutAt: string }
  | { type: 'mark-replay-checkpoint-matched'; itemId: string; frameId: string; matchedAt: string }
  | { type: 'mark-replay-checkpoint-timeout'; itemId: string; timedOutAt: string }
  | { type: 'finish-replay-run'; status: ReplayRunStatus; endedAt: string; inboundFrameIds: string[] }
  | { type: 'set-page-csp-bypass'; enabled: boolean }
  | { type: 'set-csp-header-strip'; enabled: boolean }
  | { type: 'set-csp-meta-probe'; injected: boolean };

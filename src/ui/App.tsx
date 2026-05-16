import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bug,
  Copy,
  Eraser,
  FileText,
  FlaskConical,
  PictureInPicture2,
  Plug,
  RefreshCw,
  Search,
  SendHorizontal,
  ShieldAlert,
  Square,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createConnectionRecipe } from '../domain/discovery';
import { summarizeWebSocketMessageData } from '../domain/binaryPayload';
import {
  createBootstrapReplayEvidenceRecord,
  createEvidenceRecord,
  createObservedSocketEvidenceRecord,
  createRecipeImportEvidenceRecord,
  createReplayRunEvidenceRecord,
  exportEvidenceMarkdown,
} from '../domain/evidence';
import { createFrame, searchFrames } from '../domain/frameUtils';
import {
  createReplayQueue,
  createReplayRun,
  createSavedMessageSetFromControlledFrames,
  createSavedMessageSetFromDiscoveredFrames,
  createSavedSocketRecipeFromDiscovery,
  createSavedSocketRecipeFromTarget,
  editReplayQueueItem,
} from '../domain/replay';
import { initialSocketState, socketReducer } from '../domain/reducer';
import { getSecurityTest, securityTests } from '../domain/securityCatalog';
import { canRunSecurityTest, runPassiveSecurityTest } from '../domain/securityRunner';
import { testEndpointPresets } from '../domain/testEndpoints';
import type { ConnectionRecipe, ConnectionStatus, DiscoveredSocket, EvidenceRecord, FrameRecord, ReplayQueue, ReplayQueueItem, ReplayRunStatus, SavedMessageSet, SavedSocketRecipe, SecurityRunRequest } from '../domain/types';
import { validateWebSocketUrl } from '../domain/url';
import {
  captureWebSocketDiscoveryWithReload,
  getDebugLabState,
  getWebSocketDiscoverySnapshot,
  injectCspMetaProbe,
  injectOverlay,
  requestDebuggerCapture,
  setCspHeaderStrip,
  setPageCspBypass,
  startWebSocketDiscovery,
  stopWebSocketDiscovery,
} from '../extension/chromeAdapter';
import {
  clearReplayLibrary,
  deleteReplayArtifact,
  exportReplayArtifacts,
  importReplayArtifactsJson,
  loadReplayLibrary,
  saveReplayArtifact,
  saveReplayArtifacts,
} from '../extension/replayStorage';
import { DiscoverView } from './DiscoverView';
import { ReplayLibraryView, ReplayQueuePanel } from './ReplayLibraryView';

interface AppProps {
  surface: 'popup' | 'devtools' | 'sidepanel' | 'page-overlay';
  loadTabContext: () => Promise<{ tabId: number | null; origin: string }>;
  subscribeTabContext?: (onChange: (context: { tabId: number | null; origin: string }) => void) => () => void;
  transport?: 'extension' | 'page';
}

type PageEngineMessage =
  | { source: 'ws-workbench-page-engine'; type: 'status'; status: 'connecting' | 'open' | 'closed' | 'error'; message: string }
  | { source: 'ws-workbench-page-engine'; type: 'frame'; direction: 'inbound' | 'outbound'; body: string; timestamp: string; metadata?: Record<string, string> };

const pageUiSource = 'ws-workbench-page-overlay';

export function App({ surface, loadTabContext, subscribeTabContext, transport = 'extension' }: AppProps) {
  const [state, dispatch] = useReducer(socketReducer, initialSocketState);
  const [securityPayload, setSecurityPayload] = useState('');
  const [securityNote, setSecurityNote] = useState('');
  const [debugLabMessage, setDebugLabMessage] = useState('');
  const [debugLabBusy, setDebugLabBusy] = useState(false);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [replayMessage, setReplayMessage] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const pageDebugLabRef = useRef<{ tabId: number | null; cdpBypass: boolean }>({ tabId: null, cdpBypass: false });

  useEffect(() => {
    loadTabContext()
      .then((context) => {
        dispatch({ type: 'set-tab-context', tabId: context.tabId, origin: context.origin });
        void hydrateDebugLabState(context.tabId);
        void hydrateDiscoverySnapshot(context.tabId);
      })
      .catch((error: unknown) => dispatch({ type: 'set-status', status: 'error', error: readableError(error) }));
  }, [loadTabContext]);

  useEffect(() => {
    void hydrateReplayLibrary();
  }, []);

  useEffect(() => {
    if (!subscribeTabContext) return undefined;
    return subscribeTabContext((context) => {
      dispatch({ type: 'set-tab-context', tabId: context.tabId, origin: context.origin });
      void hydrateDebugLabState(context.tabId);
      void hydrateDiscoverySnapshot(context.tabId);
    });
  }, [subscribeTabContext]);

  useEffect(() => {
    pageDebugLabRef.current = {
      tabId: state.target.tabId,
      cdpBypass: state.target.pageCspBypassEnabled,
    };
  }, [state.target.pageCspBypassEnabled, state.target.tabId]);

  useEffect(() => {
    let cleaned = false;

    const cleanupRuntime = () => {
      if (cleaned) return;
      cleaned = true;
      if (transport === 'page') postPageCommand({ type: 'stop' });
      socketRef.current?.close();
      socketRef.current = null;
      const { tabId, cdpBypass } = pageDebugLabRef.current;
      if (tabId !== null && cdpBypass) void setPageCspBypass(tabId, false);
    };

    window.addEventListener('pagehide', cleanupRuntime);
    return () => {
      window.removeEventListener('pagehide', cleanupRuntime);
      cleanupRuntime();
    };
  }, [transport]);

  useEffect(() => {
    if (transport !== 'page') return undefined;
    dispatch({ type: 'set-engine', engine: 'page' });

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || !isPageEngineMessage(event.data)) return;

      if (event.data.type === 'status') {
        dispatch({ type: 'set-status', status: event.data.status, error: event.data.message || null });
        return;
      }

      dispatch({
        type: 'add-frame',
        frame: createFrame({
          direction: event.data.direction,
          url: state.target.socketUrl,
          body: event.data.body,
          now: event.data.timestamp,
          metadata: { engine: 'page', ...(event.data.metadata ?? {}) },
        }),
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [state.target.socketUrl, transport]);

  const selectedFrame = state.frames.find((frame) => frame.id === state.selectedFrameId) ?? null;
  const filteredFrames = useMemo(
    () => searchFrames(state.frames, state.search, state.directionFilter),
    [state.frames, state.search, state.directionFilter],
  );
  const selectedTest = getSecurityTest(state.selectedTestId);
  const socketIsActive = state.status === 'connecting' || state.status === 'open';
  const selectedTestEndpoint = testEndpointPresets.find((preset) => preset.url === state.target.socketUrl) ?? null;
  const selectedTestEndpointUrl = selectedTestEndpoint?.url ?? '';
  const showPageCspBypass = transport === 'page' && state.target.engine === 'page';
  const selectedDiscoveredSocket = state.discovery.sockets.find((socket) => socket.requestId === state.selectedDiscoveryRequestId) ?? null;

  useEffect(() => {
    if (state.activeTab !== 'discover' || state.target.tabId === null) return undefined;
    if (state.discovery.status !== 'attaching' && state.discovery.status !== 'listening') return undefined;
    const tabId = state.target.tabId;

    const timer = window.setInterval(() => {
      void hydrateDiscoverySnapshot(tabId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.activeTab, state.discovery.status, state.target.tabId]);

  useEffect(() => {
    setSecurityPayload(selectedTest.defaultPayload ?? selectedFrame?.body ?? '');
  }, [selectedFrame?.body, selectedTest]);

  useEffect(() => {
    if (!state.activeReplayRun || state.activeReplayRun.status !== 'running') return;
    if (state.status === 'closed') finishReplayRun('partial');
    if (state.status === 'error' || state.status === 'stale') finishReplayRun('failed');
  }, [state.activeReplayRun?.id, state.activeReplayRun?.status, state.status]);

  function connect() {
    try {
      const parsed = validateWebSocketUrl(state.target.socketUrl);
      if (state.target.engine === 'page') {
        if (transport !== 'page') {
          dispatch({ type: 'set-status', status: 'error', error: 'Page engine is available only in the Direct Page Overlay.' });
          return;
        }
        dispatch({ type: 'set-status', status: 'connecting' });
        postPageCommand(state.target.subprotocol ? { type: 'connect', url: parsed.toString(), protocol: state.target.subprotocol } : { type: 'connect', url: parsed.toString() });
        return;
      }

      dispatch({ type: 'set-status', status: 'connecting' });
      const socket = state.target.subprotocol ? new WebSocket(parsed.toString(), state.target.subprotocol) : new WebSocket(parsed.toString());
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;
      socket.addEventListener('open', () => dispatch({ type: 'set-status', status: 'open' }));
      socket.addEventListener('close', () => dispatch({ type: 'set-status', status: 'closed' }));
      socket.addEventListener('error', () => dispatch({ type: 'set-status', status: 'error', error: 'WebSocket connection failed.' }));
      socket.addEventListener('message', async (event) => {
        const payload = await summarizeWebSocketMessageData(event.data);
        dispatch({
          type: 'add-frame',
          frame: createFrame({
            direction: 'inbound',
            url: parsed.toString(),
            body: payload.body,
            metadata: payload.metadata,
          }),
        });
      });
    } catch (error) {
      dispatch({ type: 'set-status', status: 'error', error: readableError(error) });
    }
  }

  function stop() {
    if (state.target.engine === 'page' && transport === 'page') {
      postPageCommand({ type: 'stop' });
      dispatch({ type: 'set-status', status: 'closed' });
      return;
    }

    socketRef.current?.close();
    socketRef.current = null;
    dispatch({ type: 'set-status', status: 'closed' });
  }

  function sendBody(body: string): boolean {
    if (state.target.engine === 'page') {
      if (transport !== 'page') {
        dispatch({ type: 'set-status', status: 'error', error: 'Page engine is available only in the Direct Page Overlay.' });
        return false;
      }
      if (state.status !== 'open') {
        dispatch({ type: 'set-status', status: 'error', error: 'Connect before sending a frame.' });
        return false;
      }
      postPageCommand({ type: 'send', body });
      return true;
    }

    if (state.status !== 'open' || !socketRef.current) {
      dispatch({ type: 'set-status', status: 'error', error: 'Connect before sending a frame.' });
      return false;
    }

    socketRef.current.send(body);
    dispatch({ type: 'add-frame', frame: createFrame({ direction: 'outbound', url: state.target.socketUrl, body }) });
    return true;
  }

  function resendSelected() {
    if (!selectedFrame) return;
    sendBody(selectedFrame.body);
  }

  async function runSecurityTest() {
    const request: SecurityRunRequest = {
      test: selectedTest,
      target: state.target,
      authorizationConfirmed: state.authorizationConfirmed,
      payload: securityPayload,
      note: securityNote,
    };
    const readiness = canRunSecurityTest(request);
    if (!readiness.ok) {
      const result = await createEvidenceRecord(request, 'blocked', readiness.reason);
      dispatch({ type: 'add-evidence', result });
      return;
    }

    if (selectedTest.mode === 'passive') {
      dispatch({ type: 'add-evidence', result: await runPassiveSecurityTest(request) });
      return;
    }

    sendBody(securityPayload);
    dispatch({ type: 'add-evidence', result: await createEvidenceRecord(request, 'running', 'Active payload sent; record server response from frame stream.') });
  }

  async function copySelected() {
    const body = selectedFrame?.body ?? state.editorBody;
    await navigator.clipboard.writeText(body);
  }

  function exportEvidence() {
    const blob = new Blob([exportEvidenceMarkdown(state.evidence)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'websocket-security-evidence.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleInjectOverlay() {
    if (state.target.tabId === null) return;
    await injectOverlay(state.target.tabId);
  }

  async function handleDebuggerCapture() {
    if (state.target.tabId === null) return;
    const granted = await requestDebuggerCapture(state.target.tabId);
    dispatch({ type: 'set-debugger-capture', enabled: granted });
  }

  async function hydrateDiscoverySnapshot(tabId: number | null) {
    if (tabId === null) return;

    try {
      dispatch({ type: 'set-discovery-snapshot', snapshot: await getWebSocketDiscoverySnapshot(tabId) });
    } catch (error: unknown) {
      console.error('[ws-workbench] failed to hydrate WebSocket discovery state', error);
    }
  }

  async function handleStartDiscovery() {
    if (state.target.tabId === null) {
      dispatch({ type: 'set-status', status: 'error', error: 'WebSocket discovery requires a resolved tab id.' });
      return;
    }

    setDiscoveryBusy(true);
    try {
      dispatch({ type: 'set-discovery-snapshot', snapshot: await startWebSocketDiscovery(state.target.tabId) });
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function handleStopDiscovery() {
    if (state.target.tabId === null) return;

    setDiscoveryBusy(true);
    try {
      dispatch({ type: 'set-discovery-snapshot', snapshot: await stopWebSocketDiscovery(state.target.tabId) });
    } finally {
      setDiscoveryBusy(false);
    }
  }

  async function handleDiscoveryReload() {
    if (state.target.tabId === null) {
      dispatch({ type: 'set-status', status: 'error', error: 'Capture with reload requires a resolved tab id.' });
      return;
    }

    setDiscoveryBusy(true);
    try {
      dispatch({ type: 'set-discovery-snapshot', snapshot: await captureWebSocketDiscoveryWithReload(state.target.tabId) });
    } finally {
      setDiscoveryBusy(false);
    }
  }

  function addObservedSocketEvidence(socket: DiscoveredSocket) {
    dispatch({ type: 'add-evidence', result: createObservedSocketEvidenceRecord({ socket, snapshot: state.discovery, target: state.target }) });
  }

  function importDiscoveredTarget(socket: DiscoveredSocket) {
    const recipe = createConnectionRecipe({ socket, target: state.target, selectedFrameIds: [] });
    dispatch({ type: 'import-connection-recipe', recipe });
    dispatch({ type: 'add-evidence', result: createRecipeImportEvidenceRecord(recipe, 'Imported target only. No connection opened and no frames sent.') });
  }

  function importDiscoveredBootstrap(socket: DiscoveredSocket, frameIds: string[]) {
    const recipe = createConnectionRecipe({ socket, target: state.target, selectedFrameIds: frameIds });
    dispatch({ type: 'import-connection-recipe', recipe });
    dispatch({ type: 'add-evidence', result: createRecipeImportEvidenceRecord(recipe, 'Imported with selected bootstrap frames queued for explicit replay.') });
  }

  function replayBootstrapRecipe() {
    const recipe = state.pendingBootstrapRecipe;
    if (!recipe) return;
    if (state.status !== 'open') {
      dispatch({ type: 'set-status', status: 'error', error: 'Connect the imported target before replaying bootstrap frames.' });
      return;
    }

    recipe.bootstrapFrames.forEach((frame) => sendBody(frame.body));
    dispatch({ type: 'add-evidence', result: createBootstrapReplayEvidenceRecord(recipe) });
    dispatch({ type: 'clear-bootstrap-recipe' });
  }

  async function hydrateReplayLibrary() {
    dispatch({ type: 'set-replay-library-status', status: 'loading' });
    try {
      dispatch({ type: 'set-replay-library', artifacts: await loadReplayLibrary() });
    } catch (error: unknown) {
      dispatch({ type: 'set-replay-library-status', status: 'error', error: readableError(error) });
    }
  }

  async function saveReplayArtifactAndHydrate(artifact: SavedSocketRecipe | SavedMessageSet) {
    try {
      const artifacts = await saveReplayArtifact(artifact);
      dispatch({ type: 'set-replay-library', artifacts });
      setReplayMessage('Replay artifact saved locally. Saved replay payloads may contain secrets.');
    } catch (error: unknown) {
      dispatch({ type: 'set-replay-library-status', status: 'error', error: readableError(error) });
      setReplayMessage(readableError(error));
    }
  }

  function saveCurrentTargetRecipe() {
    if (!state.target.socketUrl) {
      dispatch({ type: 'set-status', status: 'error', error: 'Select a WebSocket target before saving a replay recipe.' });
      return;
    }
    void saveReplayArtifactAndHydrate(createSavedSocketRecipeFromTarget({ target: state.target }));
  }

  function saveCurrentOutboundMessages() {
    const selectedOutboundIds = selectedFrame?.direction === 'outbound' ? [selectedFrame.id] : state.frames.filter((frame) => frame.direction === 'outbound').map((frame) => frame.id);
    const messageSet = createSavedMessageSetFromControlledFrames({
      frames: state.frames,
      target: state.target,
      selectedFrameIds: selectedOutboundIds,
    });
    if (messageSet.messages.length === 0) {
      dispatch({ type: 'set-status', status: 'error', error: 'No outbound text frames are available to save for replay.' });
      return;
    }
    void saveReplayArtifactAndHydrate(messageSet);
  }

  function saveDiscoveredSocketRecipe(socket: DiscoveredSocket) {
    void saveReplayArtifactAndHydrate(createSavedSocketRecipeFromDiscovery({ socket, target: state.target }));
  }

  function saveDiscoveredMessageSet(socket: DiscoveredSocket, frameIds: string[]) {
    const messageSet = createSavedMessageSetFromDiscoveredFrames({ socket, selectedFrameIds: frameIds });
    if (messageSet.messages.length === 0) {
      dispatch({ type: 'set-status', status: 'error', error: 'Select text outbound bootstrap frames before saving messages.' });
      return;
    }
    void saveReplayArtifactAndHydrate(messageSet);
  }

  function loadReplayQueue(socketRecipeId: string, messageSetId: string) {
    const socketRecipe = state.replayLibrary.find((artifact): artifact is SavedSocketRecipe => artifact.kind === 'saved-socket-recipe' && artifact.id === socketRecipeId);
    const messageSet = state.replayLibrary.find((artifact): artifact is SavedMessageSet => artifact.kind === 'saved-message-set' && artifact.id === messageSetId);
    if (!socketRecipe || !messageSet) {
      dispatch({ type: 'set-status', status: 'error', error: 'Select a saved socket recipe and message set before loading replay.' });
      return;
    }
    const queue = createReplayQueue({ socketRecipe, messageSet });
    dispatch({ type: 'load-replay-queue', queue });
    setReplayMessage(queue.sourceMismatch ? queue.mismatchReason ?? 'Replay queue source differs from socket target.' : 'Replay queue loaded. Connect before sending.');
  }

  async function deleteSavedReplayArtifact(artifactId: string) {
    try {
      const artifacts = await deleteReplayArtifact(artifactId);
      dispatch({ type: 'set-replay-library', artifacts });
      dispatch({ type: 'remove-replay-artifact', artifactId });
      setReplayMessage('Replay artifact deleted. Evidence records were left unchanged.');
    } catch (error: unknown) {
      setReplayMessage(readableError(error));
    }
  }

  async function clearSavedReplayLibrary() {
    if (!window.confirm('Clear saved replay artifacts from local storage? Evidence records and current frames stay unchanged.')) return;
    await clearReplayLibrary();
    dispatch({ type: 'clear-replay-library' });
    setReplayMessage('Replay library cleared.');
  }

  function exportSavedReplayArtifacts(artifactIds: string[]) {
    const artifacts = state.replayLibrary.filter((artifact) => artifactIds.includes(artifact.id));
    if (artifacts.length === 0) return;
    if (!window.confirm('Export raw replay payloads? The JSON may contain secrets.')) return;
    const blob = new Blob([exportReplayArtifacts(artifacts, true)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'websocket-replay-artifacts.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importSavedReplayArtifacts(json: string) {
    try {
      const imported = importReplayArtifactsJson(json);
      const artifacts = await saveReplayArtifacts(imported);
      dispatch({ type: 'set-replay-library', artifacts });
      setReplayMessage(`${imported.length} replay artifact${imported.length === 1 ? '' : 's'} imported.`);
    } catch (error: unknown) {
      setReplayMessage(readableError(error));
      dispatch({ type: 'set-replay-library-status', status: 'error', error: readableError(error) });
    }
  }

  function editReplayItem(itemId: string, body: string) {
    if (!state.activeReplayQueue) return;
    const nextQueue = editReplayQueueItem(state.activeReplayQueue, itemId, body);
    const nextItem = nextQueue.items.find((item) => item.id === itemId);
    if (!nextItem) return;
    dispatch({ type: 'edit-replay-queue-item', itemId, body: nextItem.body, preview: nextItem.preview, updatedAt: nextItem.updatedAt });
  }

  function sendReplayNext() {
    const queue = state.activeReplayQueue;
    if (!queue) return;
    const next = queue.items.find((item) => item.status !== 'sent' && state.selectedReplayQueueItemIds.includes(item.id)) ?? queue.items.find((item) => item.status !== 'sent');
    if (next) sendReplayItems([next]);
  }

  function sendReplaySelected() {
    const queue = state.activeReplayQueue;
    if (!queue) return;
    sendReplayItems(queue.items.filter((item) => item.status !== 'sent' && state.selectedReplayQueueItemIds.includes(item.id)));
  }

  function sendReplayAll() {
    const queue = state.activeReplayQueue;
    if (!queue) return;
    sendReplayItems(queue.items.filter((item) => item.status !== 'sent'));
  }

  function sendReplayItems(items: ReplayQueueItem[]) {
    if (!state.activeReplayQueue || items.length === 0) return;
    if (state.status !== 'open') {
      dispatch({ type: 'set-status', status: 'error', error: 'Connect before replaying queued messages.' });
      return;
    }
    if (!state.activeReplayRun || state.activeReplayRun.status !== 'running') {
      dispatch({ type: 'start-replay-run', run: createReplayRun(state.activeReplayQueue) });
    }
    for (const item of items) {
      if (state.status !== 'open') {
        finishReplayRun('partial');
        return;
      }
      const sent = sendBody(item.body);
      if (!sent) {
        finishReplayRun('failed');
        return;
      }
      dispatch({ type: 'mark-replay-item-sent', itemId: item.id, sentAt: new Date().toISOString() });
    }
  }

  function finishReplayRun(requestedStatus: ReplayRunStatus = 'completed') {
    const queue = state.activeReplayQueue;
    const run = state.activeReplayRun;
    if (!queue || !run || run.status !== 'running') return;
    const endedAt = new Date().toISOString();
    const unsentIds = queue.items.filter((item) => item.status !== 'sent').map((item) => item.id);
    const status = requestedStatus === 'completed' && unsentIds.length > 0 ? 'partial' : requestedStatus;
    const inboundFrames = state.frames.filter((frame) => frame.direction === 'inbound' && frame.timestamp >= run.startedAt);
    const finalRun = {
      ...run,
      status,
      endedAt,
      inboundFrameIds: inboundFrames.map((frame) => frame.id),
      unsentMessageIds: unsentIds,
    };
    dispatch({ type: 'finish-replay-run', status, endedAt, inboundFrameIds: finalRun.inboundFrameIds });
    dispatch({ type: 'add-evidence', result: createReplayRunEvidenceRecord({ queue, run: finalRun, inboundTranscriptPreviews: inboundFrames.map((frame) => frame.body) }) });
  }

  async function hydrateDebugLabState(tabId: number | null) {
    if (tabId === null) return;

    try {
      const labState = await getDebugLabState(tabId);
      dispatch({ type: 'set-page-csp-bypass', enabled: labState.pageCspBypassEnabled });
      dispatch({ type: 'set-csp-header-strip', enabled: labState.pageCspHeaderStripEnabled });
    } catch (error: unknown) {
      console.error('[ws-workbench] failed to hydrate Debug Lab state', error);
    }
  }

  async function handlePageCspBypassToggle() {
    await applyPageCspBypass(!state.target.pageCspBypassEnabled);
  }

  async function applyPageCspBypass(enabled: boolean) {
    if (state.target.tabId === null) {
      dispatch({ type: 'set-status', status: 'error', error: 'Page CSP bypass requires a resolved tab id.' });
      return;
    }

    setDebugLabBusy(true);
    try {
      const result = await setPageCspBypass(state.target.tabId, enabled);
      if (!result.ok) {
        const error = result.error ?? 'Unable to update page CSP bypass.';
        dispatch({ type: 'set-status', status: 'error', error });
        setDebugLabMessage(error);
        return;
      }

      dispatch({ type: 'set-page-csp-bypass', enabled: result.enabled });
      setDebugLabMessage(result.enabled ? 'CDP CSP bypass enabled. Reconnect the Page engine socket.' : 'CDP CSP bypass disabled.');
    } finally {
      setDebugLabBusy(false);
    }
  }

  async function handleCspHeaderStripToggle() {
    if (state.target.tabId === null) {
      const error = 'CSP header stripping requires a resolved tab id.';
      dispatch({ type: 'set-status', status: 'error', error });
      setDebugLabMessage(error);
      return;
    }

    setDebugLabBusy(true);
    try {
      const result = await setCspHeaderStrip(state.target.tabId, !state.target.pageCspHeaderStripEnabled, true);
      if (!result.ok) {
        const error = result.error ?? 'Unable to update CSP header stripping.';
        dispatch({ type: 'set-status', status: 'error', error });
        setDebugLabMessage(error);
        return;
      }

      dispatch({ type: 'set-csp-header-strip', enabled: result.enabled });
      setDebugLabMessage(result.enabled ? 'CSP header stripping enabled. The tab was reloaded; open Direct Page Overlay again if it disappeared.' : 'CSP header stripping disabled. The tab was reloaded.');
    } finally {
      setDebugLabBusy(false);
    }
  }

  async function handleCspMetaProbe() {
    if (state.target.tabId === null) {
      const error = 'CSP meta probe requires a resolved tab id.';
      dispatch({ type: 'set-status', status: 'error', error });
      setDebugLabMessage(error);
      return;
    }

    setDebugLabBusy(true);
    try {
      const result = await injectCspMetaProbe(state.target.tabId);
      if (!result.ok) {
        const error = result.error ?? 'Unable to inject CSP meta probe.';
        dispatch({ type: 'set-status', status: 'error', error });
        setDebugLabMessage(error);
        return;
      }

      dispatch({ type: 'set-csp-meta-probe', injected: result.injected });
      setDebugLabMessage(result.message ?? 'Meta CSP probe injected.');
    } finally {
      setDebugLabBusy(false);
    }
  }

  return (
    <main className={`app-shell surface-${surface}`}>
      <section className="top-strip" aria-label="Target context">
        <div className="target-block" title={state.target.tabOrigin}>
          <span className="label">Origin</span>
          <strong className="origin-value">
            <span className={`origin-dot origin-${state.status}`} aria-hidden="true" />
            {compactOrigin(state.target.tabOrigin)}
          </strong>
        </div>

        <label className="url-field">
          <span className="label">Socket URL</span>
          <input value={state.target.socketUrl} onChange={(event) => dispatch({ type: 'set-target-url', url: event.target.value })} placeholder="wss://example.com/socket" />
        </label>

        <label className="test-endpoint-field">
          <span className="label">Test</span>
          <select
            aria-label="Test endpoint"
            value={selectedTestEndpointUrl}
            disabled={socketIsActive}
            title={selectedTestEndpoint ? `${selectedTestEndpoint.label}: ${selectedTestEndpoint.url}` : 'Custom Socket URL'}
            onChange={(event) => {
              if (event.target.value) dispatch({ type: 'set-target-url', url: event.target.value });
            }}
          >
            <option value="">Custom</option>
            {testEndpointPresets.map((preset) => (
              <option key={preset.url} value={preset.url}>
                {preset.shortLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="engine-field">
          <span className="label">Engine</span>
          <select
            value={state.target.engine}
            disabled={socketIsActive}
            onChange={(event) => dispatch({ type: 'set-engine', engine: event.target.value as 'extension' | 'page' })}
          >
            <option value="extension">Extension</option>
            <option value="page">Page</option>
          </select>
        </label>

        {showPageCspBypass ? (
          <div className="csp-bypass-field">
            <span className="label">Page CSP</span>
            <button
              type="button"
              className={state.target.pageCspBypassEnabled ? 'csp-bypass-toggle active' : 'csp-bypass-toggle'}
              onClick={handlePageCspBypassToggle}
              disabled={socketIsActive || state.target.tabId === null}
              title="Use Chrome debugger Page.setBypassCSP for this tab"
              aria-label={state.target.pageCspBypassEnabled ? 'Disable page CSP bypass' : 'Enable page CSP bypass'}
            >
              <ShieldAlert size={14} />
              {state.target.pageCspBypassEnabled ? 'On' : 'Bypass'}
            </button>
          </div>
        ) : null}

        <div className="connection-field" aria-label="Connection controls">
          <div className="connection-controls">
            <button type="button" className={`socket-toggle ${socketIsActive ? 'danger' : 'primary'}`} onClick={socketIsActive ? stop : connect} title={socketIsActive ? 'Stop' : 'Connect'} aria-label={socketIsActive ? 'Stop WebSocket' : 'Connect WebSocket'}>
              {socketIsActive ? <Square size={15} /> : <Plug size={15} />}
              {socketIsActive ? 'Stop' : 'Connect'}
            </button>
            <ConnectionStatusIcon status={state.status} />
          </div>
        </div>
      </section>

      <p className={state.error ? 'error-line' : 'error-line empty'} aria-live="polite">
        {state.error ?? ''}
      </p>

      <nav className="tabs" aria-label="Workbench sections">
        {[
          { id: 'debugger', label: 'Debugger', ariaLabel: 'Debugger', icon: Activity },
          { id: 'discover', label: 'Discover', ariaLabel: 'Discover WebSockets', icon: Search },
          { id: 'replay', label: 'Replay', ariaLabel: 'Replay Library', icon: Upload },
          { id: 'security', label: 'Security', ariaLabel: 'Security Lab', icon: ShieldAlert },
          { id: 'debug-lab', label: 'Debug Lab', ariaLabel: 'Debug Lab', icon: FlaskConical },
          { id: 'evidence', label: 'Evidence', ariaLabel: 'Evidence', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" aria-label={tab.ariaLabel} className={state.activeTab === tab.id ? 'active' : ''} onClick={() => dispatch({ type: 'set-active-tab', tab: tab.id as typeof state.activeTab })}>
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {state.activeTab === 'debugger' ? (
        <DebuggerView
          frames={filteredFrames}
          selectedFrame={selectedFrame}
          search={state.search}
          direction={state.directionFilter}
          editorBody={state.editorBody}
          onSearch={(search) => dispatch({ type: 'set-search', search })}
          onDirection={(direction) => dispatch({ type: 'set-direction-filter', direction })}
          onSelect={(frameId) => dispatch({ type: 'select-frame', frameId })}
          onEditor={(body) => dispatch({ type: 'set-editor-body', body })}
          onSend={() => sendBody(state.editorBody)}
          onResend={resendSelected}
          onCopy={copySelected}
          onClear={() => dispatch({ type: 'clear-frames' })}
          pendingBootstrapRecipe={state.pendingBootstrapRecipe}
          activeReplayQueue={state.activeReplayQueue}
          selectedReplayQueueItemIds={state.selectedReplayQueueItemIds}
          connectionStatus={state.status}
          onReplayBootstrap={replayBootstrapRecipe}
          onClearBootstrap={() => dispatch({ type: 'clear-bootstrap-recipe' })}
          onToggleReplayItem={(itemId, selected) => dispatch({ type: 'toggle-replay-queue-item', itemId, selected })}
          onEditReplayItem={editReplayItem}
          onSendReplayNext={sendReplayNext}
          onSendReplaySelected={sendReplaySelected}
          onSendReplayAll={sendReplayAll}
          onFinishReplayRun={() => finishReplayRun('completed')}
          onCancelReplayRun={() => finishReplayRun('cancelled')}
          onClearReplayQueue={() => dispatch({ type: 'clear-replay-queue' })}
        />
      ) : null}

      {state.activeTab === 'discover' ? (
        <DiscoverView
          snapshot={state.discovery}
          selectedSocket={selectedDiscoveredSocket}
          selectedRequestId={state.selectedDiscoveryRequestId}
          busy={discoveryBusy}
          onStart={handleStartDiscovery}
          onStop={handleStopDiscovery}
          onCaptureReload={handleDiscoveryReload}
          onSelectSocket={(requestId) => dispatch({ type: 'select-discovered-socket', requestId })}
          onImportTarget={importDiscoveredTarget}
          onImportBootstrap={importDiscoveredBootstrap}
          onSaveSocket={saveDiscoveredSocketRecipe}
          onSaveBootstrap={saveDiscoveredMessageSet}
          onAddEvidence={addObservedSocketEvidence}
        />
      ) : null}

      {state.activeTab === 'replay' ? (
        <ReplayLibraryView
          artifacts={state.replayLibrary}
          status={state.replayLibraryStatus}
          error={state.replayLibraryError ?? (replayMessage || null)}
          onRefresh={hydrateReplayLibrary}
          onSaveCurrentTarget={saveCurrentTargetRecipe}
          onSaveCurrentOutbound={saveCurrentOutboundMessages}
          onLoadQueue={loadReplayQueue}
          onDelete={(artifactId) => void deleteSavedReplayArtifact(artifactId)}
          onClearLibrary={() => void clearSavedReplayLibrary()}
          onExport={exportSavedReplayArtifacts}
          onImportJson={(json) => void importSavedReplayArtifacts(json)}
        />
      ) : null}

      {state.activeTab === 'security' ? (
        <SecurityView
          surface={surface}
          targetOrigin={compactOrigin(state.target.tabOrigin)}
          socketUrl={state.target.socketUrl}
          selectedTestId={state.selectedTestId}
          authorizationConfirmed={state.authorizationConfirmed}
          payload={securityPayload}
          note={securityNote}
          debuggerCaptureEnabled={state.target.debuggerCaptureEnabled}
          onSelectTest={(testId) => dispatch({ type: 'select-test', testId })}
          onAuthorization={(confirmed) => dispatch({ type: 'set-authorization', confirmed })}
          onPayload={setSecurityPayload}
          onNote={setSecurityNote}
          onRun={runSecurityTest}
          onInjectOverlay={handleInjectOverlay}
          onDebuggerCapture={handleDebuggerCapture}
        />
      ) : null}

      {state.activeTab === 'debug-lab' ? (
        <DebugLabView
          targetOrigin={compactOrigin(state.target.tabOrigin)}
          surface={surface}
          cdpBypassEnabled={state.target.pageCspBypassEnabled}
          headerStripEnabled={state.target.pageCspHeaderStripEnabled}
          metaProbeInjected={state.target.pageCspMetaProbeInjected}
          busy={debugLabBusy}
          message={debugLabMessage}
          onCdpBypass={() => applyPageCspBypass(!state.target.pageCspBypassEnabled)}
          onHeaderStrip={handleCspHeaderStripToggle}
          onMetaProbe={handleCspMetaProbe}
        />
      ) : null}

      {state.activeTab === 'evidence' ? <EvidenceView records={state.evidence} onExport={exportEvidence} /> : null}
    </main>
  );
}

function ConnectionStatusIcon(props: { status: ConnectionStatus }) {
  const Icon = props.status === 'connecting' ? RefreshCw : props.status === 'error' || props.status === 'stale' ? ShieldAlert : props.status === 'open' ? Activity : Square;
  return (
    <span className={`status-icon status-${props.status}`} title={`Status: ${props.status}`} aria-label={`Connection status: ${props.status}`} role="img">
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
      <span className="sr-only">{props.status}</span>
    </span>
  );
}

function DebuggerView(props: {
  frames: FrameRecord[];
  selectedFrame: FrameRecord | null;
  search: string;
  direction: 'all' | 'inbound' | 'outbound';
  editorBody: string;
  onSearch: (value: string) => void;
  onDirection: (value: 'all' | 'inbound' | 'outbound') => void;
  onSelect: (frameId: string | null) => void;
  onEditor: (value: string) => void;
  onSend: () => void;
  onResend: () => void;
  onCopy: () => void;
  onClear: () => void;
  pendingBootstrapRecipe: ConnectionRecipe | null;
  activeReplayQueue: ReplayQueue | null;
  selectedReplayQueueItemIds: string[];
  connectionStatus: ConnectionStatus;
  onReplayBootstrap: () => void;
  onClearBootstrap: () => void;
  onToggleReplayItem: (itemId: string, selected: boolean) => void;
  onEditReplayItem: (itemId: string, body: string) => void;
  onSendReplayNext: () => void;
  onSendReplaySelected: () => void;
  onSendReplayAll: () => void;
  onFinishReplayRun: () => void;
  onCancelReplayRun: () => void;
  onClearReplayQueue: () => void;
}) {
  const inboundCount = props.frames.filter((frame) => frame.direction === 'inbound').length;
  const outboundCount = props.frames.length - inboundCount;
  const selectedBinaryFrame = props.selectedFrame?.metadata.payloadKind === 'binary';

  return (
    <section className="debugger-area">
      <div className="stream-pane">
        <div className="frame-strip">
          <label className="search-field">
            <Search size={14} aria-hidden="true" />
            <input aria-label="Search frames" value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search payload" />
          </label>
          <select aria-label="Direction filter" value={props.direction} onChange={(event) => props.onDirection(event.target.value as 'all' | 'inbound' | 'outbound')}>
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <button type="button" className="icon-button" onClick={props.onCopy} title="Copy selected frame">
            <Copy size={15} />
          </button>
          <button type="button" className="icon-button" onClick={props.onClear} title="Clear frames">
            <Eraser size={15} />
          </button>
        </div>

        <div className="stream-summary" aria-label="Frame stream summary">
          <span>{props.frames.length} frames</span>
          <span>{inboundCount} inbound</span>
          <span>{outboundCount} outbound</span>
        </div>

        <div className="frame-header" aria-hidden="true">
          <span>Dir</span>
          <span>Time</span>
          <span>Length</span>
          <span>Wire</span>
          <span>Data Preview</span>
        </div>

        <ol className="frame-list" aria-label="Frame stream">
          {props.frames.length === 0 ? (
            <li className="empty-state">No frames captured.</li>
          ) : (
            props.frames.map((frame) => (
              <li key={frame.id}>
                <button type="button" className={props.selectedFrame?.id === frame.id ? 'selected frame-row' : 'frame-row'} onClick={() => props.onSelect(frame.id)}>
                  <DirectionMarker direction={frame.direction} />
                  <time className="frame-time">{formatFrameTime(frame.timestamp)}</time>
                  <span className="frame-size">{formatFrameBytes(frame)}</span>
                  <span className={`frame-wire ${frame.metadata.payloadKind === 'binary' ? 'binary' : 'text'}`}>{frame.metadata.payloadKind === 'binary' ? 'binary' : 'text'}</span>
                  <span className="frame-body">{frame.body}</span>
                </button>
              </li>
            ))
          )}
        </ol>
      </div>

      <div className="editor-column">
        <div className="editor-tabs">
          <button type="button" className={props.selectedFrame ? '' : 'active'} onClick={() => props.onSelect(null)}>
            Compose
          </button>
          <button type="button" className={props.selectedFrame ? 'active' : ''} disabled={!props.selectedFrame}>
            Frame Inspector
          </button>
          {props.selectedFrame ? (
            <div className="selected-meta" aria-label="Selected frame metadata">
              <DirectionMarker direction={props.selectedFrame.direction} />
              <span>{formatFrameTime(props.selectedFrame.timestamp)}</span>
              <span>{formatFrameBytes(props.selectedFrame)}</span>
              <span>{props.selectedFrame.metadata.payloadKind === 'binary' ? 'binary wire' : 'text'}</span>
            </div>
          ) : null}
        </div>

        {selectedBinaryFrame && props.selectedFrame ? (
          <div className="wire-inspector" aria-label="Binary wire inspector">
            <dl>
              <div>
                <dt>Encoding</dt>
                <dd>{props.selectedFrame.metadata.wireEncoding ?? 'binary'}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{formatFrameBytes(props.selectedFrame)}</dd>
              </div>
              <div>
                <dt>Hex preview</dt>
                <dd>{props.selectedFrame.metadata.wirePreviewHex ?? props.selectedFrame.body}</dd>
              </div>
              <div>
                <dt>Base64 preview</dt>
                <dd>{props.selectedFrame.metadata.wirePreviewBase64 ?? 'unavailable'}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <textarea aria-label="Payload editor" value={props.editorBody} onChange={(event) => props.onEditor(event.target.value)} placeholder="Enter JSON or text payload" />
        )}

        {props.pendingBootstrapRecipe ? (
          <div className="bootstrap-queue" aria-label="Queued bootstrap replay">
            <div>
              <span className="label">Bootstrap Queue</span>
              <strong>{props.pendingBootstrapRecipe.bootstrapFrames.length} selected frame{props.pendingBootstrapRecipe.bootstrapFrames.length === 1 ? '' : 's'}</strong>
              <span>Source request {props.pendingBootstrapRecipe.sourceRequestId}</span>
            </div>
            <button type="button" className="primary-action" onClick={props.onReplayBootstrap} disabled={props.connectionStatus !== 'open'}>
              <Upload size={16} /> Replay bootstrap
            </button>
            <button type="button" onClick={props.onClearBootstrap}>
              <Eraser size={16} /> Clear queue
            </button>
          </div>
        ) : null}

        {props.activeReplayQueue ? (
          <ReplayQueuePanel
            queue={props.activeReplayQueue}
            connectionStatus={props.connectionStatus}
            selectedIds={props.selectedReplayQueueItemIds}
            onToggleItem={props.onToggleReplayItem}
            onEditItem={props.onEditReplayItem}
            onSendNext={props.onSendReplayNext}
            onSendSelected={props.onSendReplaySelected}
            onSendAll={props.onSendReplayAll}
            onFinish={props.onFinishReplayRun}
            onCancel={props.onCancelReplayRun}
            onClear={props.onClearReplayQueue}
          />
        ) : null}

        <div className="editor-actions">
          <button type="button" className="primary-action" onClick={props.onSend} disabled={selectedBinaryFrame}>
            <SendHorizontal size={16} /> Send
          </button>
          <button type="button" onClick={props.onResend} disabled={!props.selectedFrame || selectedBinaryFrame}>
            <RefreshCw size={16} /> Resend selected
          </button>
        </div>
      </div>
    </section>
  );
}

function DirectionMarker(props: { direction: 'inbound' | 'outbound' }) {
  const Icon = props.direction === 'inbound' ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`direction-marker ${props.direction}`} title={props.direction} aria-label={props.direction}>
      <Icon size={13} strokeWidth={2.4} />
    </span>
  );
}

function SecurityView(props: {
  surface: 'popup' | 'devtools' | 'sidepanel' | 'page-overlay';
  targetOrigin: string;
  socketUrl: string;
  selectedTestId: string;
  authorizationConfirmed: boolean;
  payload: string;
  note: string;
  debuggerCaptureEnabled: boolean;
  onSelectTest: (value: string) => void;
  onAuthorization: (value: boolean) => void;
  onPayload: (value: string) => void;
  onNote: (value: string) => void;
  onRun: () => void;
  onInjectOverlay: () => void;
  onDebuggerCapture: () => void;
}) {
  const selectedTest = getSecurityTest(props.selectedTestId);
  return (
    <section className="security-area">
      <aside className="test-list" aria-label="Security tests">
        {securityTests.map((test) => (
          <button key={test.id} type="button" className={props.selectedTestId === test.id ? 'selected test-button' : 'test-button'} onClick={() => props.onSelectTest(test.id)}>
            <span>{test.title}</span>
            <small>{test.category} / {test.mode}</small>
          </button>
        ))}
      </aside>

      <article className="test-detail">
        <div className="target-context">
          <strong>Target origin: {props.targetOrigin}</strong>
          <span>Socket: {props.socketUrl || 'not selected'}</span>
          <span>Context: {contextLabel(props.surface)}</span>
        </div>
        <div className="detail-heading">
          <ShieldAlert size={17} />
          <h2>{selectedTest.title}</h2>
          <span className={`mode-pill mode-${selectedTest.mode}`}>{selectedTest.mode}</span>
        </div>
        <p>{selectedTest.description}</p>
        <ul>
          {selectedTest.preconditions.map((precondition) => (
            <li key={precondition}>{precondition}</li>
          ))}
        </ul>
        <label className="toggle-row">
          <input type="checkbox" checked={props.authorizationConfirmed} onChange={(event) => props.onAuthorization(event.target.checked)} />
          I am authorized to run active tests against this visible target
        </label>
        <textarea aria-label="Security payload" value={props.payload} onChange={(event) => props.onPayload(event.target.value)} />
        <input aria-label="Evidence note" value={props.note} onChange={(event) => props.onNote(event.target.value)} placeholder="Evidence note" />
        <div className="editor-actions">
          <button type="button" className="primary-action" onClick={props.onRun}>
            <ShieldAlert size={16} /> Run selected test
          </button>
          <button type="button" onClick={props.onInjectOverlay}>
            <PictureInPicture2 size={16} /> Overlay
          </button>
          <button type="button" onClick={props.onDebuggerCapture}>
            <Bug size={16} /> Capture {props.debuggerCaptureEnabled ? 'available' : 'check'}
          </button>
        </div>
      </article>
    </section>
  );
}

function DebugLabView(props: {
  targetOrigin: string;
  surface: AppProps['surface'];
  cdpBypassEnabled: boolean;
  headerStripEnabled: boolean;
  metaProbeInjected: boolean;
  busy: boolean;
  message: string;
  onCdpBypass: () => void;
  onHeaderStrip: () => void;
  onMetaProbe: () => void;
}) {
  return (
    <section className="debug-lab-area">
      <div className="target-context">
        <strong>Target origin: {props.targetOrigin}</strong>
        <span>Context: {contextLabel(props.surface)}</span>
      </div>

      <div className="debug-lab-grid" aria-label="CSP debug lab options">
        <article className="lab-option">
          <div className="detail-heading">
            <Bug size={17} />
            <h2>CDP bypass</h2>
            <span className={props.cdpBypassEnabled ? 'mode-pill mode-active' : 'mode-pill'}>{props.cdpBypassEnabled ? 'on' : 'tab'}</span>
          </div>
          <p>Page.setBypassCSP for this tab. Reconnect the Page engine socket after enabling.</p>
          <button type="button" className={props.cdpBypassEnabled ? 'danger' : 'primary-action'} onClick={props.onCdpBypass} disabled={props.busy}>
            <ShieldAlert size={16} /> {props.cdpBypassEnabled ? 'Disable CDP' : 'Enable CDP'}
          </button>
        </article>

        <article className="lab-option">
          <div className="detail-heading">
            <RefreshCw size={17} />
            <h2>Strip headers</h2>
            <span className={props.headerStripEnabled ? 'mode-pill mode-active' : 'mode-pill'}>{props.headerStripEnabled ? 'on' : 'reload'}</span>
          </div>
          <p>Session DNR rule removes CSP response headers for this tab, then reloads the page.</p>
          <button type="button" className={props.headerStripEnabled ? 'danger' : 'primary-action'} onClick={props.onHeaderStrip} disabled={props.busy}>
            <RefreshCw size={16} /> {props.headerStripEnabled ? 'Remove + reload' : 'Strip + reload'}
          </button>
        </article>

        <article className="lab-option">
          <div className="detail-heading">
            <FileText size={17} />
            <h2>Meta probe</h2>
            <span className={props.metaProbeInjected ? 'mode-pill mode-passive' : 'mode-pill'}>{props.metaProbeInjected ? 'injected' : 'probe'}</span>
          </div>
          <p>Injects a permissive meta CSP as a negative control. Header CSP still wins; meta refresh cannot change sockets.</p>
          <button type="button" onClick={props.onMetaProbe} disabled={props.busy}>
            <FileText size={16} /> Inject meta
          </button>
        </article>
      </div>

      <p className={props.message ? 'debug-lab-message' : 'debug-lab-message empty'} aria-live="polite">
        {props.message}
      </p>
    </section>
  );
}

function EvidenceView(props: { records: EvidenceRecord[]; onExport: () => void }) {
  return (
    <section className="evidence-area">
      <div className="evidence-toolbar">
        <div>
          <span className="label">Evidence Repository</span>
          <strong>{props.records.length} records</strong>
        </div>
        <button type="button" onClick={props.onExport}>
          <Upload size={16} /> Export Markdown
        </button>
      </div>
      <ol className="evidence-list">
        {props.records.length === 0 ? (
          <li className="empty-state">No evidence records.</li>
        ) : (
          props.records.map((record) => (
            <li key={record.id}>
              <strong>{evidenceTitle(record)}</strong>
              <span>{record.timestamp}</span>
              <span>{record.targetOrigin}</span>
              <code>{evidencePrimaryPreview(record)}</code>
              <span>{evidenceSecondaryPreview(record)}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function evidenceTitle(record: EvidenceRecord): string {
  if (record.kind === 'security-test') return record.testId;
  if (record.kind === 'observed-socket') return `observed ${record.sourceRequestId}`;
  if (record.kind === 'recipe-import') return `recipe ${record.sourceRequestId}`;
  if (record.kind === 'bootstrap-replay') return `bootstrap ${record.sourceRequestId}`;
  return `replay ${record.replayRunId}`;
}

function evidencePrimaryPreview(record: EvidenceRecord): string {
  if (record.kind === 'security-test') return record.payloadPreview;
  if (record.kind === 'observed-socket') return record.firstOutboundPreviews[0] ?? 'no outbound preview';
  if (record.kind === 'replay-run') return record.messagePreviews[0] ?? 'no replay messages';
  return record.bootstrapFramePreviews[0] ?? 'no bootstrap frames';
}

function evidenceSecondaryPreview(record: EvidenceRecord): string {
  if (record.kind === 'security-test') return record.responsePreview;
  if (record.kind === 'observed-socket') return `${record.frameCounts.outbound} outbound / ${record.frameCounts.inbound} inbound`;
  if (record.kind === 'recipe-import') return `${record.selectedEngine} import`;
  if (record.kind === 'replay-run') return `${record.status} replay run`;
  return `${record.replayedFrameCount} replayed`;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function compactOrigin(origin: string): string {
  return origin.replace(/^https?:\/\//, '');
}

function postPageCommand(message: { type: 'connect'; url: string; protocol?: string } | { type: 'send'; body: string } | { type: 'stop' }): void {
  window.postMessage({ source: pageUiSource, ...message }, '*');
}

function isPageEngineMessage(value: unknown): value is PageEngineMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.source !== 'ws-workbench-page-engine' || typeof record.type !== 'string') return false;
  if (record.type === 'status') return typeof record.status === 'string' && typeof record.message === 'string';
  return (
    record.type === 'frame' &&
    (record.direction === 'inbound' || record.direction === 'outbound') &&
    typeof record.body === 'string' &&
    typeof record.timestamp === 'string' &&
    (!('metadata' in record) || isStringRecord(record.metadata))
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && Object.values(value).every((entry) => typeof entry === 'string');
}

function contextLabel(surface: AppProps['surface']): string {
  if (surface === 'devtools') return 'DevTools inspected tab';
  if (surface === 'sidepanel') return 'Persistent side panel';
  if (surface === 'page-overlay') return 'Direct page overlay / MAIN-world socket';
  return 'Active tab popup';
}

function formatFrameTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${date.toTimeString().slice(0, 8)}.${ms}`;
}

function formatFrameBytes(frame: FrameRecord): string {
  const payloadLength = Number(frame.metadata.payloadLength);
  if (Number.isFinite(payloadLength)) return `${payloadLength} B`;
  return `${new Blob([frame.body]).size} B`;
}

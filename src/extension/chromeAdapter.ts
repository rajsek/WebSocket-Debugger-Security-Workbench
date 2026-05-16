import { parseRuntimeEvent } from '../domain/contracts';
import type { RuntimeCommand, RuntimeEvent, WebSocketCaptureSnapshot } from '../domain/types';
import { originFromTabUrl } from '../domain/url';

type TabContext = { tabId: number | null; origin: string };

export async function getActiveTabContext(): Promise<TabContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    tabId: tab?.id ?? null,
    origin: originFromTabUrl(tab?.url),
  };
}

export function subscribeActiveTabContext(onChange: (context: TabContext) => void): () => void {
  const refresh = () => {
    getActiveTabContext()
      .then(onChange)
      .catch((error: unknown) => console.error('[ws-workbench] failed to refresh active tab context', error));
  };
  const refreshOnComplete = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (changeInfo.status === 'complete' || typeof changeInfo.url === 'string') refresh();
  };

  chrome.tabs.onActivated.addListener(refresh);
  chrome.tabs.onUpdated.addListener(refreshOnComplete);
  chrome.windows.onFocusChanged.addListener(refresh);

  return () => {
    chrome.tabs.onActivated.removeListener(refresh);
    chrome.tabs.onUpdated.removeListener(refreshOnComplete);
    chrome.windows.onFocusChanged.removeListener(refresh);
  };
}

export function getDevtoolsTabContext(): { tabId: number; origin: string } {
  return {
    tabId: chrome.devtools.inspectedWindow.tabId,
    origin: 'unknown',
  };
}

export async function openWorkbenchSidePanel(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function sendCommand(command: RuntimeCommand): Promise<RuntimeEvent> {
  const response = await chrome.runtime.sendMessage(command);
  return parseRuntimeEvent(response);
}

export async function injectOverlay(tabId: number): Promise<RuntimeEvent> {
  return sendCommand({ version: 1, type: 'inject-overlay', tabId });
}

export async function injectPageOverlay(tabId: number): Promise<RuntimeEvent> {
  return sendCommand({ version: 1, type: 'inject-page-overlay', tabId });
}

export async function requestDebuggerCapture(tabId: number): Promise<boolean> {
  const event = await sendCommand({ version: 1, type: 'request-debugger-capture', tabId });
  return event.type === 'debugger-capture-permission' && event.granted;
}

export async function startWebSocketDiscovery(tabId: number): Promise<WebSocketCaptureSnapshot> {
  return discoverySnapshotFromEvent(await sendCommand({ version: 1, type: 'start-websocket-discovery', tabId }));
}

export async function stopWebSocketDiscovery(tabId: number): Promise<WebSocketCaptureSnapshot> {
  return discoverySnapshotFromEvent(await sendCommand({ version: 1, type: 'stop-websocket-discovery', tabId }));
}

export async function captureWebSocketDiscoveryWithReload(tabId: number): Promise<WebSocketCaptureSnapshot> {
  return discoverySnapshotFromEvent(await sendCommand({ version: 1, type: 'capture-websocket-discovery-with-reload', tabId }));
}

export async function getWebSocketDiscoverySnapshot(tabId: number): Promise<WebSocketCaptureSnapshot> {
  return discoverySnapshotFromEvent(await sendCommand({ version: 1, type: 'get-websocket-discovery-snapshot', tabId }));
}

export async function setPageCspBypass(tabId: number, enabled: boolean): Promise<{ enabled: boolean; ok: boolean; error?: string }> {
  const event = await sendCommand({ version: 1, type: 'set-page-csp-bypass', tabId, enabled });
  if (event.type !== 'page-csp-bypass-updated') {
    return { enabled: false, ok: false, error: 'Unexpected page CSP bypass response.' };
  }
  return { enabled: event.enabled, ok: event.ok, error: event.error };
}

export async function setCspHeaderStrip(tabId: number, enabled: boolean, reload: boolean): Promise<{ enabled: boolean; ok: boolean; reloaded: boolean; error?: string }> {
  const event = await sendCommand({ version: 1, type: 'set-csp-header-strip', tabId, enabled, reload });
  if (event.type !== 'csp-header-strip-updated') {
    return { enabled: false, ok: false, reloaded: false, error: 'Unexpected CSP header strip response.' };
  }
  return { enabled: event.enabled, ok: event.ok, reloaded: event.reloaded, error: event.error };
}

export async function injectCspMetaProbe(tabId: number): Promise<{ injected: boolean; ok: boolean; message?: string; error?: string }> {
  const event = await sendCommand({ version: 1, type: 'inject-csp-meta-probe', tabId });
  if (event.type !== 'csp-meta-probe-injected') {
    return { injected: false, ok: false, error: 'Unexpected CSP meta probe response.' };
  }
  return { injected: event.injected, ok: event.ok, message: event.message, error: event.error };
}

export async function getDebugLabState(tabId: number): Promise<{ pageCspBypassEnabled: boolean; pageCspHeaderStripEnabled: boolean }> {
  const event = await sendCommand({ version: 1, type: 'get-debug-lab-state', tabId });
  if (event.type !== 'debug-lab-state') {
    return { pageCspBypassEnabled: false, pageCspHeaderStripEnabled: false };
  }
  return {
    pageCspBypassEnabled: event.pageCspBypassEnabled,
    pageCspHeaderStripEnabled: event.pageCspHeaderStripEnabled,
  };
}

function discoverySnapshotFromEvent(event: RuntimeEvent): WebSocketCaptureSnapshot {
  if (
    event.type === 'websocket-discovery-status' ||
    event.type === 'websocket-discovery-snapshot' ||
    event.type === 'websocket-discovery-detached'
  ) {
    return event.snapshot;
  }
  throw new Error('Unexpected WebSocket discovery response.');
}

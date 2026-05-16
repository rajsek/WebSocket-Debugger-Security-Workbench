import { openWorkbenchSidePanel } from './chromeAdapter';
import { parseRuntimeCommand } from '../domain/contracts';
import type { RuntimeEvent } from '../domain/types';
import { createDiscoveryCaptureManager } from './discoveryCapture';

const cspBypassTabs = new Set<number>();
const cspHeaderStripTabs = new Set<number>();
const cspHeaderStripRuleBase = 800_000;
const discoveryCapture = createDiscoveryCaptureManager({
  debuggerApi: chrome.debugger,
  tabsApi: chrome.tabs,
});

chrome.action.onClicked.addListener(async (tab) => {
  if (typeof tab.id !== 'number') return;
  await openWorkbenchSidePanel();
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  discoveryCapture.handleDebuggerEvent(source, method, params);
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (typeof source.tabId === 'number') cspBypassTabs.delete(source.tabId);
  discoveryCapture.handleDebuggerDetach(source, reason);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cspBypassTabs.delete(tabId);
  cspHeaderStripTabs.delete(tabId);
  discoveryCapture.handleTabRemoved(tabId);
  void removeCspHeaderStripRule(tabId);
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      console.error('[ws-workbench] runtime command failed', error);
      sendResponse({ version: 1, type: 'page-session-stale', tabId: -1 } satisfies RuntimeEvent);
    });
  return true;
});

async function handleMessage(message: unknown): Promise<RuntimeEvent> {
  const command = parseRuntimeCommand(message);

  if (command.type === 'inject-overlay') {
    await chrome.scripting.executeScript({
      target: { tabId: command.tabId },
      func: importExtensionScript,
      args: ['assets/content.js'],
    });
    return { version: 1, type: 'overlay-injected', tabId: command.tabId };
  }

  if (command.type === 'inject-page-overlay') {
    await chrome.scripting.executeScript({
      target: { tabId: command.tabId },
      files: ['assets/pageEngine.js'],
      world: 'MAIN',
    });
    await chrome.scripting.executeScript({
      target: { tabId: command.tabId },
      func: importExtensionScript,
      args: ['assets/pageOverlay.js', { tabId: command.tabId }],
    });
    return { version: 1, type: 'page-overlay-injected', tabId: command.tabId };
  }

  if (command.type === 'request-debugger-capture') {
    const granted = await chrome.permissions.contains({ permissions: ['debugger'] });
    return { version: 1, type: 'debugger-capture-permission', tabId: command.tabId, granted };
  }

  if (command.type === 'start-websocket-discovery') {
    const snapshot = await discoveryCapture.start(command.tabId);
    return { version: 1, type: 'websocket-discovery-status', tabId: command.tabId, snapshot };
  }

  if (command.type === 'stop-websocket-discovery') {
    const snapshot = await discoveryCapture.stop(command.tabId, { detachDebugger: !cspBypassTabs.has(command.tabId) });
    return { version: 1, type: 'websocket-discovery-status', tabId: command.tabId, snapshot };
  }

  if (command.type === 'capture-websocket-discovery-with-reload') {
    const snapshot = await discoveryCapture.captureWithReload(command.tabId);
    return { version: 1, type: 'websocket-discovery-status', tabId: command.tabId, snapshot };
  }

  if (command.type === 'get-websocket-discovery-snapshot') {
    return { version: 1, type: 'websocket-discovery-snapshot', tabId: command.tabId, snapshot: discoveryCapture.getSnapshot(command.tabId) };
  }

  if (command.type === 'set-page-csp-bypass') {
    return setPageCspBypass(command.tabId, command.enabled);
  }

  if (command.type === 'set-csp-header-strip') {
    return setCspHeaderStrip(command.tabId, command.enabled, command.reload);
  }

  if (command.type === 'inject-csp-meta-probe') {
    return injectCspMetaProbe(command.tabId);
  }

  if (command.type === 'get-debug-lab-state') {
    return getDebugLabState(command.tabId);
  }

  return { version: 1, type: 'page-session-stale', tabId: command.tabId };
}

async function setPageCspBypass(tabId: number, enabled: boolean): Promise<RuntimeEvent> {
  try {
    if (enabled) {
      await ensureDebuggerAttached(tabId);
      await chrome.debugger.sendCommand({ tabId }, 'Page.setBypassCSP', { enabled: true });
      cspBypassTabs.add(tabId);
      return { version: 1, type: 'page-csp-bypass-updated', tabId, enabled: true, ok: true };
    }

    await disablePageCspBypass(tabId);

    return { version: 1, type: 'page-csp-bypass-updated', tabId, enabled: false, ok: true };
  } catch (error: unknown) {
    return {
      version: 1,
      type: 'page-csp-bypass-updated',
      tabId,
      enabled: cspBypassTabs.has(tabId),
      ok: false,
      error: readableError(error),
    };
  }
}

async function disablePageCspBypass(tabId: number): Promise<void> {
  const tabWasTracked = cspBypassTabs.has(tabId);
  await chrome.debugger.sendCommand({ tabId }, 'Page.setBypassCSP', { enabled: false }).catch((error: unknown) => {
    if (tabWasTracked) throw error;
  });
  if (!discoveryCapture.isCaptureActive(tabId)) {
    await chrome.debugger.detach({ tabId }).catch((error: unknown) => {
      if (tabWasTracked) throw error;
    });
  }
  cspBypassTabs.delete(tabId);
}

async function ensureDebuggerAttached(tabId: number): Promise<void> {
  if (cspBypassTabs.has(tabId) || discoveryCapture.isCaptureActive(tabId)) return;

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
  } catch (error: unknown) {
    const message = readableError(error);
    if (message.includes('Another debugger')) throw error;
    if (!message.includes('already attached')) throw error;
  }
}

async function setCspHeaderStrip(tabId: number, enabled: boolean, reload: boolean): Promise<RuntimeEvent> {
  try {
    if (enabled) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [cspHeaderStripRuleId(tabId)],
        addRules: [createCspHeaderStripRule(tabId)],
      });
      cspHeaderStripTabs.add(tabId);
    } else {
      await removeCspHeaderStripRule(tabId);
    }

    if (reload) await chrome.tabs.reload(tabId);

    return { version: 1, type: 'csp-header-strip-updated', tabId, enabled, ok: true, reloaded: reload };
  } catch (error: unknown) {
    return {
      version: 1,
      type: 'csp-header-strip-updated',
      tabId,
      enabled: cspHeaderStripTabs.has(tabId),
      ok: false,
      reloaded: false,
      error: readableError(error),
    };
  }
}

async function removeCspHeaderStripRule(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [cspHeaderStripRuleId(tabId)],
  });
  cspHeaderStripTabs.delete(tabId);
}

function createCspHeaderStripRule(tabId: number): chrome.declarativeNetRequest.Rule {
  return {
    id: cspHeaderStripRuleId(tabId),
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          header: 'content-security-policy',
          operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
        },
        {
          header: 'content-security-policy-report-only',
          operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
        },
      ],
    },
    condition: {
      tabIds: [tabId],
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
      ],
    },
  };
}

function cspHeaderStripRuleId(tabId: number): number {
  return cspHeaderStripRuleBase + tabId;
}

async function getDebugLabState(tabId: number): Promise<RuntimeEvent> {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const pageCspHeaderStripEnabled = sessionRules.some((rule) => rule.id === cspHeaderStripRuleId(tabId));
  if (pageCspHeaderStripEnabled) {
    cspHeaderStripTabs.add(tabId);
  } else {
    cspHeaderStripTabs.delete(tabId);
  }

  return {
    version: 1,
    type: 'debug-lab-state',
    tabId,
    pageCspBypassEnabled: cspBypassTabs.has(tabId),
    pageCspHeaderStripEnabled,
  };
}

async function injectCspMetaProbe(tabId: number): Promise<RuntimeEvent> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: injectPermissiveCspMetaProbe,
    });
    const message = typeof result?.result === 'string' ? result.result : 'Permissive CSP meta probe injected.';
    return { version: 1, type: 'csp-meta-probe-injected', tabId, injected: true, ok: true, message };
  } catch (error: unknown) {
    return {
      version: 1,
      type: 'csp-meta-probe-injected',
      tabId,
      injected: false,
      ok: false,
      error: readableError(error),
    };
  }
}

function injectPermissiveCspMetaProbe(): string {
  // Negative-control only: the CSP-capable meta pragma is
  // http-equiv="Content-Security-Policy". Other http-equiv values such as
  // "refresh" can reload or navigate a document, but they cannot change the
  // page's WebSocket connect-src policy. A late meta CSP also cannot loosen a
  // stricter response header; use CDP bypass or header stripping for that.
  const marker = 'ws-workbench-csp-meta-probe';
  document.querySelectorAll(`meta[data-${marker}="true"]`).forEach((node) => node.remove());

  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "connect-src * ws: wss: blob: data: 'self'";
  meta.setAttribute(`data-${marker}`, 'true');
  (document.head ?? document.documentElement).prepend(meta);

  return 'Meta CSP probe injected. Header CSP still wins; meta refresh cannot change connect-src.';
}

type TrustedScriptUrl = object;

type TrustedTypesPolicy = {
  createScriptURL: (value: string) => TrustedScriptUrl;
};

type TrustedTypesFactory = {
  createPolicy: (
    name: string,
    rules: {
      createScriptURL: (value: string) => string;
    },
  ) => TrustedTypesPolicy;
};

type WindowWithTrustedTypes = Window & {
  __wsWorkbenchExtensionContext?: ExtensionInjectionContext;
  trustedTypes?: TrustedTypesFactory;
};

type ExtensionInjectionContext = {
  tabId?: number;
};

function importExtensionScript(path: string, context: ExtensionInjectionContext = {}): Promise<unknown> {
  (window as WindowWithTrustedTypes).__wsWorkbenchExtensionContext = context;
  const scriptUrl = withImportRunId(chrome.runtime.getURL(path));
  const scriptSpecifier = createTrustedExtensionScriptUrl(scriptUrl);

  return import(/* @vite-ignore */ (scriptSpecifier as string));

  function withImportRunId(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}wsWorkbenchRun=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createTrustedExtensionScriptUrl(url: string): string | TrustedScriptUrl {
    const trustedTypes = (window as WindowWithTrustedTypes).trustedTypes;
    if (!trustedTypes?.createPolicy) return url;

    const extensionBaseUrl = chrome.runtime.getURL('');
    const policyNames = [
      'ws-workbench-extension-script-url',
      `ws-workbench-extension-script-url-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ];
    let lastError: unknown = null;

    for (const policyName of policyNames) {
      try {
        const policy = trustedTypes.createPolicy(policyName, {
          createScriptURL: (value: string) => {
            if (!value.startsWith(extensionBaseUrl)) {
              throw new TypeError('Refusing to trust a non-extension script URL');
            }
            return value;
          },
        });
        return policy.createScriptURL(url);
      } catch (error: unknown) {
        lastError = error;
      }
    }

    console.warn('[ws-workbench] Trusted Types script URL policy unavailable; importing extension URL directly', lastError);
    return url;
  }
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unexpected Chrome debugger failure.';
  if (error.message.includes('Another debugger')) {
    return `${error.message} Close DevTools for this tab before enabling Page CSP bypass, or use the Extension engine.`;
  }
  return error.message;
}

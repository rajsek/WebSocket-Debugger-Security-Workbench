import { createEmptyCaptureSnapshot, parseWebSocketCdpEvent, reduceDiscoveredSockets } from '../domain/discovery';
import type { WebSocketCaptureSnapshot } from '../domain/types';

type CaptureSession = WebSocketCaptureSnapshot & {
  debuggerAttached: boolean;
};
type DebuggerDetachReason = 'target_closed' | 'canceled_by_user' | string;

export interface DiscoveryCaptureManager {
  start(tabId: number): Promise<WebSocketCaptureSnapshot>;
  captureWithReload(tabId: number): Promise<WebSocketCaptureSnapshot>;
  stop(tabId: number, options?: { detachDebugger?: boolean }): Promise<WebSocketCaptureSnapshot>;
  getSnapshot(tabId: number): WebSocketCaptureSnapshot;
  handleDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params?: unknown): void;
  handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: DebuggerDetachReason): void;
  handleTabRemoved(tabId: number): void;
  isCaptureActive(tabId: number): boolean;
}

export function createDiscoveryCaptureManager(deps: {
  debuggerApi: Pick<typeof chrome.debugger, 'attach' | 'detach' | 'sendCommand'>;
  tabsApi: Pick<typeof chrome.tabs, 'reload'>;
  now?: () => string;
}): DiscoveryCaptureManager {
  const sessions = new Map<number, CaptureSession>();
  const now = deps.now ?? (() => new Date().toISOString());

  async function start(tabId: number): Promise<WebSocketCaptureSnapshot> {
    return startCapture(tabId, false);
  }

  async function captureWithReload(tabId: number): Promise<WebSocketCaptureSnapshot> {
    return startCapture(tabId, true);
  }

  async function startCapture(tabId: number, reload: boolean): Promise<WebSocketCaptureSnapshot> {
    const startedAt = now();
    const previous = sessions.get(tabId);
    const session = toSession({
      ...createEmptyCaptureSnapshot(tabId, 'attaching', startedAt),
      message: reload ? 'Attaching discovery before page reload.' : 'Attaching discovery.',
    });
    session.debuggerAttached = previous?.debuggerAttached ?? false;
    sessions.set(tabId, session);

    try {
      const attachedByThisFeature = await attachDebugger(tabId);
      session.debuggerAttached = session.debuggerAttached || attachedByThisFeature;
      await deps.debuggerApi.sendCommand({ tabId }, 'Network.enable');
      if (reload) await deps.tabsApi.reload(tabId);
      session.status = 'listening';
      session.message = reload ? 'Listening. The page was reloaded after capture started.' : 'Listening for page WebSocket activity.';
      return publicSnapshot(session);
    } catch (error: unknown) {
      if (session.debuggerAttached) {
        await deps.debuggerApi.detach({ tabId }).catch(() => undefined);
        session.debuggerAttached = false;
      }
      session.status = debuggerConflict(error) ? 'detached-by-devtools' : 'failed';
      session.message = readableDebuggerError(error);
      session.stoppedAt = now();
      return publicSnapshot(session);
    }
  }

  async function stop(tabId: number, options: { detachDebugger?: boolean } = {}): Promise<WebSocketCaptureSnapshot> {
    const session = ensureSession(tabId);
    const shouldDetach = options.detachDebugger ?? true;
    try {
      if (shouldDetach && session.debuggerAttached) {
        await deps.debuggerApi.detach({ tabId });
        session.debuggerAttached = false;
      }
      session.status = 'stopped';
      session.message = 'Discovery capture stopped.';
      session.stoppedAt = now();
      return publicSnapshot(session);
    } catch (error: unknown) {
      session.status = 'failed';
      session.message = readableDebuggerError(error);
      session.stoppedAt = now();
      return publicSnapshot(session);
    }
  }

  function getSnapshot(tabId: number): WebSocketCaptureSnapshot {
    return publicSnapshot(ensureSession(tabId));
  }

  function handleDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params?: unknown): void {
    if (typeof source.tabId !== 'number') return;
    const session = sessions.get(source.tabId);
    if (!session || (session.status !== 'attaching' && session.status !== 'listening')) return;

    const event = parseWebSocketCdpEvent(method, params, now());
    if (!event) return;
    session.sockets = reduceDiscoveredSockets(session.sockets, event);
    session.status = 'listening';
    session.message = `${session.sockets.length} discovered socket${session.sockets.length === 1 ? '' : 's'}.`;
  }

  function handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: DebuggerDetachReason): void {
    if (typeof source.tabId !== 'number') return;
    const session = sessions.get(source.tabId);
    if (!session) return;

    session.debuggerAttached = false;
    session.status = reason === 'canceled_by_user' ? 'detached-by-devtools' : 'detached';
    session.detachReason = reason;
    session.message =
      reason === 'canceled_by_user'
        ? 'Debugger capture detached. Close the competing DevTools/debugger session before restarting discovery.'
        : 'Debugger capture detached.';
    session.stoppedAt = now();
  }

  function handleTabRemoved(tabId: number): void {
    const session = sessions.get(tabId);
    if (!session) return;
    session.debuggerAttached = false;
    session.status = 'detached';
    session.message = 'Target tab closed; discovery capture stopped.';
    session.stoppedAt = now();
  }

  function isCaptureActive(tabId: number): boolean {
    const status = sessions.get(tabId)?.status;
    return status === 'attaching' || status === 'listening';
  }

  async function attachDebugger(tabId: number): Promise<boolean> {
    try {
      await deps.debuggerApi.attach({ tabId }, '1.3');
      return true;
    } catch (error: unknown) {
      const message = readableDebuggerError(error);
      if (debuggerConflict(error)) throw error;
      if (message.includes('already attached')) return false;
      throw error;
    }
  }

  function ensureSession(tabId: number): CaptureSession {
    const session = sessions.get(tabId);
    if (session) return session;
    const next = toSession(createEmptyCaptureSnapshot(tabId));
    sessions.set(tabId, next);
    return next;
  }

  return {
    start,
    captureWithReload,
    stop,
    getSnapshot,
    handleDebuggerEvent,
    handleDebuggerDetach,
    handleTabRemoved,
    isCaptureActive,
  };
}

function toSession(snapshot: WebSocketCaptureSnapshot): CaptureSession {
  return {
    ...snapshot,
    debuggerAttached: false,
  };
}

function publicSnapshot(session: CaptureSession): WebSocketCaptureSnapshot {
  return {
    tabId: session.tabId,
    status: session.status,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    message: session.message,
    detachReason: session.detachReason,
    sockets: [...session.sockets],
  };
}

function readableDebuggerError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unexpected Chrome debugger failure.';
  if (debuggerConflict(error)) {
    return `${error.message} Close DevTools for this tab before starting WebSocket discovery.`;
  }
  return error.message;
}

function debuggerConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Another debugger');
}

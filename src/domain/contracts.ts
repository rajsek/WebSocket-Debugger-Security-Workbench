import type { RuntimeCommand, RuntimeEvent } from './types';

const commandTypes = new Set([
  'inject-overlay',
  'inject-page-overlay',
  'mark-page-stale',
  'request-debugger-capture',
  'start-websocket-discovery',
  'stop-websocket-discovery',
  'capture-websocket-discovery-with-reload',
  'get-websocket-discovery-snapshot',
  'set-page-csp-bypass',
  'set-csp-header-strip',
  'inject-csp-meta-probe',
  'get-debug-lab-state',
]);
const eventTypes = new Set([
  'overlay-injected',
  'page-overlay-injected',
  'page-session-stale',
  'debugger-capture-permission',
  'websocket-discovery-status',
  'websocket-discovery-snapshot',
  'websocket-discovery-detached',
  'page-csp-bypass-updated',
  'csp-header-strip-updated',
  'csp-meta-probe-injected',
  'debug-lab-state',
]);

export function parseRuntimeCommand(value: unknown): RuntimeCommand {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== 'string' || !commandTypes.has(value.type)) {
    throw new Error('Unknown runtime command contract');
  }

  if (!('tabId' in value) || typeof value.tabId !== 'number') {
    throw new Error('Runtime command requires tabId');
  }

  if (value.type === 'set-page-csp-bypass' && typeof value.enabled !== 'boolean') {
    throw new Error('Page CSP bypass command requires enabled boolean');
  }

  if (value.type === 'set-csp-header-strip' && (typeof value.enabled !== 'boolean' || typeof value.reload !== 'boolean')) {
    throw new Error('CSP header strip command requires enabled and reload booleans');
  }

  return value as RuntimeCommand;
}

export function parseRuntimeEvent(value: unknown): RuntimeEvent {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== 'string' || !eventTypes.has(value.type)) {
    throw new Error('Unknown runtime event contract');
  }

  if (!('tabId' in value) || typeof value.tabId !== 'number') {
    throw new Error('Runtime event requires tabId');
  }

  if (value.type === 'debugger-capture-permission' && typeof value.granted !== 'boolean') {
    throw new Error('Debugger permission event requires granted boolean');
  }

  if (value.type === 'websocket-discovery-status' || value.type === 'websocket-discovery-snapshot' || value.type === 'websocket-discovery-detached') {
    if (!isCaptureSnapshot(value.snapshot, value.tabId)) {
      throw new Error('WebSocket discovery event requires capture snapshot');
    }
  }

  if (value.type === 'page-csp-bypass-updated') {
    if (typeof value.enabled !== 'boolean' || typeof value.ok !== 'boolean') {
      throw new Error('Page CSP bypass event requires enabled and ok booleans');
    }
    if ('error' in value && typeof value.error !== 'string') {
      throw new Error('Page CSP bypass event error must be a string');
    }
  }

  if (value.type === 'csp-header-strip-updated') {
    if (typeof value.enabled !== 'boolean' || typeof value.ok !== 'boolean' || typeof value.reloaded !== 'boolean') {
      throw new Error('CSP header strip event requires enabled, ok, and reloaded booleans');
    }
    if ('error' in value && typeof value.error !== 'string') {
      throw new Error('CSP header strip event error must be a string');
    }
  }

  if (value.type === 'csp-meta-probe-injected') {
    if (typeof value.injected !== 'boolean' || typeof value.ok !== 'boolean') {
      throw new Error('CSP meta probe event requires injected and ok booleans');
    }
    if ('message' in value && typeof value.message !== 'string') {
      throw new Error('CSP meta probe event message must be a string');
    }
    if ('error' in value && typeof value.error !== 'string') {
      throw new Error('CSP meta probe event error must be a string');
    }
  }

  if (value.type === 'debug-lab-state') {
    if (typeof value.pageCspBypassEnabled !== 'boolean' || typeof value.pageCspHeaderStripEnabled !== 'boolean') {
      throw new Error('Debug Lab state event requires CSP state booleans');
    }
  }

  return value as RuntimeEvent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCaptureSnapshot(value: unknown, tabId: number): boolean {
  if (!isRecord(value)) return false;
  if (value.tabId !== tabId) return false;
  if (typeof value.status !== 'string') return false;
  if (!Array.isArray(value.sockets)) return false;
  if (value.startedAt !== null && typeof value.startedAt !== 'string') return false;
  if (value.stoppedAt !== null && typeof value.stoppedAt !== 'string') return false;
  if (typeof value.message !== 'string') return false;
  if (value.detachReason !== null && typeof value.detachReason !== 'string') return false;
  return true;
}

import { parseRuntimeCommand, parseRuntimeEvent } from './contracts';

describe('runtime message contracts', () => {
  const captureSnapshot = {
    tabId: 7,
    status: 'listening',
    startedAt: '2026-05-15T12:00:00.000Z',
    stoppedAt: null,
    message: 'Listening.',
    detachReason: null,
    sockets: [],
  };

  it('accepts versioned known commands', () => {
    expect(parseRuntimeCommand({ version: 1, type: 'inject-overlay', tabId: 7 })).toEqual({ version: 1, type: 'inject-overlay', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'inject-page-overlay', tabId: 7 })).toEqual({ version: 1, type: 'inject-page-overlay', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'start-websocket-discovery', tabId: 7 })).toEqual({ version: 1, type: 'start-websocket-discovery', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'stop-websocket-discovery', tabId: 7 })).toEqual({ version: 1, type: 'stop-websocket-discovery', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'capture-websocket-discovery-with-reload', tabId: 7 })).toEqual({ version: 1, type: 'capture-websocket-discovery-with-reload', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'get-websocket-discovery-snapshot', tabId: 7 })).toEqual({ version: 1, type: 'get-websocket-discovery-snapshot', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'set-page-csp-bypass', tabId: 7, enabled: true })).toEqual({ version: 1, type: 'set-page-csp-bypass', tabId: 7, enabled: true });
    expect(parseRuntimeCommand({ version: 1, type: 'set-csp-header-strip', tabId: 7, enabled: true, reload: true })).toEqual({ version: 1, type: 'set-csp-header-strip', tabId: 7, enabled: true, reload: true });
    expect(parseRuntimeCommand({ version: 1, type: 'inject-csp-meta-probe', tabId: 7 })).toEqual({ version: 1, type: 'inject-csp-meta-probe', tabId: 7 });
    expect(parseRuntimeCommand({ version: 1, type: 'get-debug-lab-state', tabId: 7 })).toEqual({ version: 1, type: 'get-debug-lab-state', tabId: 7 });
    expect(parseRuntimeEvent({ version: 1, type: 'page-overlay-injected', tabId: 7 })).toEqual({ version: 1, type: 'page-overlay-injected', tabId: 7 });
    expect(parseRuntimeEvent({ version: 1, type: 'websocket-discovery-status', tabId: 7, snapshot: captureSnapshot })).toEqual({ version: 1, type: 'websocket-discovery-status', tabId: 7, snapshot: captureSnapshot });
    expect(parseRuntimeEvent({ version: 1, type: 'page-csp-bypass-updated', tabId: 7, enabled: true, ok: true })).toEqual({ version: 1, type: 'page-csp-bypass-updated', tabId: 7, enabled: true, ok: true });
    expect(parseRuntimeEvent({ version: 1, type: 'csp-header-strip-updated', tabId: 7, enabled: true, ok: true, reloaded: true })).toEqual({ version: 1, type: 'csp-header-strip-updated', tabId: 7, enabled: true, ok: true, reloaded: true });
    expect(parseRuntimeEvent({ version: 1, type: 'csp-meta-probe-injected', tabId: 7, injected: true, ok: true, message: 'done' })).toEqual({ version: 1, type: 'csp-meta-probe-injected', tabId: 7, injected: true, ok: true, message: 'done' });
    expect(parseRuntimeEvent({ version: 1, type: 'debug-lab-state', tabId: 7, pageCspBypassEnabled: false, pageCspHeaderStripEnabled: true })).toEqual({ version: 1, type: 'debug-lab-state', tabId: 7, pageCspBypassEnabled: false, pageCspHeaderStripEnabled: true });
  });

  it('rejects unknown command versions and types', () => {
    expect(() => parseRuntimeCommand({ version: 2, type: 'inject-overlay', tabId: 7 })).toThrow('Unknown runtime command contract');
    expect(() => parseRuntimeCommand({ version: 1, type: 'surprise', tabId: 7 })).toThrow('Unknown runtime command contract');
  });

  it('rejects unknown event versions and malformed debugger events', () => {
    expect(() => parseRuntimeEvent({ version: 2, type: 'overlay-injected', tabId: 7 })).toThrow('Unknown runtime event contract');
    expect(() => parseRuntimeEvent({ version: 1, type: 'debugger-capture-permission', tabId: 7 })).toThrow('Debugger permission event requires granted boolean');
    expect(() => parseRuntimeCommand({ version: 1, type: 'set-page-csp-bypass', tabId: 7 })).toThrow('Page CSP bypass command requires enabled boolean');
    expect(() => parseRuntimeEvent({ version: 1, type: 'page-csp-bypass-updated', tabId: 7, enabled: true })).toThrow('Page CSP bypass event requires enabled and ok booleans');
    expect(() => parseRuntimeCommand({ version: 1, type: 'set-csp-header-strip', tabId: 7, enabled: true })).toThrow('CSP header strip command requires enabled and reload booleans');
    expect(() => parseRuntimeEvent({ version: 1, type: 'csp-header-strip-updated', tabId: 7, enabled: true, ok: true })).toThrow('CSP header strip event requires enabled, ok, and reloaded booleans');
    expect(() => parseRuntimeEvent({ version: 1, type: 'csp-meta-probe-injected', tabId: 7, injected: true })).toThrow('CSP meta probe event requires injected and ok booleans');
    expect(() => parseRuntimeEvent({ version: 1, type: 'debug-lab-state', tabId: 7, pageCspBypassEnabled: false })).toThrow('Debug Lab state event requires CSP state booleans');
    expect(() => parseRuntimeEvent({ version: 1, type: 'websocket-discovery-status', tabId: 7, snapshot: { ...captureSnapshot, tabId: 8 } })).toThrow('WebSocket discovery event requires capture snapshot');
  });
});

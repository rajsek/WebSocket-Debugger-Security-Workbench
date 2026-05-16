import { createDiscoveryCaptureManager } from './discoveryCapture';

describe('discovery capture manager', () => {
  function createHarness(options: { attachError?: Error } = {}) {
    const debuggerApi = {
      attach: vi.fn(async () => {
        if (options.attachError) throw options.attachError;
      }),
      detach: vi.fn(async () => undefined),
      sendCommand: vi.fn(async () => ({})),
    };
    const tabsApi = {
      reload: vi.fn(async () => undefined),
    };
    const manager = createDiscoveryCaptureManager({
      debuggerApi,
      tabsApi,
      now: () => '2026-05-15T12:00:00.000Z',
    });
    return { debuggerApi, tabsApi, manager };
  }

  it('attaches debugger capture and enables Network observation', async () => {
    const { debuggerApi, manager } = createHarness();

    const snapshot = await manager.start(7);

    expect(debuggerApi.attach).toHaveBeenCalledWith({ tabId: 7 }, '1.3');
    expect(debuggerApi.sendCommand).toHaveBeenCalledWith({ tabId: 7 }, 'Network.enable');
    expect(snapshot.status).toBe('listening');
    expect(snapshot.sockets).toEqual([]);
  });

  it('keeps discovered sockets scoped by tab id and request id', async () => {
    const { manager } = createHarness();

    await manager.start(7);
    manager.handleDebuggerEvent({ tabId: 7 }, 'Network.webSocketCreated', { requestId: '100.1', url: 'wss://app.example/ws' });
    manager.handleDebuggerEvent({ tabId: 7 }, 'Network.webSocketCreated', { requestId: '100.2', url: 'wss://app.example/ws' });
    manager.handleDebuggerEvent({ tabId: 8 }, 'Network.webSocketCreated', { requestId: '200.1', url: 'wss://other.example/ws' });
    manager.handleDebuggerEvent({ tabId: 7 }, 'Network.webSocketFrameReceived', {
      requestId: '100.1',
      timestamp: 1,
      response: { opcode: 1, payloadData: '{"ok":true}' },
    });

    const snapshot = manager.getSnapshot(7);

    expect(snapshot.sockets.map((socket) => socket.requestId)).toEqual(['100.1', '100.2']);
    expect(snapshot.sockets[0].frameCounts.inbound).toBe(1);
  });

  it('starts capture before reload for startup sockets', async () => {
    const { debuggerApi, tabsApi, manager } = createHarness();

    const snapshot = await manager.captureWithReload(7);

    expect(debuggerApi.sendCommand).toHaveBeenCalledWith({ tabId: 7 }, 'Network.enable');
    expect(tabsApi.reload).toHaveBeenCalledWith(7);
    expect(snapshot.status).toBe('listening');
  });

  it('stops capture and skips detach when another debugger feature still owns the tab', async () => {
    const { debuggerApi, manager } = createHarness();
    await manager.start(7);

    const snapshot = await manager.stop(7, { detachDebugger: false });

    expect(debuggerApi.detach).not.toHaveBeenCalled();
    expect(snapshot.status).toBe('stopped');
  });

  it('surfaces debugger conflicts and detach reasons as visible capture state', async () => {
    const conflict = createHarness({ attachError: new Error('Another debugger is already attached to the tab') });
    const failed = await conflict.manager.start(7);

    expect(failed.status).toBe('detached-by-devtools');
    expect(failed.message).toContain('Close DevTools');

    const { manager } = createHarness();
    await manager.start(8);
    manager.handleDebuggerDetach({ tabId: 8 }, 'canceled_by_user');

    const detached = manager.getSnapshot(8);
    expect(detached.status).toBe('detached-by-devtools');
    expect(detached.detachReason).toBe('canceled_by_user');
  });
});

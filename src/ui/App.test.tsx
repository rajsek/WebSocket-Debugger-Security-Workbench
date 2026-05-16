import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App';
import {
  captureWebSocketDiscoveryWithReload,
  getDebugLabState,
  getWebSocketDiscoverySnapshot,
  injectCspMetaProbe,
  setCspHeaderStrip,
  setPageCspBypass,
  startWebSocketDiscovery,
  stopWebSocketDiscovery,
} from '../extension/chromeAdapter';
import type { WebSocketCaptureSnapshot } from '../domain/types';
import { clearReplayLibrary } from '../extension/replayStorage';

const { emptyDiscoverySnapshot } = vi.hoisted(() => ({
  emptyDiscoverySnapshot: {
    tabId: 1,
    status: 'idle' as const,
    startedAt: null,
    stoppedAt: null,
    message: '',
    detachReason: null,
    sockets: [],
  } satisfies WebSocketCaptureSnapshot,
}));

vi.mock('../extension/chromeAdapter', () => ({
  captureWebSocketDiscoveryWithReload: vi.fn(async () => emptyDiscoverySnapshot),
  getDebugLabState: vi.fn(async () => ({ pageCspBypassEnabled: false, pageCspHeaderStripEnabled: false })),
  getWebSocketDiscoverySnapshot: vi.fn(async () => emptyDiscoverySnapshot),
  injectCspMetaProbe: vi.fn(async () => ({ injected: true, ok: true, message: 'Meta CSP probe injected. Header CSP still wins; meta refresh cannot change connect-src.' })),
  injectOverlay: vi.fn(async () => ({ version: 1, type: 'overlay-injected', tabId: 1 })),
  requestDebuggerCapture: vi.fn(async () => true),
  setCspHeaderStrip: vi.fn(async (_tabId: number, enabled: boolean, reload: boolean) => ({ enabled, ok: true, reloaded: reload })),
  setPageCspBypass: vi.fn(async (_tabId: number, enabled: boolean) => ({ enabled, ok: true })),
  startWebSocketDiscovery: vi.fn(async () => emptyDiscoverySnapshot),
  stopWebSocketDiscovery: vi.fn(async () => emptyDiscoverySnapshot),
}));

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = [];
  closed = false;
  sent: string[] = [];
  protocols: string | string[] | undefined;
  url: string;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  send(value: string) {
    this.sent.push(value);
  }

  close() {
    this.closed = true;
    this.dispatchEvent(new Event('close'));
  }
}

beforeEach(async () => {
  MockWebSocket.instances = [];
  await clearReplayLibrary();
  vi.mocked(captureWebSocketDiscoveryWithReload).mockClear();
  vi.mocked(captureWebSocketDiscoveryWithReload).mockResolvedValue(emptyDiscoverySnapshot);
  vi.mocked(getDebugLabState).mockClear();
  vi.mocked(getDebugLabState).mockResolvedValue({ pageCspBypassEnabled: false, pageCspHeaderStripEnabled: false });
  vi.mocked(getWebSocketDiscoverySnapshot).mockClear();
  vi.mocked(getWebSocketDiscoverySnapshot).mockResolvedValue(emptyDiscoverySnapshot);
  vi.mocked(injectCspMetaProbe).mockClear();
  vi.mocked(setCspHeaderStrip).mockClear();
  vi.mocked(setPageCspBypass).mockClear();
  vi.mocked(startWebSocketDiscovery).mockClear();
  vi.mocked(startWebSocketDiscovery).mockResolvedValue(emptyDiscoverySnapshot);
  vi.mocked(stopWebSocketDiscovery).mockClear();
  vi.mocked(stopWebSocketDiscovery).mockResolvedValue(emptyDiscoverySnapshot);
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => `id-${Math.random()}`),
    subtle: {
      digest: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
    },
  });
});

describe('App', () => {
  function discoverySnapshot(overrides: Partial<WebSocketCaptureSnapshot> = {}): WebSocketCaptureSnapshot {
    return {
      ...emptyDiscoverySnapshot,
      status: 'listening' as const,
      startedAt: '2026-05-15T12:00:00.000Z',
      message: '1 discovered socket.',
      sockets: [
        {
          requestId: '100.1',
          url: 'wss://example.com/socket',
          lifecycle: 'active' as const,
          createdAt: '2026-05-15T12:00:00.000Z',
          lastActivityAt: '2026-05-15T12:00:01.000Z',
          handshake: {
            observed: true,
            requestHeaders: [{ name: 'Authorization', value: '[redacted]', redacted: true }],
            responseHeaders: [{ name: 'sec-websocket-protocol', value: 'graphql-transport-ws', redacted: false }],
            status: 101,
            statusText: 'Switching Protocols',
            protocol: 'graphql-transport-ws',
            extensions: '',
            requestTime: '2026-05-15T12:00:00.000Z',
            responseTime: '2026-05-15T12:00:00.100Z',
          },
          frameCounts: { outbound: 1, inbound: 0 },
          firstOutboundFrames: [
            {
              id: 'boot-1',
              requestId: '100.1',
              direction: 'outbound' as const,
              timestamp: '2026-05-15T12:00:01.000Z',
              opcode: 1,
              payloadKind: 'text' as const,
              body: '{"token":"secret-value","subscribe":"orders"}',
              preview: '{"token":"[redacted]","subscribe":"orders"}',
              payloadLength: 45,
              redacted: true,
            },
          ],
          error: null,
          closedAt: null,
        },
      ],
      ...overrides,
    };
  }

  it('runs the debugger workflow: connect, send, receive, search, edit, resend, clear', async () => {
    render(<App surface="popup" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    const socket = MockWebSocket.instances[0];
    await act(async () => {
      socket.dispatchEvent(new Event('open'));
    });
    fireEvent.change(screen.getByLabelText('Payload editor'), { target: { value: '{"message":"hello"}' } });
    fireEvent.click(screen.getByRole('button', { name: /^send/i }));

    await act(async () => {
      socket.dispatchEvent(new MessageEvent('message', { data: '{"reply":"ok"}' }));
    });
    fireEvent.change(screen.getByLabelText('Search frames'), { target: { value: 'reply' } });

    expect(screen.getByText('{"reply":"ok"}')).toBeInTheDocument();
    fireEvent.click(screen.getByText('{"reply":"ok"}'));
    fireEvent.change(screen.getByLabelText('Payload editor'), { target: { value: '{"reply":"edited"}' } });
    fireEvent.click(screen.getByRole('button', { name: /resend selected/i }));
    expect(socket.sent).toContain('{"reply":"ok"}');

    fireEvent.click(screen.getByTitle('Clear frames'));
    expect(screen.queryByText('{"reply":"ok"}')).not.toBeInTheDocument();
  });

  it('shows binary WebSocket frames as wire previews instead of replayable plaintext', async () => {
    render(<App surface="popup" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    const socket = MockWebSocket.instances[0];
    await act(async () => {
      socket.dispatchEvent(new Event('open'));
      socket.dispatchEvent(new MessageEvent('message', { data: new Uint8Array([0, 1, 2, 253, 254, 255]).buffer }));
    });

    expect(await screen.findByText('[binary frame: 6 B] hex 00 01 02 fd fe ff')).toBeInTheDocument();
    expect(screen.getByLabelText('Binary wire inspector')).toBeInTheDocument();
    expect(screen.getByText('AAEC/f7/')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^send/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /resend selected/i })).toBeDisabled();
  });

  it('allows engine selection before connecting and keeps extension mode as an extension socket', async () => {
    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    const engine = await screen.findByLabelText('Engine');
    expect(engine).not.toBeDisabled();
    fireEvent.change(engine, { target: { value: 'extension' } });
    fireEvent.change(screen.getByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/socket');
    expect(engine).toBeDisabled();
  });

  it('lets testers select a known echo endpoint without losing custom URL support', async () => {
    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    const socketUrl = await screen.findByPlaceholderText('wss://example.com/socket');
    fireEvent.change(socketUrl, { target: { value: 'wss://private.example/socket' } });

    const testEndpoint = screen.getByLabelText('Test endpoint');
    expect(testEndpoint).toHaveValue('');

    fireEvent.change(testEndpoint, { target: { value: 'wss://ws.postman-echo.com/raw' } });
    expect(socketUrl).toHaveValue('wss://ws.postman-echo.com/raw');

    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    expect(MockWebSocket.instances[0].url).toBe('wss://ws.postman-echo.com/raw');
    expect(testEndpoint).toBeDisabled();
  });

  it('shows the Discover empty state and capture controls', async () => {
    vi.mocked(startWebSocketDiscovery).mockResolvedValueOnce({ ...emptyDiscoverySnapshot, status: 'listening', message: 'Listening for page WebSocket activity.' });
    vi.mocked(stopWebSocketDiscovery).mockResolvedValueOnce({ ...emptyDiscoverySnapshot, status: 'stopped', message: 'Discovery capture stopped.' });

    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /discover websockets/i }));
    expect(screen.getByText('No WebSockets observed for this capture.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start capture/i }));
    await waitFor(() => expect(startWebSocketDiscovery).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Listening for page WebSocket activity.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop capture/i }));
    await waitFor(() => expect(stopWebSocketDiscovery).toHaveBeenCalledWith(1));
  });

  it('renders discovered sockets, detach state, and observed evidence', async () => {
    vi.mocked(getWebSocketDiscoverySnapshot).mockResolvedValueOnce(discoverySnapshot({
      status: 'detached-by-devtools' as const,
      message: 'Debugger capture detached.',
      detachReason: 'canceled_by_user',
    }));

    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /discover websockets/i }));
    expect(await screen.findByText('detached by debugger')).toBeInTheDocument();
    expect(screen.getAllByText('wss://example.com/socket')).not.toHaveLength(0);
    expect(screen.getAllByText('graphql-transport-ws')).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /add observed evidence/i }));
    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));

    expect(await screen.findByText('observed 100.1')).toBeInTheDocument();
    expect(screen.getByText('1 outbound / 0 inbound')).toBeInTheDocument();
  });

  it('imports a discovered target without connecting or sending frames', async () => {
    vi.mocked(getWebSocketDiscoverySnapshot).mockResolvedValueOnce(discoverySnapshot());

    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /discover websockets/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^import target/i }));

    expect(screen.getByPlaceholderText('wss://example.com/socket')).toHaveValue('wss://example.com/socket');
    expect(screen.getByLabelText('Engine')).toHaveValue('page');
    expect(MockWebSocket.instances).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));
    expect(await screen.findByText('recipe 100.1')).toBeInTheDocument();
    expect(screen.getByText('page import')).toBeInTheDocument();
  });

  it('queues selected bootstrap frames and requires explicit replay after connect', async () => {
    vi.mocked(getWebSocketDiscoverySnapshot).mockResolvedValueOnce(discoverySnapshot({
      sockets: [
        {
          ...discoverySnapshot().sockets[0],
          url: 'wss://api.example.net/socket',
        },
      ],
    }));

    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /discover websockets/i }));
    fireEvent.click(await screen.findByLabelText(/bootstrap frame 1/i));
    fireEvent.click(screen.getByRole('button', { name: /import with bootstrap/i }));

    expect(screen.getByRole('button', { name: /replay bootstrap/i })).toBeDisabled();
    expect(MockWebSocket.instances).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    const socket = MockWebSocket.instances[0];
    await act(async () => {
      socket.dispatchEvent(new Event('open'));
    });
    fireEvent.click(screen.getByRole('button', { name: /replay bootstrap/i }));

    expect(socket.sent).toContain('{"token":"secret-value","subscribe":"orders"}');
    expect(socket.protocols).toBe('graphql-transport-ws');
    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));
    expect(await screen.findByText('bootstrap 100.1')).toBeInTheDocument();
  });

  it('saves current target and outbound messages into the replay library, loads an editable queue, and records replay evidence', async () => {
    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    const socket = MockWebSocket.instances[0];
    await act(async () => {
      socket.dispatchEvent(new Event('open'));
    });

    fireEvent.change(screen.getByLabelText('Payload editor'), { target: { value: '{"token":"secret-value","op":"subscribe"}' } });
    fireEvent.click(screen.getByRole('button', { name: /^send/i }));

    fireEvent.click(screen.getByRole('button', { name: /replay library/i }));
    fireEvent.click(screen.getByRole('button', { name: /save target/i }));
    await waitFor(() => expect(screen.getByText('1 saved artifacts')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /save outbound/i }));

    await waitFor(() => expect(screen.getByText('2 saved artifacts')).toBeInTheDocument());
    const loadQueue = screen.getByRole('button', { name: /load editable queue/i });
    await waitFor(() => expect(loadQueue).not.toBeDisabled());
    fireEvent.click(loadQueue);

    const replayMessage = await screen.findByLabelText('Replay message 1');
    fireEvent.change(replayMessage, { target: { value: '{"op":"edited"}' } });
    fireEvent.click(screen.getByRole('button', { name: /send next/i }));

    expect(socket.sent).toContain('{"op":"edited"}');

    fireEvent.click(screen.getByRole('button', { name: /finish run/i }));
    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));

    expect(await screen.findByText(/^replay /i)).toBeInTheDocument();
    expect(screen.getByText('completed replay run')).toBeInTheDocument();
  });

  it('imports, deletes, and clears replay artifacts with raw-payload warning visible', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const artifactJson = JSON.stringify([
      {
        schemaVersion: 1,
        kind: 'saved-socket-recipe',
        id: 'imported-socket',
        name: 'Imported socket',
        createdAt: '2026-05-16T10:00:00.000Z',
        updatedAt: '2026-05-16T10:00:00.000Z',
        socketUrl: 'wss://example.com/socket',
        subprotocol: '',
        selectedEngine: 'extension',
        recommendedEngine: 'extension',
        tabOrigin: 'https://example.com',
        authAssumption: 'unknown',
        sourceType: 'import',
        sourceRequestId: null,
        handshake: {
          observed: false,
          requestHeaders: [],
          responseHeaders: [],
          status: null,
          statusText: '',
          protocol: '',
          extensions: '',
          requestTime: null,
          responseTime: null,
        },
      },
    ]);

    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /replay library/i }));
    expect(screen.getByText(/may contain secrets/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Replay import JSON'), { target: { value: artifactJson } });
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    expect(await screen.findByText('1 saved artifacts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.getByText('0 saved artifacts')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Replay import JSON'), { target: { value: artifactJson } });
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    expect(await screen.findByText('1 saved artifacts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear library/i }));
    await waitFor(() => expect(screen.getByText('0 saved artifacts')).toBeInTheDocument());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Clear saved replay artifacts'));
    confirm.mockRestore();
  });

  it('routes page engine commands only from the direct page overlay', async () => {
    const postedMessages: unknown[] = [];
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      postedMessages.push(message);
    });

    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: null, origin: 'https://example.com' })} />);

    const engine = await screen.findByLabelText('Engine');
    await waitFor(() => expect(engine).toHaveValue('page'));
    expect(engine).not.toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(postedMessages).toContainEqual({
      source: 'ws-workbench-page-overlay',
      type: 'connect',
      url: 'wss://example.com/socket',
    });
    postMessage.mockRestore();
  });

  it('passes observed subprotocols through page-engine connect commands', async () => {
    vi.mocked(getWebSocketDiscoverySnapshot).mockResolvedValueOnce(discoverySnapshot());
    const postedMessages: unknown[] = [];
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      postedMessages.push(message);
    });

    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /discover websockets/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^import target/i }));
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(postedMessages).toContainEqual({
      source: 'ws-workbench-page-overlay',
      type: 'connect',
      url: 'wss://example.com/socket',
      protocol: 'graphql-transport-ws',
    });
    postMessage.mockRestore();
  });

  it('stops the page engine when the direct page overlay unmounts', async () => {
    const postedMessages: unknown[] = [];
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      postedMessages.push(message);
    });

    const { unmount } = render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: null, origin: 'https://example.com' })} />);

    await waitFor(() => expect(screen.getByLabelText('Engine')).toHaveValue('page'));
    unmount();

    expect(postedMessages).toContainEqual({
      source: 'ws-workbench-page-overlay',
      type: 'stop',
    });
    postMessage.mockRestore();
  });

  it('closes an extension-owned socket when the iframe app unmounts', async () => {
    const { unmount } = render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    const socket = MockWebSocket.instances[0];
    unmount();

    expect(socket.closed).toBe(true);
  });

  it('enables debugger-backed page CSP bypass only for the direct page overlay tab', async () => {
    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: 5, origin: 'https://gemini.google.com' })} />);

    await waitFor(() => expect(screen.getByLabelText('Engine')).toHaveValue('page'));
    fireEvent.click(screen.getByRole('button', { name: 'Enable page CSP bypass' }));

    expect(setPageCspBypass).toHaveBeenCalledWith(5, true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disable page CSP bypass' })).toBeInTheDocument());
  });

  it('exposes Debug Lab CSP strategies for the selected tab', async () => {
    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: 5, origin: 'https://gemini.google.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /debug lab/i }));
    fireEvent.click(screen.getByRole('button', { name: /enable cdp/i }));
    await waitFor(() => expect(setPageCspBypass).toHaveBeenCalledWith(5, true));
    expect(await screen.findByText('CDP CSP bypass enabled. Reconnect the Page engine socket.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /strip \+ reload/i }));
    await waitFor(() => expect(setCspHeaderStrip).toHaveBeenCalledWith(5, true, true));

    fireEvent.click(screen.getByRole('button', { name: /inject meta/i }));
    await waitFor(() => expect(injectCspMetaProbe).toHaveBeenCalledWith(5));
  });

  it('hydrates active CSP header stripping after a page reload so it can be removed', async () => {
    vi.mocked(getDebugLabState).mockResolvedValue({ pageCspBypassEnabled: false, pageCspHeaderStripEnabled: true });

    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: 5, origin: 'https://gemini.google.com' })} />);

    fireEvent.click(await screen.findByRole('button', { name: /debug lab/i }));
    const remove = await screen.findByRole('button', { name: /remove \+ reload/i });
    fireEvent.click(remove);

    await waitFor(() => expect(setCspHeaderStrip).toHaveBeenCalledWith(5, false, true));
  });

  it('surfaces page-engine CSP block messages without replacing them with a generic error', async () => {
    render(<App surface="page-overlay" transport="page" loadTabContext={async () => ({ tabId: 5, origin: 'https://gemini.google.com' })} />);

    await waitFor(() => expect(screen.getByLabelText('Engine')).toHaveValue('page'));

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        source: window,
        data: {
          source: 'ws-workbench-page-engine',
          type: 'status',
          status: 'error',
          message: 'Page CSP blocked wss://echo.websocket.org/ (connect-src). Page engine sockets obey the host page connect-src policy. Use Extension engine for arbitrary echo hosts, or enable Page CSP bypass for this tab and reconnect.',
        },
      }));
    });

    expect(await screen.findByText(/Page CSP blocked wss:\/\/echo\.websocket\.org\//)).toBeInTheDocument();
  });

  it('does not pretend page engine works from extension-only surfaces', async () => {
    render(<App surface="sidepanel" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);

    fireEvent.change(await screen.findByLabelText('Engine'), { target: { value: 'page' } });
    fireEvent.change(screen.getByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    expect(screen.getByText('Page engine is available only in the Direct Page Overlay.')).toBeInTheDocument();
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('blocks active security tests by default and shows the target origin', async () => {
    render(<App surface="popup" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);
    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /security lab/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edited Resource Identifier/i }));

    expect(screen.getByText('Target origin: example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /run selected test/i }));
    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));

    expect(await screen.findByText('message-edited-resource-id')).toBeInTheDocument();
    expect(screen.getByText('Active tests require explicit authorization confirmation.')).toBeInTheDocument();
  });

  it('redacts sensitive evidence previews by default', async () => {
    render(<App surface="popup" loadTabContext={async () => ({ tabId: 1, origin: 'https://example.com' })} />);
    fireEvent.change(await screen.findByPlaceholderText('wss://example.com/socket'), { target: { value: 'wss://example.com/socket' } });
    fireEvent.click(screen.getByRole('button', { name: /security lab/i }));
    fireEvent.click(screen.getByRole('button', { name: /Authentication Context Note/i }));
    fireEvent.change(screen.getByLabelText('Security payload'), { target: { value: 'Authorization: Bearer abc.def.ghi' } });
    fireEvent.click(screen.getByRole('button', { name: /run selected test/i }));
    fireEvent.click(screen.getByRole('button', { name: /^evidence$/i }));

    const evidence = await screen.findByText('handshake-auth-context');
    expect(within(evidence.closest('li') as HTMLElement).getByText('[redacted]')).toBeInTheDocument();
  });
});

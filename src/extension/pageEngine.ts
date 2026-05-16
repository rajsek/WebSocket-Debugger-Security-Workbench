(() => {
  const marker = '__wsWorkbenchPageEngineReady';
  const pageWindow = window as unknown as Window & Record<string, boolean | string | WebSocket | undefined>;
  const socketKey = '__wsWorkbenchPageSocket';
  const pendingSocketUrlKey = '__wsWorkbenchPendingSocketUrl';
  const cspBlockedUrlKey = '__wsWorkbenchCspBlockedSocketUrl';
  const uiSource = 'ws-workbench-page-overlay';
  const engineSource = 'ws-workbench-page-engine';

  if (pageWindow[marker]) return;
  pageWindow[marker] = true;

  window.addEventListener('securitypolicyviolation', (event) => {
    const pendingUrl = pageWindow[pendingSocketUrlKey];
    if (typeof pendingUrl !== 'string') return;
    if (!isConnectSrcViolation(event) || !blockedUriMatches(event.blockedURI, pendingUrl)) return;

    pageWindow[cspBlockedUrlKey] = pendingUrl;
    postStatus('error', pageCspMessage(pendingUrl, event.effectiveDirective || event.violatedDirective));
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || !isUiMessage(event.data)) return;

    if (event.data.type === 'connect') {
      connect(event.data.url, event.data.protocol);
      return;
    }

    if (event.data.type === 'send') {
      const socket = pageWindow[socketKey];
      if (socket instanceof WebSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(event.data.body);
        postFrame('outbound', event.data.body);
      } else {
        postStatus('error', 'Connect before sending.');
      }
      return;
    }

    if (event.data.type === 'stop') {
      const socket = pageWindow[socketKey];
      if (socket instanceof WebSocket) socket.close();
      pageWindow[socketKey] = undefined;
      postStatus('closed');
    }
  });

  function connect(url: string, protocol = ''): void {
    const current = pageWindow[socketKey];
    if (current instanceof WebSocket) current.close();

    try {
      const socketUrl = new URL(url, window.location.href).toString();
      let socketErrored = false;
      pageWindow[pendingSocketUrlKey] = socketUrl;
      pageWindow[cspBlockedUrlKey] = undefined;

      const socket = protocol ? new WebSocket(socketUrl, protocol) : new WebSocket(socketUrl);
      socket.binaryType = 'arraybuffer';
      pageWindow[socketKey] = socket;
      postStatus('connecting');

      socket.addEventListener('open', () => {
        if (pageWindow[socketKey] !== socket) return;
        clearPendingSocket(socketUrl);
        postStatus('open');
      });
      socket.addEventListener('close', () => {
        if (pageWindow[socketKey] !== socket) return;
        clearPendingSocket(socketUrl);
        if (!socketErrored) postStatus('closed');
      });
      socket.addEventListener('error', () => {
        if (pageWindow[socketKey] !== socket) return;
        socketErrored = true;
        window.setTimeout(() => {
          if (pageWindow[socketKey] !== socket) return;
          if (pageWindow[cspBlockedUrlKey] === socketUrl) return;
          clearPendingSocket(socketUrl);
          postStatus('error', 'Page WebSocket connection failed.');
        }, 50);
      });
      socket.addEventListener('message', async (event) => {
        if (pageWindow[socketKey] !== socket) return;
        const payload = await summarizeWebSocketMessageData(event.data);
        postFrame('inbound', payload.body, payload.metadata);
      });
    } catch (error) {
      postStatus('error', error instanceof Error ? error.message : 'Invalid WebSocket URL.');
    }
  }

  function postStatus(status: string, message = ''): void {
    window.postMessage({ source: engineSource, type: 'status', status, message }, '*');
  }

  function postFrame(direction: 'inbound' | 'outbound', body: string, metadata: Record<string, string> = summarizeTextPayload(body).metadata): void {
    window.postMessage({ source: engineSource, type: 'frame', direction, body, metadata, timestamp: new Date().toISOString() }, '*');
  }

  async function summarizeWebSocketMessageData(data: unknown): Promise<{ body: string; metadata: Record<string, string> }> {
    if (typeof data === 'string') return { body: data, metadata: summarizeTextPayload(data).metadata };
    if (data instanceof ArrayBuffer) return summarizeBinaryBytes(new Uint8Array(data));
    if (ArrayBuffer.isView(data)) return summarizeBinaryBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    if (data instanceof Blob) return summarizeBinaryBytes(new Uint8Array(await data.arrayBuffer()));
    return {
      body: '[binary frame: unavailable]',
      metadata: {
        payloadKind: 'binary',
        payloadLength: '0',
        wireEncoding: 'binary',
        wireDecodeError: 'unsupported-message-data',
      },
    };
  }

  function summarizeTextPayload(body: string): { metadata: Record<string, string> } {
    const payloadLength = new TextEncoder().encode(body).byteLength;
    return {
      metadata: {
        payloadKind: 'text',
        payloadLength: String(payloadLength),
        wireEncoding: 'text',
      },
    };
  }

  function summarizeBinaryBytes(bytes: Uint8Array): { body: string; metadata: Record<string, string> } {
    const previewBytes = bytes.slice(0, 32);
    const truncated = bytes.byteLength > previewBytes.byteLength;
    const hexPreview = Array.from(previewBytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
    const base64Preview = bytesToBase64(previewBytes);
    const suffix = truncated ? ' ...' : '';
    return {
      body: `[binary frame: ${bytes.byteLength} B] hex ${hexPreview}${suffix}`,
      metadata: {
        payloadKind: 'binary',
        payloadLength: String(bytes.byteLength),
        wireEncoding: 'binary',
        wirePreviewHex: `${hexPreview}${suffix}`,
        wirePreviewBase64: `${base64Preview}${suffix}`,
      },
    };
  }

  function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return window.btoa(binary);
  }

  function clearPendingSocket(url: string): void {
    if (pageWindow[pendingSocketUrlKey] === url) pageWindow[pendingSocketUrlKey] = undefined;
  }

  function isConnectSrcViolation(event: SecurityPolicyViolationEvent): boolean {
    return event.effectiveDirective === 'connect-src' || event.violatedDirective === 'connect-src';
  }

  function blockedUriMatches(blockedUri: string, socketUrl: string): boolean {
    if (blockedUri === socketUrl) return true;

    try {
      return new URL(blockedUri).origin === new URL(socketUrl).origin;
    } catch {
      return false;
    }
  }

  function pageCspMessage(socketUrl: string, directive: string): string {
    return `Page CSP blocked ${socketUrl} (${directive}). Page engine sockets obey the host page connect-src policy. Use Extension engine for arbitrary echo hosts, or enable Page CSP bypass for this tab and reconnect.`;
  }

  function isUiMessage(value: unknown): value is { source: string; type: 'connect'; url: string; protocol?: string } | { source: string; type: 'send'; body: string } | { source: string; type: 'stop' } {
    if (typeof value !== 'object' || value === null) return false;
    const record = value as Record<string, unknown>;
    if (record.source !== uiSource || typeof record.type !== 'string') return false;
    if (record.type === 'connect') return typeof record.url === 'string' && (!('protocol' in record) || typeof record.protocol === 'string');
    if (record.type === 'send') return typeof record.body === 'string';
    return record.type === 'stop';
  }
})();

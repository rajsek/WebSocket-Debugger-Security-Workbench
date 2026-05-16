export type PayloadKind = 'text' | 'binary';

export interface WirePayloadSummary {
  body: string;
  payloadKind: PayloadKind;
  payloadLength: number;
  metadata: Record<string, string>;
}

const binaryPreviewByteLimit = 32;

export function summarizeTextPayload(body: string): WirePayloadSummary {
  const payloadLength = new TextEncoder().encode(body).byteLength;
  return {
    body,
    payloadKind: 'text',
    payloadLength,
    metadata: {
      payloadKind: 'text',
      payloadLength: String(payloadLength),
      wireEncoding: 'text',
    },
  };
}

export function summarizeArrayBufferPayload(buffer: ArrayBuffer): WirePayloadSummary {
  return summarizeBinaryBytes(new Uint8Array(buffer));
}

export async function summarizeWebSocketMessageData(data: unknown): Promise<WirePayloadSummary> {
  if (typeof data === 'string') return summarizeTextPayload(data);
  if (data instanceof ArrayBuffer) return summarizeArrayBufferPayload(data);
  if (ArrayBuffer.isView(data)) return summarizeBinaryBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (data instanceof Blob) return summarizeArrayBufferPayload(await data.arrayBuffer());

  return {
    body: '[binary frame: unavailable]',
    payloadKind: 'binary',
    payloadLength: 0,
    metadata: {
      payloadKind: 'binary',
      payloadLength: '0',
      wireEncoding: 'binary',
      wireDecodeError: 'unsupported-message-data',
    },
  };
}

export function summarizeCdpBinaryPayload(payloadData: string): WirePayloadSummary {
  const bytes = bytesFromBase64(payloadData);
  if (!bytes) {
    return {
      body: '[binary frame: unavailable]',
      payloadKind: 'binary',
      payloadLength: 0,
      metadata: {
        payloadKind: 'binary',
        payloadLength: '0',
        wireEncoding: 'base64',
        wireDecodeError: 'invalid-base64',
      },
    };
  }

  return summarizeBinaryBytes(bytes);
}

function summarizeBinaryBytes(bytes: Uint8Array): WirePayloadSummary {
  const previewBytes = bytes.slice(0, binaryPreviewByteLimit);
  const truncated = bytes.byteLength > previewBytes.byteLength;
  const hexPreview = bytesToHex(previewBytes);
  const base64Preview = bytesToBase64(previewBytes);
  const suffix = truncated ? ' ...' : '';
  const body = `[binary frame: ${bytes.byteLength} B] hex ${hexPreview}${suffix}`;

  return {
    body,
    payloadKind: 'binary',
    payloadLength: bytes.byteLength,
    metadata: {
      payloadKind: 'binary',
      payloadLength: String(bytes.byteLength),
      wireEncoding: 'binary',
      wirePreviewHex: `${hexPreview}${suffix}`,
      wirePreviewBase64: `${base64Preview}${suffix}`,
    },
  };
}

function bytesFromBase64(value: string): Uint8Array | null {
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return globalThis.btoa(binary);
}

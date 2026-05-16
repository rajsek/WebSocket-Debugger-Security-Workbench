import { summarizeArrayBufferPayload, summarizeCdpBinaryPayload, summarizeTextPayload } from './binaryPayload';

describe('binary payload summaries', () => {
  it('summarizes text payloads with byte length metadata', () => {
    const summary = summarizeTextPayload('hello');

    expect(summary.body).toBe('hello');
    expect(summary.metadata).toMatchObject({
      payloadKind: 'text',
      payloadLength: '5',
      wireEncoding: 'text',
    });
  });

  it('summarizes array buffers as bounded hex and base64 previews', () => {
    const summary = summarizeArrayBufferPayload(new Uint8Array([0, 1, 2, 253, 254, 255]).buffer);

    expect(summary.body).toBe('[binary frame: 6 B] hex 00 01 02 fd fe ff');
    expect(summary.metadata).toMatchObject({
      payloadKind: 'binary',
      payloadLength: '6',
      wireEncoding: 'binary',
      wirePreviewHex: '00 01 02 fd fe ff',
      wirePreviewBase64: 'AAEC/f7/',
    });
  });

  it('decodes CDP binary payloadData as base64 bytes', () => {
    const summary = summarizeCdpBinaryPayload('AAEC/f7/');

    expect(summary.payloadLength).toBe(6);
    expect(summary.body).toContain('00 01 02 fd fe ff');
  });
});

import { validateWebSocketUrl } from './url';

describe('validateWebSocketUrl', () => {
  it('accepts WebSocket schemes', () => {
    expect(validateWebSocketUrl('ws://example.com/socket').protocol).toBe('ws:');
    expect(validateWebSocketUrl('wss://example.com/socket').protocol).toBe('wss:');
  });

  it('rejects non-WebSocket schemes', () => {
    expect(() => validateWebSocketUrl('https://example.com/socket')).toThrow('URL must use ws:// or wss://');
  });
});

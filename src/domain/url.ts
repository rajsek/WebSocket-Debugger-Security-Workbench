export function validateWebSocketUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new Error('URL must use ws:// or wss://');
  }
  return parsed;
}

export function originFromTabUrl(value: string | undefined): string {
  if (!value) return 'unknown';
  const parsed = new URL(value);
  return parsed.origin;
}

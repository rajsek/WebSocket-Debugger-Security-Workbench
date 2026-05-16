import { createEvidenceRecord } from './evidence';
import { validateWebSocketUrl } from './url';
import type { SecurityRunRequest, TestResultRecord } from './types';

export function canRunSecurityTest(request: SecurityRunRequest): { ok: true } | { ok: false; reason: string } {
  if (!request.target.socketUrl) return { ok: false, reason: 'Select a WebSocket target before running a test.' };

  try {
    validateWebSocketUrl(request.target.socketUrl);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Invalid WebSocket URL.' };
  }

  const socketUrl = new URL(request.target.socketUrl);
  if (request.target.tabOrigin !== 'unknown' && new URL(request.target.tabOrigin).host !== socketUrl.host) {
    return { ok: false, reason: 'Selected socket host must match the visible target host.' };
  }

  if (request.test.mode === 'active' && !request.authorizationConfirmed) {
    return { ok: false, reason: 'Active tests require explicit authorization confirmation.' };
  }

  return { ok: true };
}

export async function runPassiveSecurityTest(request: SecurityRunRequest): Promise<TestResultRecord> {
  const readiness = canRunSecurityTest(request);
  if (!readiness.ok) {
    return createEvidenceRecord(request, 'blocked', readiness.reason);
  }

  if (request.test.id === 'handshake-secure-scheme') {
    const status = request.target.socketUrl.startsWith('wss://') ? 'passed' : 'warning';
    return createEvidenceRecord(request, status, request.target.socketUrl.startsWith('wss://') ? 'Uses wss://.' : 'Uses plaintext ws://.');
  }

  return createEvidenceRecord(request, 'ready', 'Passive observation recorded.');
}

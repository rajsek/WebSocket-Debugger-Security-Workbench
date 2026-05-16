import { securityTests } from './securityCatalog';
import { canRunSecurityTest } from './securityRunner';
import type { SecurityRunRequest, TargetContext } from './types';

const target: TargetContext = {
  tabId: 1,
  tabOrigin: 'https://example.com',
  socketUrl: 'wss://example.com/socket',
  subprotocol: '',
  engine: 'extension',
  authAssumption: 'unknown',
  executionContext: 'extension-context',
  debuggerCaptureEnabled: false,
  pageCspBypassEnabled: false,
  pageCspHeaderStripEnabled: false,
  pageCspMetaProbeInjected: false,
  pageSessionStale: false,
};

describe('security tests', () => {
  it('marks every catalog test as passive or active', () => {
    expect(securityTests.length).toBeGreaterThan(0);
    expect(securityTests.every((test) => test.mode === 'passive' || test.mode === 'active')).toBe(true);
  });

  it('blocks active tests unless authorization and target are set', () => {
    const active = securityTests.find((test) => test.mode === 'active');
    expect(active).toBeDefined();

    const request: SecurityRunRequest = {
      test: active!,
      target,
      authorizationConfirmed: false,
      payload: '{}',
      note: '',
    };

    expect(canRunSecurityTest(request)).toEqual({ ok: false, reason: 'Active tests require explicit authorization confirmation.' });
    expect(canRunSecurityTest({ ...request, authorizationConfirmed: true })).toEqual({ ok: true });
    expect(canRunSecurityTest({ ...request, target: { ...target, socketUrl: '' }, authorizationConfirmed: true })).toEqual({
      ok: false,
      reason: 'Select a WebSocket target before running a test.',
    });
  });

  it('blocks testing a different host than the visible target', () => {
    const passive = securityTests.find((test) => test.mode === 'passive')!;
    const request: SecurityRunRequest = {
      test: passive,
      target: { ...target, socketUrl: 'wss://other.example/socket' },
      authorizationConfirmed: false,
      payload: '',
      note: '',
    };

    expect(canRunSecurityTest(request)).toEqual({ ok: false, reason: 'Selected socket host must match the visible target host.' });
  });
});

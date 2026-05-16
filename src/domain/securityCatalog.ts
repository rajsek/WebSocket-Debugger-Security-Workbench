import type { SecurityTest } from './types';

export const securityTests: SecurityTest[] = [
  {
    id: 'handshake-secure-scheme',
    category: 'handshake',
    mode: 'passive',
    title: 'Secure Scheme Check',
    description: 'Record whether the selected socket uses wss:// instead of plaintext ws://.',
    preconditions: ['Select the exact socket URL shown in the debugger top strip.'],
    owaspRefs: ['OWASP WebSocket Security Cheat Sheet: Transport Confidentiality'],
  },
  {
    id: 'handshake-auth-context',
    category: 'handshake',
    mode: 'passive',
    title: 'Authentication Context Note',
    description: 'Document whether the connection is expected to inherit page session auth or use manual credentials.',
    preconditions: ['Confirm the visible target origin matches the application under test.'],
    owaspRefs: ['OWASP WebSocket Security Cheat Sheet: Authentication and Authorization'],
  },
  {
    id: 'message-edited-resource-id',
    category: 'authorization',
    mode: 'active',
    title: 'Edited Resource Identifier',
    description: 'Resend one valid message after manually changing a resource identifier and record the server response.',
    preconditions: ['Capture a valid frame.', 'Edit only the resource identifier field.', 'Use an approved test account.'],
    defaultPayload: '{"id":"replace-with-other-authorized-test-id"}',
    owaspRefs: ['OWASP Top 10: A01 Broken Access Control', 'OWASP WebSocket Security Cheat Sheet: Authorization'],
  },
  {
    id: 'injection-json-field',
    category: 'injection',
    mode: 'active',
    title: 'Low-Impact JSON Field Injection',
    description: 'Insert a curated low-impact string into one JSON field and record whether the server rejects or sanitizes it.',
    preconditions: ['Use a non-production target or approved test environment.', 'Choose one harmless text field.'],
    defaultPayload: '{"message":"<script>alert(1)</script>"}',
    owaspRefs: ['OWASP Top 10: A03 Injection', 'OWASP WebSocket Security Cheat Sheet: Input Validation'],
  },
  {
    id: 'replay-old-frame',
    category: 'replay',
    mode: 'active',
    title: 'Replay Captured Frame',
    description: 'Resend an old captured frame and compare accepted or rejected behavior.',
    preconditions: ['Select an old non-destructive frame.', 'Confirm replay is authorized for this target.'],
    owaspRefs: ['OWASP WebSocket Security Cheat Sheet: Message Replay'],
  },
  {
    id: 'bounded-size-check',
    category: 'size-rate',
    mode: 'active',
    title: 'Bounded Size Check',
    description: 'Send one bounded oversized message and record whether the connection remains controlled.',
    preconditions: ['Confirm the target is approved for load-like checks.', 'Payload remains below the UI limit.'],
    defaultPayload: '{"message":"REPEAT_1KB_MAX"}',
    owaspRefs: ['OWASP WebSocket Security Cheat Sheet: Denial of Service'],
  },
  {
    id: 'logging-sensitive-preview',
    category: 'logging',
    mode: 'passive',
    title: 'Sensitive Data Logging Review',
    description: 'Review extension evidence previews for token or cookie leakage before export.',
    preconditions: ['Capture representative frames.', 'Keep default redaction enabled.'],
    owaspRefs: ['OWASP Top 10: A09 Security Logging and Monitoring Failures'],
  },
];

export function getSecurityTest(id: string): SecurityTest {
  const test = securityTests.find((candidate) => candidate.id === id);
  if (!test) throw new Error(`Unknown security test: ${id}`);
  return test;
}

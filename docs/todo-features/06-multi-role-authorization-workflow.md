# Multi-Role Authorization Workflow

Status: TODO

Importance: 8/10

Rank: 6

## What The Feature Is

Add a workflow for comparing WebSocket behavior across two or more authorized test roles.

Many real WebSocket findings are access-control issues: a low-privilege role can replay or mutate a frame captured from another role, or can access another user's object by changing an identifier.

## What To Add

- Role labels for sessions such as owner, member, viewer, admin, and attacker test account.
- Ability to mark captured frames as belonging to a role.
- Comparison view for same operation across roles.
- Replay builder support for "captured as role A, replayed as role B."
- Evidence fields for acting role, source role, and expected authorization boundary.
- Tests for role labels, transcript export, and replay metadata.

## How It Benefits Users

- Users can structure IDOR and broken-access-control testing.
- Findings become easier to explain: who could do what, and why that was wrong.
- Reports can document role setup without relying on loose notes.
- Retesting becomes more repeatable.

## Why This Importance

8/10 because multi-role workflows are high-value for bounty prep, but they depend on good passive capture and evidence models first.

## Contract Notes

- The tool should not bypass authentication.
- The user provides and controls authorized accounts.
- Keep role labels descriptive; do not imply exploit success without observed response evidence.


# Active Test Safety Rails

Status: TODO

Importance: 9/10

Rank: 5

## What The Feature Is

Add stronger safety controls around every active test so bug-bounty workflows stay deliberate, bounded, and auditable.

The current authorization checkbox is necessary but not sufficient. Active testing needs target scope, payload bounds, clear confirmation, and predictable limits.

## What To Add

- A preflight decision panel before active sends.
- Hard payload size limits with per-profile overrides.
- One-send confirmation for active Security Lab tests.
- Cooldown or rate limit for active sends.
- Blocking for unknown origin, opaque origin, stale page session, no selected profile, and out-of-scope socket host.
- Clear active-test result states: blocked, sent, response-observed, no-response, failed.
- Tests for every block reason and confirmation path.

## How It Benefits Users

- Users avoid accidental load-like behavior.
- The UI explains why a risky action is blocked.
- Active tests become easier to justify in reports and safer during live program testing.
- Mistakes from stale tabs or wrong target context are reduced.

## Why This Importance

9/10 because safety is not polish in a security tool. It is part of the product contract.

## Contract Notes

- No loops, fuzzing, or bulk sends by default.
- Authorization confirmation must be scoped to the current profile and target, not global forever.
- A blocked test should still produce useful evidence explaining the block reason.


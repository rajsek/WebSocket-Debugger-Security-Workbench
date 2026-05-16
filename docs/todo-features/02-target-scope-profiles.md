# Target Scope Profiles

Status: TODO

Importance: 9/10

Rank: 2

## What The Feature Is

Add explicit bug-bounty scope profiles so the tool knows which origins, socket hosts, roles, accounts, and environments are authorized for testing.

The current same-host check is useful but too small. Bug-bounty programs often allow some hosts, forbid others, and distinguish production, staging, demo, and third-party infrastructure.

## What To Add

- A profile model with program name, allowed origins, allowed WebSocket hosts, denied hosts, environment label, test account notes, role labels, and out-of-scope patterns.
- A profile selector in the UI.
- A scope decision function that returns allowed, blocked, or unknown with a specific reason.
- Blocking logic for active tests when no profile is selected or the target is out of scope.
- Evidence export fields showing the active scope profile and the scope decision.
- Unit tests for allowed host, denied host, wildcard, unknown origin, and out-of-scope cases.

## How It Benefits Users

- Users avoid accidentally testing the wrong host.
- Evidence becomes easier to map to program scope.
- The tool can clearly explain why an active test is blocked.
- Users can switch between bug-bounty programs without relying on memory.

## Why This Importance

9/10 because scope mistakes are one of the fastest ways to turn valid research into invalid or risky testing.

## Contract Notes

- Do not infer authorization from a matching host alone.
- Unknown or opaque origins must block active testing until the user selects a profile and confirms scope.
- Keep profiles local unless a deliberate export/import feature is added.


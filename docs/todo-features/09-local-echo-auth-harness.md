# Local Echo And Authorization Harness

Status: TODO

Importance: 7/10

Rank: 9

## What The Feature Is

Add a repo-local WebSocket harness for repeatable debugger, capture, replay, and authorization tests.

The current public echo integration proves basic connectivity, but it does not validate authorization boundaries, role differences, close codes, binary frames, or malformed messages.

## What To Add

- A local WebSocket server script with no unnecessary dependencies.
- Endpoints for echo, auth-required echo, role-scoped resources, close-code scenarios, binary frame echo, delayed response, and oversized-message rejection.
- Deterministic fixtures for sent and received frames.
- Integration tests that run against the local harness.
- README instructions for manual extension testing against the local harness.

## How It Benefits Users

- Users can verify the extension without depending on a public service.
- Future features can be tested against realistic bug-bounty scenarios.
- Regressions in capture, replay, evidence, and safety logic become easier to catch.

## Why This Importance

7/10 because it is an enabling feature. It does not directly find bugs, but it prevents the tool from being validated against a toy public echo path only.

## Contract Notes

- Keep the harness local and explicit.
- Do not use it as proof that a real target is vulnerable.
- Include role and authorization scenarios early, not just echo.


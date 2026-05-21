## Why

Discovery import and replay-library flows now preserve useful transport metadata, but the UI still flattens the active target to mostly URL plus engine. That hides the actual connection contract from users after import/load and makes manual compose weaker than imported recipes.

The most important missing field is the WebSocket subprotocol. Browser WebSocket APIs can pass `Sec-WebSocket-Protocol` through `new WebSocket(url, protocol)`, and the current runtime already supports it, but the target setup does not expose it as a first-class input. In contrast, arbitrary handshake headers are only evidence/provenance in normal browser WebSocket flows and must not become editable replay controls.

## What Changes

- Add a compact `Context` details control near the target setup that reveals transport provenance and read-only handshake evidence.
- Keep `Subprotocol` visible as an editable target field because it is a reusable browser-supported transport input.
- After discovery import or replay-library load, show source request id, source type, engine, session assumption, handshake observed state, and redacted headers in the collapsed context panel.
- Add replay-library preview before queue load so users can inspect socket recipe/message-set metadata and mismatch warnings before mutating the Debugger target.
- Preserve the Compose editor as message-body-only; do not put arbitrary headers into Compose.

## Impact

- Affects the compact React workbench target strip, Debugger compose area, Discover import handoff, and Replay Library load flow.
- Does not change WebSocket transport capabilities beyond exposing the existing subprotocol field.
- Does not add new Chrome permissions.
- Requires UI and reducer tests around context visibility, subprotocol editing, import/load provenance display, read-only header behavior, and pre-load mismatch preview.


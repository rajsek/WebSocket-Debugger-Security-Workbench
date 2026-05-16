## Why

Users can discover or manually create useful WebSocket traffic, but there is no durable way to save the target plus selected outbound messages, load them later, edit them, and replay them against a newly created controlled socket. This matters now because discovery import already produces connection recipes and bootstrap candidates, but those artifacts remain session-local and are easy to confuse with protocol-aware request/response correlation.

## What Changes

- Add a replay library for saving WebSocket replay artifacts from discovered sockets and current controlled debugger state.
- Store socket target metadata separately from outbound message sets so users can save a target, a message set, or both.
- Preserve replay-relevant target metadata such as engine choice, page/session assumption, observed subprotocol, and source provenance without claiming arbitrary header replay.
- Allow users to load a saved replay artifact into the Debugger as an editable replay queue without connecting automatically.
- Require an explicit connect before replay and an explicit user action before sending queued messages.
- Record replay-run evidence with source provenance, selected messages, edited state, target metadata, and received transcript context.
- Keep v1 generic: record transcript, replay outbound messages, and compare later inbound traffic without claiming protocol-aware request/response matching.
- Keep raw replay payload handling explicit because replayable payloads may contain secrets and differ from redacted evidence exports.

## Capabilities

### New Capabilities

- `websocket-replay-library`: Save, load, edit, and replay WebSocket target/message artifacts with explicit provenance and replay-run evidence.

### Modified Capabilities

- None.

## Impact

- Adds replay artifact domain models such as saved socket recipe, saved message set, replay queue item, and replay run.
- Adds a replay library persistence boundary, likely backed by `chrome.storage.local` for small artifacts plus JSON import/export for larger or portable artifacts.
- Extends the compact React workbench with save/load/replay queue actions without replacing existing Debugger, Discover, Security, Debug Lab, or Evidence workflows.
- Extends evidence records to identify saved-artifact provenance and replay-run transcripts without mixing them with passive discovery or ordinary controlled frames.
- Adds tests for artifact creation, persistence adapter behavior, load/edit/send flow, replay evidence, raw-payload warnings, and non-correlation language.

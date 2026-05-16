## Why

Users need to know whether the current page already uses WebSockets before they create a separate debugger connection. The current debugger can connect, send, inspect, and produce evidence, but it does not yet capture the page's real socket URLs, handshake context, or early outbound messages that are needed to seed a realistic new test connection.

## What Changes

- Add a passive current-page WebSocket discovery workflow that observes WebSocket activity from the selected tab.
- Add a new compact `Discover` workbench tab that lists observed sockets, connection state, handshake summary, frame counts, and first outbound messages.
- Add an import workflow that turns an observed socket into a connection recipe for a new controlled debugger connection.
- Support two import modes:
  - `Import Target`: sets the socket URL and recommended engine without sending frames.
  - `Import With Bootstrap`: previews observed initial outbound messages and lets the user explicitly choose what to replay on a new connection.
- Add evidence records that distinguish observed runtime traffic from frames created by the workbench.
- Do not auto-send imported bootstrap frames or claim that the tool has taken over the page's existing socket.

## Capabilities

### New Capabilities
- `websocket-discovery`: Passive discovery of WebSocket activity on the selected page, including observed socket URLs, handshake metadata, frame summaries, lifecycle state, and capture status.
- `connection-recipe-import`: Import of an observed WebSocket setup into a new controlled debugger connection, including URL, engine recommendation, selected bootstrap frames, and evidence traceability.

### Modified Capabilities
- None.

## Impact

- Affects the React workbench tab model, top-level app state, and compact UI layout.
- Adds typed domain models for discovered sockets, capture events, connection recipes, and observed-frame evidence.
- Adds Chrome debugger-backed capture plumbing around `chrome.debugger` and CDP Network WebSocket events.
- Extends runtime message contracts between UI and background/service worker.
- Extends evidence export/redaction behavior for observed handshake metadata and bootstrap frame previews.
- Adds unit tests for CDP event parsing, recipe creation, import behavior, redaction, and UI state transitions.
- Requires manual runtime verification in a loaded extension against a page that creates WebSockets before and after capture starts.

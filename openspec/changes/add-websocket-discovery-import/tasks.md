## 1. Domain Contracts

- [x] 1.1 Add typed domain models for discovered sockets, capture status, handshake summaries, observed frame summaries, and connection recipes.
- [x] 1.2 Add parser utilities for CDP WebSocket Network events with request-id-based socket identity.
- [x] 1.3 Add redaction utilities for observed handshake headers and frame previews.
- [x] 1.4 Add recipe creation logic that derives URL, source request id, recommended engine, observed context, and bootstrap frame candidates.
- [x] 1.5 Add unit tests for CDP event parsing, repeated URL with distinct request ids, missing handshake metadata, redaction, and recipe creation.

## 2. Runtime Capture Plumbing

- [x] 2.1 Extend runtime command and event contracts for starting capture, stopping capture, capture-with-reload, capture status, capture snapshot, and detach notification.
- [x] 2.2 Implement a background-owned debugger capture adapter around `chrome.debugger.attach`, `Network.enable`, `chrome.debugger.onEvent`, `chrome.debugger.onDetach`, and clean detach.
- [x] 2.3 Maintain per-tab capture state keyed by tab id and request id without mixing observed traffic into controlled debugger frames.
- [x] 2.4 Handle tab removal, tab reload, service-worker restart gaps, debugger conflict, and manual stop with visible status.
- [x] 2.5 Add unit tests for runtime parsers and adapter state transitions using captured or representative CDP fixtures.

## 3. Discover Tab UI

- [x] 3.1 Add `Discover` to the workbench tab model without changing existing Debugger, Security, Debug Lab, or Evidence tab behavior.
- [x] 3.2 Build a compact Discover toolbar with start capture, stop capture, capture-with-reload, and capture status states.
- [x] 3.3 Build a discovered socket list showing URL, lifecycle state, request id, frame counts, last activity, and import action.
- [x] 3.4 Build selected socket details for redacted handshake summary, first outbound frame previews, error/close state, and add-to-evidence action.
- [x] 3.5 Add UI tests for empty state, listening state, discovered socket rendering, detach state, and add-to-evidence action.

## 4. Recipe Import

- [x] 4.1 Implement Import Target so an observed socket sets the current debugger socket URL and recommended engine without connecting or sending frames.
- [x] 4.2 Implement Import With Bootstrap so observed outbound bootstrap frames are previewed and user-selected before replay.
- [x] 4.3 Ensure import UI clearly states that the result is a new controlled connection seeded from observed data, not takeover of the page socket.
- [x] 4.4 Prevent unsupported arbitrary WebSocket request header replay while preserving redacted headers as evidence context.
- [x] 4.5 Add UI/domain tests for target-only import, page-engine recommendation, extension-engine override, no auto-connect, no auto-send, and selected bootstrap replay.

## 5. Evidence Integration

- [x] 5.1 Add evidence record types or metadata that distinguish observed runtime traffic, recipe imports, bootstrap replay, and controlled debugger frames.
- [x] 5.2 Extend evidence export formatting to include source request id, socket URL, redacted handshake summary, frame counts, selected bootstrap hashes/previews, and capture timestamps.
- [x] 5.3 Add tests for observed evidence export, redaction stability, and traceability from discovered socket to imported recipe.

## 6. Verification

- [x] 6.1 Run `npm test`.
- [x] 6.2 Run `npm run build`.
- [x] 6.3 Run `npm run test:integration` and report that it reaches the public echo endpoint.
- [ ] 6.4 Manually verify the loaded extension against a local page that creates WebSockets after capture starts.
- [ ] 6.5 Manually verify capture-with-reload against a page that creates a WebSocket during initial load.
- [ ] 6.6 Manually verify debugger detach/conflict behavior when Chrome DevTools attaches to the same tab.

## 1. Transport Context Contract

- [x] 1.1 Define the UI view model for transport context: source type, source request id, socket URL, engine, subprotocol, session assumption, handshake observed state, and redacted headers.
- [x] 1.2 Keep arbitrary request headers read-only and evidence-only in the view model.
- [x] 1.3 Add reducer/state support for retaining imported or loaded recipe provenance after the Debugger target is set.

## 2. Target Setup UI

- [x] 2.1 Add a compact editable `Subprotocol` field to the always-visible target setup.
- [x] 2.2 Add a small `Context` control that opens/collapses transport provenance and redacted handshake details.
- [x] 2.3 Show `manual`, `discovered request <id>`, or `saved recipe` source state in the context panel.
- [x] 2.4 Show custom request/response headers as read-only redacted evidence and state that they are not replayable browser WebSocket inputs.

## 3. Import And Replay Library UI

- [x] 3.1 After `Import Target` or `Import With Bootstrap`, preserve and display imported source request id, subprotocol, engine, session assumption, and handshake observed state in the Debugger context panel.
- [x] 3.2 Add Replay Library pre-load preview for selected socket recipe and message set metadata before changing the Debugger target.
- [x] 3.3 Show source mismatch warnings in the Replay Library before load, not only after queue creation.
- [x] 3.4 Keep Compose scoped to message-body editing and avoid adding arbitrary header inputs there.

## 4. Verification

- [x] 4.1 Add UI tests for editing subprotocol from target setup and passing it into connect.
- [x] 4.2 Add UI tests for imported discovery context showing source request id and read-only redacted headers.
- [x] 4.3 Add UI tests for replay-library pre-load metadata and mismatch warning.
- [x] 4.4 Run `npm test`.
- [x] 4.5 Run `npm run build`.

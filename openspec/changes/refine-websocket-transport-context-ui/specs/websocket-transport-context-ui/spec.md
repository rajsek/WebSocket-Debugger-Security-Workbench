## ADDED Requirements

### Requirement: Expose reusable transport inputs
The system SHALL expose browser-supported WebSocket transport inputs without implying unsupported header replay.

#### Scenario: User configures subprotocol manually
- **WHEN** the user edits the active WebSocket target
- **THEN** the UI SHALL expose an optional `Subprotocol` field as a normal connection input
- **AND** the controlled connection SHALL use that value when creating the new WebSocket connection

#### Scenario: Custom headers are not editable transport inputs
- **WHEN** the UI displays observed handshake request or response headers
- **THEN** the headers SHALL be read-only redacted context
- **AND** the UI SHALL NOT expose arbitrary custom headers as editable browser WebSocket connection inputs

### Requirement: Show target transport context
The system SHALL provide a compact collapsed context panel for the active WebSocket target.

#### Scenario: Manual target has no observed handshake
- **WHEN** the user manually enters a socket URL and no discovered or saved recipe is loaded
- **THEN** the context panel SHALL identify the source as manual
- **AND** it SHALL show the handshake state as unobserved

#### Scenario: Imported target shows provenance
- **WHEN** the user imports a discovered socket target
- **THEN** the context panel SHALL show the source request id, selected engine, subprotocol when present, session assumption, and handshake observed state

#### Scenario: Headers remain evidence-only
- **WHEN** imported or saved target context includes observed headers
- **THEN** the context panel SHALL show the redacted headers as evidence/provenance
- **AND** it SHALL state that arbitrary handshake headers cannot be replayed by normal browser WebSocket connections

### Requirement: Preview replay-library load context
The system SHALL show replay target/message metadata before loading a saved replay queue into the Debugger.

#### Scenario: User selects saved replay artifacts
- **WHEN** the user selects a saved socket recipe and saved message set in the Replay Library
- **THEN** the UI SHALL preview socket URL, selected engine, subprotocol, source type, source request id when available, message count, and handshake observed state before loading

#### Scenario: Source mismatch is visible before load
- **WHEN** the selected socket recipe and message set have different source socket metadata
- **THEN** the Replay Library SHALL show the mismatch warning before the user loads the editable queue

### Requirement: Keep Compose scoped to messages
The system SHALL keep the Compose editor focused on WebSocket message bodies.

#### Scenario: User composes a frame
- **WHEN** the user edits the Compose payload
- **THEN** the editor SHALL modify only the outbound WebSocket message body
- **AND** transport metadata such as subprotocol and observed handshake headers SHALL remain outside the payload editor


## ADDED Requirements

### Requirement: Save replay artifacts
The system SHALL allow users to save replay artifacts from discovered WebSocket sockets and current controlled debugger state.

#### Scenario: Save from discovered socket
- **WHEN** the user saves a discovered WebSocket for replay
- **THEN** the system SHALL create a saved socket recipe with socket URL, selected engine, source request id, observed origin context, observed subprotocol when available, and redacted handshake context

#### Scenario: Save selected discovered outbound messages
- **WHEN** the user selects text outbound bootstrap frames from a discovered socket and saves them for replay
- **THEN** the system SHALL create a saved message set containing ordered replayable message bodies and provenance for each selected source frame

#### Scenario: Save from current debugger frames
- **WHEN** the user saves selected outbound frames from the current controlled debugger frame list
- **THEN** the system SHALL create a saved message set from those outbound text frames without including inbound frames as replayable messages

### Requirement: Preserve replay provenance
The system SHALL preserve provenance for saved replay artifacts without mutating the original observed evidence or controlled frame history.

#### Scenario: Artifact records source metadata
- **WHEN** a saved replay artifact is created from discovered or controlled traffic
- **THEN** the artifact SHALL retain source type, source socket or target metadata, source frame ids or hashes, created timestamp, and updated timestamp

#### Scenario: Edited queue keeps source traceability
- **WHEN** the user edits a loaded replay queue item
- **THEN** the queue item SHALL retain its original source provenance and SHALL mark the item as edited with an edit timestamp

### Requirement: Version replay artifacts
The system SHALL version saved replay artifacts and imported replay artifact JSON so persisted data can evolve without silently changing runtime meaning.

#### Scenario: Persist versioned artifact
- **WHEN** a saved replay artifact is created
- **THEN** the artifact SHALL include a schema version and artifact kind that are validated before load, import, or replay

#### Scenario: Reject unsupported artifact version
- **WHEN** the user imports or loads a replay artifact with an unsupported schema version
- **THEN** the system SHALL reject the artifact with a visible error and SHALL NOT add it to the replay library or replay queue

### Requirement: Persist replay library
The system SHALL persist saved replay artifacts across workbench reloads and support explicit import/export.

#### Scenario: Load persisted library
- **WHEN** the workbench starts after saved replay artifacts exist
- **THEN** the replay library SHALL load saved artifacts from local extension storage and show them without requiring the original discovery snapshot to still exist

#### Scenario: Export saved artifact
- **WHEN** the user exports a saved replay artifact
- **THEN** the system SHALL export the selected socket recipe and message set with provenance and raw replay payloads only after making the raw-payload risk visible

#### Scenario: Import saved artifact
- **WHEN** the user imports a replay artifact JSON file
- **THEN** the system SHALL validate the artifact shape before adding it to the replay library

#### Scenario: Delete saved artifact
- **WHEN** the user deletes a saved replay artifact
- **THEN** the system SHALL remove the artifact from local replay-library storage and SHALL NOT remove already-created evidence records

#### Scenario: Clear replay library
- **WHEN** the user clears the replay library
- **THEN** the system SHALL remove locally stored replay artifacts after explicit confirmation and SHALL leave current controlled frames and evidence records unchanged

### Requirement: Raw replay payload warning
The system SHALL distinguish replayable raw payload storage from redacted evidence export.

#### Scenario: Save raw messages locally
- **WHEN** the user saves messages for replay
- **THEN** the UI SHALL make clear that saved replay messages may contain secrets and are different from redacted evidence previews

#### Scenario: Evidence remains redacted
- **WHEN** replay artifacts or replay runs are added to evidence
- **THEN** evidence output SHALL use hashes and redacted previews rather than full raw replay payloads

#### Scenario: Export requires raw-payload confirmation
- **WHEN** the user exports replay artifacts that contain raw message bodies
- **THEN** the system SHALL require an explicit export confirmation that states the export may contain secrets

### Requirement: Load editable replay queue
The system SHALL allow users to load saved replay artifacts into an editable replay queue without connecting or sending automatically.

#### Scenario: Load socket recipe and message set
- **WHEN** the user loads a saved socket recipe and saved message set
- **THEN** the system SHALL set the debugger target from the saved socket recipe and populate an editable replay queue from a copy of the saved messages

#### Scenario: Load does not connect
- **WHEN** a saved replay artifact is loaded
- **THEN** the system SHALL NOT create a WebSocket connection and SHALL NOT send queued messages automatically

#### Scenario: Source mismatch is visible
- **WHEN** the user loads a message set whose source socket metadata differs from the loaded socket recipe
- **THEN** the system SHALL keep the queue load explicit and SHALL show the source mismatch before replay

### Requirement: Explicit replay execution
The system SHALL replay queued messages only through a newly created controlled socket after explicit user action.

#### Scenario: Replay requires open connection
- **WHEN** the user attempts to replay queued messages before the controlled socket is open
- **THEN** the system SHALL block replay and instruct the user to connect the target first

#### Scenario: Send next queued message
- **WHEN** the user chooses to send the next queued message while the controlled socket is open
- **THEN** the system SHALL send only that queued message and record it as an outbound controlled frame

#### Scenario: Send selected messages in order
- **WHEN** the user chooses to send selected queued messages while the controlled socket is open
- **THEN** the system SHALL send the selected messages in queue order and record each sent message as an outbound controlled frame

#### Scenario: Replay stops on socket failure
- **WHEN** the controlled socket closes or errors while queued messages remain unsent
- **THEN** the system SHALL stop replay, keep unsent queue items marked as unsent, and record a partial or failed replay status

### Requirement: Preserve supported transport metadata
The system SHALL preserve WebSocket transport metadata that browser WebSocket APIs can use and SHALL NOT expose unsupported arbitrary header replay as a replay option.

#### Scenario: Replay with observed subprotocol
- **WHEN** a saved socket recipe includes an observed WebSocket subprotocol
- **THEN** the controlled connection SHALL pass the subprotocol when creating the new WebSocket connection

#### Scenario: Custom headers are evidence only
- **WHEN** a saved socket recipe contains observed custom request headers
- **THEN** the system SHALL keep those headers as redacted evidence context and SHALL NOT offer them as editable replay headers

#### Scenario: Page engine uses current session
- **WHEN** a saved socket recipe is replayed with the Page engine
- **THEN** the system SHALL use the selected tab's current page session and SHALL NOT imply that old cookies, Origin state, CSP state, or page runtime state were preserved

### Requirement: Replay run evidence
The system SHALL record replay-run evidence that distinguishes saved-artifact replay from passive discovery and ordinary frame inspection.

#### Scenario: Replay run is recorded
- **WHEN** the user replays queued messages
- **THEN** the evidence record SHALL include replay run id, socket URL, selected engine, source artifact ids, message hashes or redacted previews, edited status, send timestamps, and inbound transcript context observed after replay begins

#### Scenario: Replay run has explicit end boundary
- **WHEN** a replay run starts
- **THEN** the system SHALL end the replay run only when the user finishes or cancels it, the controlled socket closes, or the controlled socket errors

#### Scenario: Replay run records final status
- **WHEN** a replay run ends
- **THEN** the evidence record SHALL include a final status of completed, partial, failed, or cancelled

#### Scenario: Generic transcript is not request-response correlation
- **WHEN** replay-run evidence displays inbound frames observed after replay
- **THEN** the system SHALL describe them as replay transcript or later inbound traffic and SHALL NOT claim request/response pairing without a protocol-specific correlator

### Requirement: Reject unsupported replay payloads
The system SHALL avoid creating replayable queue items from payloads the v1 replay engine cannot send faithfully.

#### Scenario: Binary frame selected
- **WHEN** the user selects a binary frame for saving or replay
- **THEN** the system SHALL keep it as non-replayable evidence context and SHALL NOT add it to the replayable message queue

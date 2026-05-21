## ADDED Requirements

### Requirement: Capture ordered bootstrap transcript
The system SHALL create an imported bootstrap transcript that preserves observed inbound and outbound WebSocket frames in their captured order.

#### Scenario: Discovery imports mixed-direction bootstrap traffic
- **WHEN** a discovered socket has observed inbound and outbound bootstrap frames
- **THEN** the imported bootstrap transcript SHALL contain both directions ordered by observed sequence

#### Scenario: Multiple frames share one socket identity
- **WHEN** frames are imported from a discovered socket
- **THEN** every transcript row SHALL preserve the source socket request identifier and source frame provenance

### Requirement: Preserve observed evidence separately from working transcript
The system SHALL keep discovery observations immutable and create a separate working transcript for replay edits, selection, skipping, and removal.

#### Scenario: User edits imported outbound row
- **WHEN** the user edits an outbound row in the imported transcript
- **THEN** the system SHALL update only the working transcript row and SHALL retain source provenance for the original observed frame

#### Scenario: User removes imported row
- **WHEN** the user removes a row from the working transcript
- **THEN** the system SHALL remove or mark that working row without mutating the original discovered socket snapshot or already-created evidence

### Requirement: Classify transcript rows by replay role
The system SHALL classify each imported transcript row as sendable, wait checkpoint, or observed-only based on direction and payload support.

#### Scenario: Outbound text row
- **WHEN** an imported transcript row is outbound text
- **THEN** the system SHALL mark it as sendable and SHALL allow selection, editing, sending, skipping, removal, and inspection

#### Scenario: Inbound row
- **WHEN** an imported transcript row is inbound
- **THEN** the system SHALL make it read-only and SHALL allow checkpoint waiting, skipping, removal, and inspection but SHALL NOT allow sending or payload editing

#### Scenario: Unsupported payload row
- **WHEN** an imported transcript row has a binary or otherwise unsupported payload
- **THEN** the system SHALL keep it as observed-only context and SHALL NOT add it to the sendable replay queue

### Requirement: Render live stream and imported transcript with shared row presentation
The system SHALL reuse the existing stream-pane style and row presentation for live stream rows and imported transcript rows while keeping their data sources and controls separate.

#### Scenario: Live stream receives new frames
- **WHEN** the controlled WebSocket receives or sends live frames
- **THEN** the live stream pane SHALL continue appending live rows without modifying the imported transcript rows

#### Scenario: Imported transcript is displayed
- **WHEN** the user views an imported bootstrap transcript
- **THEN** the transcript pane SHALL show rows with the same direction, preview, timestamp, and selection affordances as the live stream where applicable, plus imported-row replay actions

#### Scenario: User edits imported transcript row
- **WHEN** the user edits, skips, removes, or selects an imported transcript row
- **THEN** the system SHALL update imported transcript state and SHALL NOT rewrite live controlled stream history

### Requirement: Provide row-level transcript controls
The system SHALL let users control replay participation at the row level before and during replay.

#### Scenario: User selects subset of imported rows
- **WHEN** the user selects only some rows from an imported transcript
- **THEN** ordered replay SHALL consider only the selected rows that remain in the working transcript

#### Scenario: User sends one outbound row
- **WHEN** the user chooses send on a sendable outbound row while the controlled socket is open
- **THEN** the system SHALL send only that row's current body and update that row status to sent

#### Scenario: User tries to send inbound row
- **WHEN** the user acts on an inbound transcript row
- **THEN** the system SHALL NOT expose a send action for that row

#### Scenario: User skips row
- **WHEN** the user skips a transcript row
- **THEN** ordered replay SHALL not send or wait on that row and SHALL mark it skipped

### Requirement: Run ordered transcript replay
The system SHALL replay selected transcript rows in their working transcript order through a newly opened controlled WebSocket only after explicit user action.

#### Scenario: Replay requires open controlled socket
- **WHEN** the user starts ordered replay before the controlled socket is open
- **THEN** the system SHALL block replay and show that the imported target must be connected first

#### Scenario: Replay sends selected outbound rows in order
- **WHEN** the user starts ordered replay without waits
- **THEN** the system SHALL send selected sendable outbound rows in transcript order and SHALL skip inbound checkpoint rows

#### Scenario: Replay honors removed and skipped rows
- **WHEN** ordered replay reaches a removed or skipped row
- **THEN** the system SHALL not send or wait on that row

### Requirement: Support inbound wait checkpoints
The system SHALL optionally pause ordered replay at selected inbound checkpoint rows until matching inbound controlled traffic is observed or a timeout occurs.

#### Scenario: Checkpoint matches inbound frame
- **WHEN** ordered replay with waits reaches an inbound checkpoint and a matching inbound controlled frame is observed before timeout
- **THEN** the system SHALL mark the checkpoint matched and continue replaying later selected rows

#### Scenario: Checkpoint times out
- **WHEN** ordered replay with waits reaches an inbound checkpoint and no matching inbound controlled frame is observed before timeout
- **THEN** the system SHALL mark the checkpoint timed out, stop or pause the replay run, and show an explicit timeout state

#### Scenario: User skips waiting checkpoint
- **WHEN** the user skips a waiting inbound checkpoint
- **THEN** the system SHALL mark the row skipped and continue or stop according to the current replay control

### Requirement: Preserve replay statuses per transcript row
The system SHALL expose row-level statuses for ordered transcript replay so the user can see what was queued, sent, waiting, matched, timed out, skipped, removed, or failed.

#### Scenario: Replay status changes
- **WHEN** a transcript row changes replay state
- **THEN** the transcript table SHALL update only that row's visible replay status

#### Scenario: Socket closes during replay
- **WHEN** the controlled socket closes or errors during ordered replay
- **THEN** the system SHALL stop replay, mark remaining eligible rows unsent or skipped according to their prior state, and record the run as partial or failed

### Requirement: Record ordered transcript replay evidence
The system SHALL record ordered transcript replay evidence with provenance, selected rows, edits, send timestamps, checkpoint outcomes, and final run status.

#### Scenario: Replay run completes
- **WHEN** ordered transcript replay completes
- **THEN** evidence SHALL include the source socket request identifier, imported transcript row provenance, selected and skipped rows, outbound send metadata, inbound checkpoint outcomes, and final run status

#### Scenario: Outbound row was edited
- **WHEN** an edited outbound transcript row is sent during replay
- **THEN** evidence SHALL identify that the sent body was edited and SHALL preserve the original source frame provenance using hashes or redacted previews

#### Scenario: Evidence describes inbound traffic
- **WHEN** evidence includes inbound rows observed or matched during transcript replay
- **THEN** the system SHALL describe them as checkpoints, matched inbound frames, timed out checkpoints, or replay transcript context and SHALL NOT claim request-response correlation

### Requirement: Keep browser replay limits visible
The system SHALL preserve supported WebSocket transport metadata and SHALL NOT expose unsupported replay controls for arbitrary request headers or existing page socket takeover.

#### Scenario: Imported transcript has observed headers
- **WHEN** the source discovered socket includes observed handshake headers
- **THEN** the transcript replay flow SHALL keep those headers as redacted evidence context and SHALL NOT turn them into editable replay headers

#### Scenario: User imports transcript
- **WHEN** the user imports an ordered bootstrap transcript
- **THEN** the system SHALL describe replay as a new controlled connection seeded from observed traffic and SHALL NOT imply takeover of the existing page WebSocket

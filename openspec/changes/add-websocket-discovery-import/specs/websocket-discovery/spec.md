## ADDED Requirements

### Requirement: Current page WebSocket discovery
The system SHALL provide a Discover workflow that passively observes WebSocket activity for the selected browser tab without creating a workbench-owned WebSocket connection.

#### Scenario: Capture starts for selected tab
- **WHEN** the user starts discovery for a selected tab
- **THEN** the system SHALL attach debugger capture for that tab, enable WebSocket network observation, and show capture status as listening after setup succeeds

#### Scenario: Capture does not create socket traffic
- **WHEN** discovery capture is listening
- **THEN** the system SHALL NOT create a new WebSocket connection or send WebSocket frames as part of passive discovery

### Requirement: Discovered socket identity
The system SHALL identify discovered sockets by a runtime request identifier and SHALL NOT treat socket URL as the unique identity.

#### Scenario: Multiple sockets share URL
- **WHEN** two observed WebSockets use the same URL with different runtime request identifiers
- **THEN** the system SHALL list them as distinct discovered sockets

### Requirement: WebSocket lifecycle transcript
The system SHALL record lifecycle state for each discovered WebSocket, including creation, handshake observation, frame activity, error, and close events when those events are available.

#### Scenario: Socket receives lifecycle events
- **WHEN** the capture adapter receives creation, frame, and close events for a WebSocket request
- **THEN** the Discover tab SHALL show the socket URL, current lifecycle state, frame counts, and last observed activity for that request

#### Scenario: Socket errors
- **WHEN** the capture adapter receives a WebSocket error event
- **THEN** the Discover tab SHALL mark the discovered socket as errored and preserve the error as evidence context

### Requirement: Handshake summary
The system SHALL display a redacted handshake summary for observed WebSockets when handshake request or response metadata is available.

#### Scenario: Handshake metadata is available
- **WHEN** the capture adapter receives handshake request or response metadata
- **THEN** the Discover tab SHALL display redacted headers, status, protocols, and timing fields that are safe to show

#### Scenario: Handshake metadata is missing
- **WHEN** discovery starts after the handshake event has already occurred
- **THEN** the system SHALL mark handshake metadata as not observed rather than inventing or inferring it

### Requirement: Startup socket reload capture
The system SHALL provide a user-initiated capture-and-reload path for pages that create WebSockets during initial load.

#### Scenario: User captures startup sockets
- **WHEN** the user chooses capture with reload
- **THEN** the system SHALL start capture before reloading the target tab and SHALL keep the Discover workflow in a listening state after reload

### Requirement: Debugger detach handling
The system SHALL make debugger capture ownership and detach state visible to the user.

#### Scenario: Debugger detaches
- **WHEN** Chrome detaches the debugger session for the selected tab
- **THEN** the Discover tab SHALL stop capture, show a detached or conflict state, and SHALL NOT show stale capture as active

### Requirement: Observed traffic evidence
The system SHALL allow users to add discovered socket metadata and observed frame summaries to evidence without mixing them with workbench-generated frames.

#### Scenario: User saves observed socket evidence
- **WHEN** the user adds a discovered socket to evidence
- **THEN** the evidence record SHALL identify it as observed runtime traffic and include the request identifier, socket URL, redacted handshake summary, observed frame counts, and capture timestamps

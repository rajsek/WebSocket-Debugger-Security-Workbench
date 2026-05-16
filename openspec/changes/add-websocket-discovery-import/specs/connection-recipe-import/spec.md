## ADDED Requirements

### Requirement: Import observed socket as connection recipe
The system SHALL allow users to import a discovered WebSocket as a connection recipe for a new controlled workbench connection.

#### Scenario: Import target only
- **WHEN** the user chooses Import Target for a discovered socket
- **THEN** the system SHALL set the debugger target URL from the discovered socket and SHALL NOT connect or send frames automatically

#### Scenario: Import preserves source traceability
- **WHEN** a discovered socket is imported as a recipe
- **THEN** the system SHALL retain the source request identifier and observed capture metadata for evidence traceability

### Requirement: Imported connection is not existing socket takeover
The system SHALL clearly distinguish recipe import from reuse or takeover of the page's existing WebSocket instance.

#### Scenario: User imports a discovered socket
- **WHEN** the user imports a discovered socket
- **THEN** the UI and evidence metadata SHALL describe the result as a new controlled connection seeded from observed data

### Requirement: Engine recommendation
The system SHALL recommend an engine for imported recipes based on the observed page context and SHALL allow the user to review the choice before connecting.

#### Scenario: Page-session reproduction is likely needed
- **WHEN** the discovered socket appears tied to the selected page origin or page session context
- **THEN** the import flow SHALL recommend the Page engine and explain that browser-managed cookies, Origin, CSP, and page context can affect the new connection

#### Scenario: User chooses isolated testing
- **WHEN** the user chooses the Extension engine for an imported recipe
- **THEN** the system SHALL preserve the choice and SHALL NOT imply that arbitrary page request headers or browser-managed session behavior will be replayed

### Requirement: Header replay limits
The system SHALL record observed request headers as evidence context but SHALL NOT expose unsupported arbitrary WebSocket request header replay as a connection option.

#### Scenario: Observed custom headers exist
- **WHEN** the discovered handshake includes request headers that normal WebSocket JavaScript cannot set
- **THEN** the import flow SHALL show them as redacted evidence context and SHALL NOT convert them into editable reconnect headers

### Requirement: Bootstrap frame selection
The system SHALL allow users to preview and select observed initial outbound frames before replaying any bootstrap messages on a new connection.

#### Scenario: Import with bootstrap
- **WHEN** the user chooses Import With Bootstrap
- **THEN** the system SHALL show observed outbound bootstrap frame previews and require explicit user selection before replay

#### Scenario: No automatic bootstrap send
- **WHEN** a connection recipe includes observed outbound bootstrap frames
- **THEN** the system SHALL NOT send those frames until the user explicitly confirms replay on the new controlled connection

### Requirement: Recipe evidence
The system SHALL record recipe import actions and bootstrap replay actions as evidence distinct from passive discovery and ordinary debugger frames.

#### Scenario: User imports and replays bootstrap
- **WHEN** the user imports a recipe and sends selected bootstrap frames on a new controlled connection
- **THEN** the evidence record SHALL include the source discovered socket, selected engine, selected bootstrap frame hashes or previews, and resulting controlled connection frame metadata

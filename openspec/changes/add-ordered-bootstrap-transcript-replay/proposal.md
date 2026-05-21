## Why

The current bootstrap flow keeps only early outbound text frames and replays selected frames as a batch, so imported discovery loses the inbound context that explains the observed sequence. Users need a replay workflow that preserves the captured inbound and outbound bootstrap transcript in order, while still making only outbound rows sendable.

## What Changes

- Add an ordered bootstrap transcript artifact derived from discovery capture that contains inbound and outbound observed frames in their original order.
- Replace outbound-only bootstrap selection with a transcript table where each row can be selected, skipped, removed, inspected, and, when outbound text, edited or sent.
- Reuse the existing stream-pane/frame-row visual language for imported transcript rows while keeping live stream rows as a separate updating source.
- Add ordered replay controls for send next, send selected, run in observed order, and run in observed order with inbound wait checkpoints.
- Treat inbound imported rows as read-only wait checkpoints or observed context, never as replayable messages.
- Add replay status and evidence that distinguish queued, sent, waiting, matched, timed out, skipped, and removed transcript rows.
- Keep generic WebSocket wording honest: inbound rows are checkpoints or transcript context, not request/response matches unless a future protocol-specific correlator proves that contract.

## Capabilities

### New Capabilities

- `ordered-bootstrap-transcript-replay`: Captures imported bootstrap traffic as an ordered inbound/outbound transcript and replays sendable outbound rows with optional inbound wait checkpoints.

### Modified Capabilities

- None. Existing OpenSpec baseline specs are not archived yet; this change introduces a new capability that supersedes the current outbound-only bootstrap queue behavior during implementation.

## Impact

- Domain models and helpers in `src/domain/types.ts`, `src/domain/discovery.ts`, `src/domain/replay.ts`, `src/domain/reducer.ts`, and evidence formatting.
- Discovery UI in `src/ui/DiscoverView.tsx` and debugger/replay UI in `src/ui/App.tsx`, `src/ui/ReplayLibraryView.tsx`, and shared stream/table styling.
- Tests covering transcript ordering, inbound non-sendable behavior, row-level edit/remove/skip/select, ordered replay with wait checkpoints, live/imported stream separation, and evidence language.
- No new Chrome permissions and no change to the existing rule that imported recipes create new controlled connections rather than taking over page-owned sockets.

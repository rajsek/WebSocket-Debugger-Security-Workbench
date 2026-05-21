## 1. Domain Transcript Contracts

- [x] 1.1 Add ordered bootstrap transcript types for rows, row roles, row statuses, checkpoint modes, replay runs, and source provenance.
- [x] 1.2 Add pure helpers to build an ordered transcript from discovered frames while preserving source request id, frame ids, timestamps, direction, payload kind, previews, hashes, and replayable text bodies.
- [x] 1.3 Replace outbound-only bootstrap selection logic with transcript selection helpers that allow outbound sendable rows and inbound checkpoint/context rows to coexist in observed order.
- [x] 1.4 Add row mutation helpers for select, edit outbound text body, skip, remove, restore if supported, and status transitions without mutating discovered socket snapshots.
- [x] 1.5 Add domain tests for mixed inbound/outbound ordering, source provenance, inbound non-sendable behavior, binary observed-only behavior, edit provenance, skip/remove behavior, and immutable discovery snapshots.

## 2. Ordered Replay State Machine

- [x] 2.1 Add replay planning helpers for send next, send selected, run ordered without waits, and run ordered with inbound checkpoints.
- [x] 2.2 Add checkpoint matching helpers with explicit v1 matching rules and timeout handling.
- [x] 2.3 Extend reducer state/actions for active imported transcript, selected transcript row ids, row statuses, waiting checkpoint state, replay cancellation, and partial/failed completion.
- [x] 2.4 Stop ordered replay on controlled socket close/error and preserve remaining row statuses for user inspection.
- [x] 2.5 Add tests for send order, selected subset replay, checkpoint match, checkpoint timeout, user skip during wait, socket failure interruption, and no auto-send before connect.

## 3. Discovery And Replay Library Integration

- [x] 3.1 Change discovery capture to retain an ordered bootstrap transcript window instead of only `firstOutboundFrames`.
- [x] 3.2 Update connection recipe/import creation to carry imported transcript metadata while preserving URL, engine, subprotocol, observed headers-as-evidence, and source request id.
- [x] 3.3 Migrate existing replay-library save/load helpers so saved bootstrap artifacts can include transcript rows and working transcript copies.
- [x] 3.4 Preserve compatibility or migration behavior for existing saved outbound-only replay artifacts.
- [x] 3.5 Add tests for discovery transcript creation, recipe import with transcript, replay-library persistence round trip, unsupported version rejection, and outbound-only artifact compatibility.

## 4. Shared Stream Table UI

- [x] 4.1 Extract a reusable stream table/row component from the current `stream-pane` and `frame-row` UI without moving domain logic into the component.
- [x] 4.2 Render live controlled frames through the shared component as an appending read-only stream.
- [x] 4.3 Render imported bootstrap transcript rows through the shared component as a static working transcript with row-level selection, send, edit, skip, remove, and inspect controls.
- [x] 4.4 Add clear source labels and status badges so imported transcript rows are not confused with live stream rows.
- [x] 4.5 Add UI tests that live frames continue updating independently while imported transcript edits and row statuses stay scoped to the imported transcript.

## 5. Transcript Replay UI

- [x] 5.1 Replace the current batch `Replay bootstrap` flow with controls for send row, send next, send selected, run ordered, run ordered with waits, skip waiting checkpoint, cancel run, and clear transcript.
- [x] 5.2 Ensure inbound rows are read-only and do not expose send or edit actions.
- [x] 5.3 Allow the user to select only a subset of imported rows so a four-row bootstrap can replay only the chosen two outbound rows.
- [x] 5.4 Add visible timeout, matched, skipped, removed, sent, waiting, partial, failed, and completed states in the transcript table.
- [x] 5.5 Add UI copy that uses checkpoint/transcript wording and avoids generic request/response claims.
- [x] 5.6 Add UI tests for subset selection, row-level send, inbound action restrictions, ordered replay with waits, timeout display, skip/remove actions, and non-correlation wording.

## 6. Evidence And Safety Boundaries

- [x] 6.1 Add ordered transcript replay evidence records with source request id, row provenance, selected/skipped/removed rows, edits, outbound send timestamps, checkpoint outcomes, and final status.
- [x] 6.2 Extend evidence markdown formatting to keep raw bodies out of evidence while preserving hashes and redacted previews.
- [x] 6.3 Keep observed handshake headers as evidence-only context and prevent arbitrary header replay controls from appearing in transcript replay.
- [x] 6.4 Add tests for evidence redaction, edited outbound row traceability, checkpoint timeout/match records, final replay status, and absence of request/response wording.

## 7. Verification

- [x] 7.1 Run `npm test`.
- [x] 7.2 Run `npm run build`.
- [x] 7.3 Run `npm run test:integration` and report that it reaches the public echo endpoint.
- [ ] 7.4 Manually verify discovery import against a page that emits interleaved outbound and inbound bootstrap frames.
- [ ] 7.5 Manually verify live stream updates remain separate while imported transcript rows are edited, skipped, removed, and replayed.
- [ ] 7.6 Manually verify ordered replay with waits against a controlled socket, including checkpoint match, timeout, cancel, and socket-close interruption.

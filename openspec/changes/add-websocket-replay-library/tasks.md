## 1. Domain Contracts

- [x] 1.1 Add replay artifact types for saved socket recipes, saved message sets, replay queue items, replay queues, and replay runs.
- [x] 1.2 Add pure helpers to create saved socket recipes from discovered sockets and current debugger targets.
- [x] 1.3 Add pure helpers to create saved message sets from discovered outbound bootstrap frames and current outbound controlled frames.
- [x] 1.4 Add queue-copy and edit helpers that preserve source ids, payload hashes, edited state, and timestamps.
- [x] 1.5 Add schema version and artifact kind fields to every saved replay artifact and imported JSON payload.
- [x] 1.6 Add validators for imported replay artifact JSON and reject unsupported versions or malformed artifact shapes.
- [x] 1.7 Add compatibility helpers that detect source socket/message-set mismatch without blocking expert replay.
- [x] 1.8 Add unit tests for artifact creation, outbound-only message selection, binary exclusion, provenance retention, edit metadata, version rejection, mismatch detection, and validator failures.

## 2. Persistence And Import/Export

- [x] 2.1 Add a replay-library storage adapter around `chrome.storage.local` without calling Chrome storage directly from React leaf components.
- [x] 2.2 Implement save, list/load, update or save-copy, delete, and clear-library operations for saved replay artifacts without mutating evidence or current frames.
- [x] 2.3 Add JSON export for selected replay artifacts with explicit raw-payload confirmation state in the call path.
- [x] 2.4 Add JSON import that validates artifacts before persisting them.
- [x] 2.5 Add size/count limits for v1 saved artifacts and return user-visible errors when limits are exceeded.
- [x] 2.6 Add adapter tests for persistence round trip, import/export round trip, invalid version rejection, invalid import rejection, delete behavior, clear-library behavior, and quota/limit errors.

## 3. Replay Queue State

- [x] 3.1 Extend socket state and reducer actions for replay library load status, saved artifact list, active replay queue, selected queue items, source mismatch warnings, replay run lifecycle, and queue errors.
- [x] 3.2 Implement actions to load a saved socket recipe and saved message set into the Debugger without connecting or sending.
- [x] 3.3 Implement queue item edit, reorder or remove, select, send-next, send-selected, and clear-queue state transitions.
- [x] 3.4 Implement replay run start, finish, cancel, close/error interruption, sent/unsent marking, and final status transitions.
- [x] 3.5 Keep existing `pendingBootstrapRecipe` behavior working or migrate it into the new queue model without changing its user-visible contract.
- [x] 3.6 Add reducer/domain tests for load-without-connect, queue edit provenance, mismatch warning, send ordering, partial failure, clear behavior, and no auto-send.

## 4. Transport Integration

- [x] 4.1 Extend controlled connection inputs to carry an optional WebSocket subprotocol from a saved socket recipe.
- [x] 4.2 Pass saved subprotocols through extension-engine `new WebSocket(url, protocol)` when present.
- [x] 4.3 Pass saved subprotocols through page-engine connect commands and `src/extension/pageEngine.ts`.
- [x] 4.4 Preserve the existing rule that arbitrary handshake headers are evidence only and cannot become editable replay headers.
- [x] 4.5 Add tests for extension-engine subprotocol use, page-engine command shape, and custom-header non-replay behavior.

## 5. Replay Library UI

- [x] 5.1 Add compact UI controls to save a socket recipe from the selected discovered socket and from the current debugger target.
- [x] 5.2 Add compact UI controls to save selected outbound messages from discovered bootstrap frames and current controlled frames.
- [x] 5.3 Add a replay library view or section that lists saved artifacts, shows source provenance, and supports load, export, import, delete, clear-library, and save-copy/update actions.
- [x] 5.4 Add an editable replay queue in the Debugger with send-next, send-selected, send-all-in-order, finish/cancel run, remove, clear, sent/unsent, and edited-state indicators.
- [x] 5.5 Add raw-payload warnings for save/export, source mismatch warnings before replay, and precise copy that avoids request/response wording.
- [x] 5.6 Add UI tests for save-from-discover, save-from-current-frames, load-without-connect, edit queue item, explicit replay controls, partial replay failure, delete, clear-library, import/export, raw-payload warning visibility, and mismatch warning visibility.

## 6. Replay Evidence

- [x] 6.1 Add replay-run evidence record types with artifact ids, socket URL, engine, source provenance, message hashes or redacted previews, edited status, send timestamps, inbound transcript context, explicit end boundary, and final status.
- [x] 6.2 Extend evidence markdown export to include replay-run records without exposing raw payload bodies.
- [x] 6.3 Ensure generic replay evidence labels inbound frames as transcript or later inbound traffic, not request/response matches.
- [x] 6.4 Add tests for replay-run evidence formatting, redaction, edited-message traceability, completed/partial/failed/cancelled status, source mismatch metadata, and non-correlation language.

## 7. Verification

- [x] 7.1 Run `npm test`.
- [x] 7.2 Run `npm run build`.
- [x] 7.3 Run `npm run test:integration` and report that it reaches the public echo endpoint.
- [x] 7.4 Manually verify save/load/replay against a local echo WebSocket page in the loaded extension.
- [x] 7.5 Manually verify discovery-to-library replay from a page that creates a WebSocket after capture starts.
- [x] 7.6 Manually verify Page-engine replay against a current tab/session-bound socket when available, including stale-session behavior.

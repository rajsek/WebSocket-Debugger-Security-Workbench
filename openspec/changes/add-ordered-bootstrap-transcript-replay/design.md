## Context

The workbench already supports passive WebSocket discovery, import into a new controlled connection, outbound bootstrap replay, and a durable replay library. The current bootstrap model is still too narrow: discovery records inbound and outbound counts, but keeps only a bounded outbound bootstrap slice. The UI then sends selected outbound frames together, which destroys the observed stream order and hides inbound frames that may be meaningful setup checkpoints.

The runtime contract matters here. CDP `requestId` identifies one observed WebSocket connection, not individual application requests. A generic WebSocket debugger cannot prove that a given inbound frame is "the response" to a given outbound frame without application-level correlation. The rewrite must preserve observed ordering and let users wait for inbound checkpoints, but it must not invent request/response semantics.

## Goals / Non-Goals

**Goals:**
- Preserve imported bootstrap traffic as an ordered transcript containing both inbound and outbound observed frames.
- Reuse a shared stream/table presentation for live controlled frames and imported transcript rows while keeping their state sources separate.
- Let users select any subset of imported rows, send only outbound text rows, edit outbound text rows, and skip or remove either direction.
- Add ordered replay modes: send next, send selected, run in observed order, and run in observed order with inbound wait checkpoints.
- Make inbound imported rows read-only checkpoint/context rows that can be waited on, skipped, removed, or inspected, but never sent.
- Record replay evidence with ordered row statuses and precise non-correlation wording.

**Non-Goals:**
- Do not implement protocol-aware request/response pairing.
- Do not send inbound frames or treat inbound captured payloads as replayable messages.
- Do not replay binary frames in this change.
- Do not replay arbitrary handshake headers that browser `WebSocket` APIs cannot set.
- Do not take over, mutate, or reuse the page's existing WebSocket instance.
- Do not merge live stream rows and imported transcript rows into one mutable array.

## Decisions

### Introduce an ordered transcript model instead of extending `firstOutboundFrames`

Add a transcript representation that keeps every captured bootstrap candidate row in observed order:
- `direction`: inbound or outbound
- `payloadKind`: text or binary
- source frame id/hash and source request id
- observed timestamp/order index
- bounded preview and raw body only when replayable text is intentionally imported
- role: `sendable`, `wait-checkpoint`, or `observed-only`
- replay status: `queued`, `sent`, `waiting`, `matched`, `timeout`, `skipped`, `removed`, or `error`

Outbound text rows become sendable by default. Inbound text rows become wait checkpoints only when the user enables ordered replay with waits. Binary rows are observed-only unless a later raw-byte replay feature defines a safe wire-format artifact.

Alternative considered: keep `firstOutboundFrames` and add a side list of inbound frames. That would preserve two disconnected lists, not the stream order the user is actually asking to replay.

### Keep immutable observation separate from mutable imported transcript

Discovery snapshots remain observed evidence. Import creates a working transcript copy that can be selected, edited, skipped, or removed. Edits and removals must not rewrite the discovery snapshot or saved evidence.

Alternative considered: edit discovered frames directly. That creates false evidence because the "observed" object would no longer match what Chrome captured.

### Share stream row rendering, not state ownership

Create or extract a reusable stream/table component that can render both sources:
- live controlled stream: appending, read-only observed rows from the current socket session
- imported transcript: static working rows with selection, edit, remove, skip, and replay status actions

The component should receive explicit mode/source props rather than detecting shape with optional-field fallback logic. Live rows and imported rows can share direction markers, previews, timestamps, and selection styling, but the imported source owns row-level replay actions.

Alternative considered: reuse the existing live stream state directly for imports. That would make current traffic and imported bootstrap traffic fight for selection, scrolling, and status semantics.

### Model ordered replay as a small state machine

Ordered replay should advance through selected transcript rows:
1. Send an outbound sendable row when encountered.
2. If waits are enabled, enter `waiting` on an inbound checkpoint row.
3. Match the checkpoint against the next observed inbound controlled frame using the explicit matching rule for v1.
4. Continue on match, mark timeout on deadline, or let the user skip/cancel.

The v1 match rule should be conservative and visible. For generic text payloads, exact body/hash match is defensible. If exact matching is too strict for dynamic payloads, the UI can support "wait for next inbound frame" as a separate checkpoint mode, but it must be labeled as a checkpoint, not a response match.

Alternative considered: send all outbound frames and then show any inbound traffic later. That is the current problem in another shape; it does not preserve the observed bootstrap sequence.

### Keep manual controls first-class

The UI must support selective execution:
- send one row
- send next sendable row
- send selected rows in transcript order
- run ordered transcript
- run ordered transcript with waits
- skip/remove selected rows before or during replay

This matters because a four-row imported bootstrap may only need two outbound sends in a new session. The model should not force all captured rows into a single replay batch.

Alternative considered: one "Replay bootstrap" button. That is too blunt for real WebSocket setup flows and makes destructive or duplicate subscriptions too easy.

### Preserve existing browser and extension boundaries

The import still seeds a new controlled connection through the extension or page engine. It does not hijack the page socket. Observed headers remain evidence metadata unless the browser API can use them, such as supported subprotocols.

Alternative considered: expose all observed headers as replay fields. That would be fake control because normal browser `WebSocket` constructors cannot set arbitrary request headers.

### Make evidence describe transcript behavior, not correlation

Evidence should record:
- source request id and socket URL
- source transcript row ids/hashes/previews
- selected/skipped/removed rows
- edited outbound payload metadata
- send timestamps
- wait checkpoint statuses and timeouts
- inbound controlled frames observed during the replay run

The language must be "checkpoint", "matched inbound checkpoint", "timed out waiting", or "replay transcript". It must not say "response" unless a future protocol-aware analyzer supplies a real correlation key.

Alternative considered: pair nearest inbound frame after each send. That is false precision for streams with heartbeats, broadcasts, subscriptions, and out-of-order server pushes.

## Risks / Trade-offs

- Users may still infer request/response semantics from row adjacency -> Use checkpoint/transcript labels in UI, evidence, and tests; avoid "response" in generic replay copy.
- Exact inbound checkpoint matching may be noisy for dynamic server messages -> Support skip, timeout, and possibly "wait for next inbound" as a clearly weaker mode.
- Imported transcript and live stream can look too similar -> Reuse row rendering but add explicit source labels, static/imported status, and separate controls.
- Raw imported outbound bodies can contain secrets -> Keep raw bodies only in explicit replay artifacts, show raw-payload warnings, and keep evidence redacted.
- Long transcripts can make the compact panel unusable -> Keep bootstrap transcript bounded by count/byte limits and allow remove/skip before replay.
- Timed waits can deadlock replay -> Every wait needs a timeout, cancel path, and visible row status.
- Service worker or socket close can interrupt replay -> Stop ordered replay on close/error, preserve remaining row statuses, and record partial/failed evidence.

## Migration Plan

1. Add transcript domain types, creation helpers, row roles, row statuses, and ordered replay state-machine helpers.
2. Change discovery bootstrap capture from outbound-only `firstOutboundFrames` to ordered transcript capture while preserving outbound-only helpers long enough to migrate existing UI/tests.
3. Replace the Discover bootstrap list with an imported transcript table that reuses the stream-pane row presentation.
4. Replace batch bootstrap replay with transcript replay controls and row-level actions.
5. Extend replay-library persistence to save/load transcript artifacts and working copies without mutating observed evidence.
6. Extend evidence formatting for transcript replay runs and non-correlation checkpoint language.
7. Run domain/UI tests, build, integration checks, and a manual extension flow against a page that emits interleaved inbound/outbound bootstrap traffic.

Rollback is straightforward at the UI entry point: hide the ordered transcript import/replay controls and keep the prior outbound-only queue while preserving the new domain code behind tests until the migration is finished.

## Open Questions

- What should the default transcript capture window be: first N total frames, first T seconds after open, or user-selected rows from the full discovered socket history?
- Should inbound checkpoint matching default to exact payload hash or "next inbound frame" for dynamic protocols?
- Should removed rows be kept as tombstones for evidence, or fully omitted from replay evidence with only a removed count?

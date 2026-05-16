## Context

The workbench already has controlled WebSocket debugging, passive discovery, connection recipe import, selected bootstrap replay, and evidence records that separate observed page traffic from workbench-generated traffic. That gives users a useful one-session flow, but the replay state is still ephemeral: current frames live in React state, discovery bootstrap candidates are capped observations, and imported bootstrap messages are queued only as an in-memory recipe.

The new problem is not request-id discovery. CDP `requestId` identifies one observed WebSocket connection. It does not identify individual application requests and responses inside the WebSocket stream. A replay library must therefore preserve target/message artifacts and replay-run evidence without claiming request/response correlation unless a later protocol-specific analyzer proves it.

```
Passive discovery / current debugger
        |
        v
  Saved socket recipe    Saved message set
        |                     |
        +----------+----------+
                   v
          Editable replay queue
                   |
          explicit connect + send
                   |
                   v
          Replay run transcript
```

## Goals / Non-Goals

**Goals:**
- Save a socket target recipe from a discovered socket or the current controlled debugger target.
- Save selected outbound text messages from discovered bootstrap candidates or current controlled frames.
- Load saved artifacts into the Debugger as an editable replay queue without connecting or sending automatically.
- Send queued messages only after the user explicitly connects a newly created controlled socket and explicitly replays selected messages.
- Record replay-run evidence with provenance from source socket, source frame ids or hashes, edits, target metadata, and received transcript context.
- Preserve transport metadata that normal browser WebSocket APIs can use, including URL, engine choice, page/session assumption, and observed subprotocol.
- Keep raw replay payload persistence intentional and visible because replayable payloads may contain credentials, tokens, or private data.

**Non-Goals:**
- Do not implement protocol-aware request/response correlation in v1.
- Do not infer "the response" from timing or nearest inbound frame.
- Do not replay arbitrary handshake headers that browser `WebSocket` constructors cannot set.
- Do not take over or reuse an existing page WebSocket instance.
- Do not support binary replay in v1; binary frames can remain evidence context but not replayable queue items.
- Do not run replay in the background or unattended.
- Do not preserve historical cookies, Origin state, CSP state, or page runtime state beyond what the current tab/session naturally provides for the Page engine.

## Decisions

### Split saved artifacts instead of overloading `ConnectionRecipe`

Introduce replay-specific artifact types rather than stretching the current import recipe:
- `SavedSocketRecipe`: target URL, selected/recommended engine, tab origin, auth/session assumption, observed subprotocol, source request id when available, and redacted handshake context.
- `SavedMessageSet`: ordered outbound text messages with source frame ids or payload hashes, source type, previews, body length, created/updated timestamps, and edit metadata.
- `ReplayQueue`: an editable working copy loaded from saved artifacts.
- `ReplayRun`: evidence of one explicit replay execution and the transcript observed after replay starts.

Alternative considered: store everything as `ConnectionRecipe`. That would blur one-time import state with durable replay artifacts and make it too easy to mutate observed evidence.

### Version persisted artifacts explicitly

Every saved replay artifact and imported JSON payload should include a schema version and artifact kind. Loading must reject unsupported versions instead of trying to best-effort parse unknown shapes. If migration becomes necessary later, it should be explicit and tested at the adapter boundary.

Alternative considered: infer version from object fields. That makes old artifacts look valid until a field has changed meaning, which is worse than a visible rejection.

### Preserve immutable observations and edit only derived copies

Discovery snapshots and current frame history remain evidence sources. Saving creates a derived artifact with provenance; loading creates a replay queue copy. Editing queue messages does not rewrite the original observed frame or saved artifact unless the user explicitly saves an update.

Alternative considered: let users edit saved artifacts in place. That is simpler UI, but it weakens traceability because an artifact could stop matching the observed source that justified it.

### Warn on socket/message source mismatch without blocking expert use

Users may intentionally replay a saved message set against a different socket recipe, but the tool should not imply compatibility. If the source socket metadata differs from the loaded target recipe, the queue can still load, but the mismatch must be visible before replay.

Alternative considered: block all mismatches. That is too restrictive for authorized comparative testing across environments or accounts.

### Keep generic replay separate from protocol correlation

Replay-run evidence records the ordered outbound messages sent and the inbound frames observed after replay begins. It must use language such as "later inbound traffic" or "replay transcript", not "response", unless a future protocol analyzer contributes a correlation result.

Alternative considered: pair messages by nearest timestamp. That is false precision for WebSockets because heartbeats, broadcasts, subscription events, and server pushes can interleave with replies.

### Use explicit queue controls before automation

V1 should support manual "send next" and explicit "send selected" or "send all in order". It should not automatically send every saved message on load or on connect. Timed playback and ack-gated playback are later features because they require protocol or timing contracts that v1 does not have.

Alternative considered: one-click replay immediately after connect. That is risky for auth, subscribe, join, mutation, and state-changing workflows.

### Treat replay runs as bounded sessions

A replay run starts when the first queued message is sent through the controlled socket. It ends only when the user explicitly finishes or cancels the run, or when the socket closes/errors. Evidence should record `completed`, `partial`, `failed`, or `cancelled`, and unsent messages should remain visibly unsent after a partial run.

Alternative considered: keep appending inbound frames indefinitely after replay starts. That creates noisy evidence and invites false request/response conclusions.

### Use a small persistence adapter, not UI-owned storage calls

Create a replay-library adapter behind a domain-friendly interface. `chrome.storage.local` is acceptable for small saved artifacts because the manifest already includes `storage`; JSON export/import should be available for portability or larger raw transcripts. If size limits become a real issue, IndexedDB can be added behind the same adapter.

Alternative considered: keep everything in React state. That fails the actual requirement because saved recipes/messages would disappear on reload or extension restart.

### Treat raw payloads differently from redacted evidence

Replay needs raw text bodies. Evidence export should continue using previews and hashes. Saving raw replay payloads must be an explicit local action with visible copy such as "may contain secrets"; JSON export must carry the same warning path.

Alternative considered: store only redacted payloads. That is safer but not replayable and would produce broken or misleading replay behavior.

### Provide explicit deletion and clear boundaries

Saved replay artifacts are local replay-library data, separate from current frames and evidence records. Deleting a saved artifact or clearing the replay library should remove raw saved payloads from local storage, but it should not rewrite existing evidence records or current frame history.

Alternative considered: cascade delete evidence when saved artifacts are removed. That would make evidence unstable and harder to audit.

### Preserve subprotocol when browser APIs support it

If an observed socket negotiated a `Sec-WebSocket-Protocol` value, the saved socket recipe should preserve it and controlled connection creation should pass it through `new WebSocket(url, protocol)` when replaying from that recipe. This is transport metadata, not application request/response correlation.

Alternative considered: ignore subprotocol. That causes false replay failures for GraphQL WS and other subprotocol-gated servers even when the URL and session context are correct.

## Risks / Trade-offs

- Raw saved messages may contain secrets -> Require explicit save/export actions, visible warning text, redacted previews, hashes in evidence, and a clear delete path.
- `chrome.storage.local` may be too small for large transcripts -> Scope v1 to selected message sets; add JSON import/export and keep IndexedDB as an adapter-level follow-up.
- Users may read inbound transcript as response correlation -> Use precise labels and tests that reject request/response wording in generic replay UI/evidence.
- Imported artifacts may outlive the current schema -> Version artifacts, reject unsupported versions, and keep migration logic adapter-local if needed later.
- Source message sets may be replayed against a different target -> Show a mismatch warning and preserve both source and target metadata in evidence.
- A replay can fail midway -> Stop sending on close/error, mark unsent messages, and record partial or failed evidence rather than hiding the interrupted state.
- Page-engine replay may fail after navigation or session change -> Preserve the page-session assumption and require connection against the current tab/session, with stale-session warnings already used by the workbench.
- Subprotocol preservation may require changing both extension and page engines -> Update the connection command contract together with types, parsers, and tests.
- Queue edits can obscure provenance -> Store source ids/hashes and edited timestamps so evidence can distinguish original observed payloads from edited replay payloads.

## Migration Plan

1. Add replay-library domain models and pure artifact creation/update helpers, including schema version and artifact kind.
2. Add a persistence adapter for local save/load/delete and JSON import/export.
3. Add reducer state for saved artifacts, source mismatch warnings, replay run lifecycle, and an editable replay queue.
4. Add compact UI actions to save from Discover, save from current frames, load a queue, edit messages, and replay explicitly.
5. Extend connection creation to carry observed subprotocols when present.
6. Add replay-run evidence formatting and tests.
7. Verify with unit tests, build, integration test, and manual extension replay against a local echo page plus a page-engine session-bound socket where available.

Rollback is straightforward: hide the replay-library UI and remove the adapter/state additions. Existing Debugger, Discover, Security, Debug Lab, and Evidence flows should remain independent.

## Open Questions

- Should v1 include "update saved artifact" or only "save as copy" after editing a loaded queue?
- What is the initial storage quota policy: cap message count, cap bytes per artifact, or both?
- Should JSON export include raw bodies by default after warning, or require a second confirmation distinct from local save?

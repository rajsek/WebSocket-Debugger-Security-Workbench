## Context

The current implementation has the right underlying transport model:

- `TargetContext.subprotocol` exists.
- Discovery recipes store observed handshake metadata and subprotocol.
- Saved socket recipes preserve subprotocol and handshake context.
- Both extension and page engines pass subprotocol when connecting.

The UI does not consistently expose that model. Users see URL and engine in the top strip, but not the reusable subprotocol or the provenance behind an imported/saved target. That makes a protocol-gated socket look like an ordinary URL-only connection.

## Decision: Separate Editable Transport From Evidence Context

Use two layers:

```text
Always visible target setup
  - Socket URL
  - Engine
  - Subprotocol
  - Context button

Collapsed Context details panel
  - Source: manual | discovery request id | saved recipe
  - Session assumption
  - Handshake observed/unobserved
  - Redacted request headers
  - Redacted response headers
  - Non-replayable header note
```

The editable layer contains only browser-supported connection inputs. The context layer explains where the target came from and what was observed, without promising unsupported replay.

## Decision: Keep Compose Message-Only

Compose remains the WebSocket frame-body editor. It should not grow arbitrary request-header inputs because those headers are not part of WebSocket message payloads and normal browser `WebSocket` construction cannot set them.

If a future transport backend can set arbitrary headers, that should be a new explicit engine/capability with its own permission and cleanup model. It should not be smuggled into the existing browser WebSocket UI.

## Decision: Preview Replay Load Before Mutating Target

Replay Library currently lets users choose a socket recipe and message set, then load them. The load decision should show enough metadata before it changes the Debugger target:

- socket URL
- selected engine
- subprotocol
- source request id when available
- source type
- message count
- mismatch warning when socket recipe and message set do not line up

This keeps expert mismatch replay possible, but makes the risk visible before the queue is loaded.

## Risks

- Adding too much always-visible metadata would crowd the compact header. Keep only subprotocol visible; use the `Context` details panel for provenance and headers.
- Header evidence can be misread as replayable configuration. Label it as read-only evidence and keep custom headers out of connection controls.
- Imported manual targets may have no observed handshake. Show `unobserved` instead of an empty panel so users do not mistake missing evidence for successful header preservation.

## Manual Decision

Resolved: use a collapsed `Context` button/details panel for provenance and redacted headers. Keep `Subprotocol` visible as a normal target field.


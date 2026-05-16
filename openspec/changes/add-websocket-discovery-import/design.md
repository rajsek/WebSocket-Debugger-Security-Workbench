## Context

The workbench is a TypeScript MV3 Chrome extension with React surfaces for popup, side panel, DevTools panel, iframe overlay, and direct page overlay. It already supports extension-created WebSockets, page-context WebSockets through an injected page engine, authorized Security Lab actions, Debug Lab CSP tools, and redacted evidence export.

The missing capability is trustworthy discovery of WebSockets that the inspected page already creates. Users want to capture the page's actual socket URL, handshake context, and early outbound bootstrap messages, then create a new controlled workbench connection from that observed setup. The design must preserve the distinction between passive runtime observation and active workbench-generated traffic.

## Goals / Non-Goals

**Goals:**
- Add a compact `Discover` tab that passively observes WebSocket activity for the selected tab.
- Model discovered sockets by Chrome DevTools Protocol `requestId`, not by URL alone.
- Capture WebSocket lifecycle events, handshake summaries, frame summaries, first outbound bootstrap frames, errors, and close state.
- Import an observed socket as a connection recipe for a new controlled debugger connection.
- Provide `Import Target` and `Import With Bootstrap` flows without auto-sending frames.
- Record evidence that distinguishes observed page traffic from workbench-generated traffic.
- Cleanly attach and detach debugger capture when users start/stop capture, switch targets, close tabs, or lose debugger ownership.

**Non-Goals:**
- Do not hijack or take ownership of a page's existing WebSocket instance.
- Do not monkey-patch `window.WebSocket` in v1.
- Do not claim arbitrary request headers can be replayed through browser WebSocket APIs.
- Do not auto-run Security Lab tests or auto-send bootstrap frames after import.
- Do not broaden host permissions; discovery uses the existing debugger capability and explicit user action.

## Decisions

### Use CDP passive capture as the discovery source

Discovery will attach `chrome.debugger` to the selected tab and enable the CDP Network domain. The capture adapter will parse WebSocket-specific Network events such as socket creation, handshake request/response, sent/received frames, errors, and close.

Alternatives considered:
- Static source scanning for `wss://` or `new WebSocket`: low risk but only produces hints, not runtime evidence.
- Page-world monkey-patching: can capture future constructor calls and possibly richer JS arguments, but mutates the target app and misses already-created sockets unless injected early.
- Existing workbench connect flow: creates useful test traffic but does not answer whether the loaded page already uses WebSockets.

### Keep capture orchestration in the background/service worker

The background owns debugger attachment, event routing, tab cleanup, and detach handling. UI surfaces send typed runtime commands and receive typed capture snapshots or status updates.

This avoids scattering privileged `chrome.debugger` lifecycle logic through React components and keeps service-worker sleep, tab removal, DevTools conflicts, and detach events in one adapter.

### Add a domain capture model separate from debugger frames

Discovered traffic will use separate types from the existing controlled `FrameRecord` path:
- `DiscoveredSocket`
- `WebSocketCaptureEvent`
- `HandshakeSummary`
- `ObservedFrameSummary`
- `ConnectionRecipe`

Existing debugger frames remain controlled-connection frames. This prevents observed runtime traffic from being confused with messages sent by the workbench.

### Import recipes, not live sockets

Import creates a recipe from observed data:
- socket URL
- recommended engine
- observed origin/context
- optional subprotocols
- redacted handshake summary
- selected outbound bootstrap frame previews
- source request id

The imported recipe seeds a new controlled connection. It does not reuse the existing page socket. This distinction must be visible in UI text, evidence metadata, and tests.

### Prefer page engine for page-session reproduction

If the observed socket host matches the selected page origin or appears session-bound, the import flow recommends the Page engine because browser-managed cookies, Origin, CSP, and page context matter. Extension engine remains available for isolated testing and public echo-style checks.

The UI must warn that normal WebSocket JavaScript cannot replay arbitrary custom request headers. Header evidence can be recorded, but not converted into a fake reconnect option.

### Make bootstrap replay manual and selective

`Import With Bootstrap` previews initial outbound frames and lets the user select which ones to send after opening the new controlled connection. No frame is replayed without explicit user action.

This protects against first-message side effects such as joining rooms, subscribing to data, mutating state, or triggering workflows.

### Keep Discover compact and operational

The new tab should fit the existing compact workbench style:
- capture state row: detached, attaching, listening, failed, detached-by-devtools
- socket list: URL, lifecycle state, frame counts, last activity, import action
- selected socket details: handshake summary, first outbound frames, evidence action

This is not a dashboard. It is a narrow workflow for observe, select, import, and preserve evidence.

## Risks / Trade-offs

- Debugger attachment can conflict with Chrome DevTools for the same tab -> Show a clear detached/conflict state and cleanly detach; do not silently continue with stale capture state.
- CDP only captures events after `Network.enable` -> Provide a `Start capture + reload` action for startup sockets and label pre-capture gaps as unknown.
- Multiple sockets can share one URL -> Use CDP `requestId` as the canonical socket identity.
- Frames may include secrets -> Redact handshake headers and frame previews before evidence export; require explicit raw/local export in any later raw transcript feature.
- Service worker lifecycle can interrupt capture -> Store minimal per-tab capture state in the background and expose recovery status to the UI.
- Page/session reproduction may fail in extension engine -> Recommend Page engine for page-session recipes and show why extension engine differs.
- Subframes/workers can create sockets -> v1 may focus on the attached tab target, but the UI must not say "no sockets" as a certainty for unobserved related targets.

## Migration Plan

1. Add domain models and parsers for CDP WebSocket events.
2. Add background capture adapter and typed runtime commands/events.
3. Add Discover state and UI without changing existing Debugger/Security/Evidence behavior.
4. Add recipe creation and import into existing target state.
5. Add observed-traffic evidence records and redaction.
6. Verify with unit tests, build, and live extension checks on a local WebSocket page and one real page.

Rollback is straightforward: remove or hide the Discover tab and capture runtime commands. Existing debugger, security, debug lab, and evidence flows should remain independent.

## Open Questions

- Should v1 attach to related targets for iframes/workers, or explicitly scope itself to the main tab target?
- Should recipes persist across extension reloads, or remain in-memory until the evidence workspace is expanded?
- How many initial outbound frames should count as the default bootstrap window: first N frames, first T seconds after open, or user-selected only?

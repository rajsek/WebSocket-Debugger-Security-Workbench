# Privacy Policy

Effective date: 2026-05-16

Product: WebSocket Debugger + Security Workbench

## Summary

WebSocket Debugger + Security Workbench is a local Chrome extension for authorized WebSocket debugging and security evidence collection. It processes debugging data in the user's browser and does not sell, transfer, or use user data for advertising or profiling.

## Data The Extension Handles

The extension may handle the following data when the user chooses a debugging workflow:

- Current tab URL and origin, used to scope the selected debugging target.
- WebSocket endpoint URLs, handshake metadata, frame direction, timestamps, opcode, and payload length.
- WebSocket text payloads and bounded binary previews shown in the workbench.
- User-created replay artifacts, notes, and redacted evidence records.
- Debug Lab state for selected-tab CSP debugging.

Captured traffic can contain sensitive application data such as tokens, cookies, identifiers, or private messages. The extension redacts common sensitive values in evidence output, but users are responsible for reviewing exports before sharing them.

## Local Storage

The extension uses Chrome extension storage for local workbench state and saved replay artifacts. Saved artifacts remain on the user's device unless the user exports them.

## Remote Transfer

The extension does not send collected debugging data to the developer or any third-party analytics service.

WebSocket messages are sent only to endpoints the user explicitly connects to or replays against. Those endpoints are controlled by the user or by the site/application being tested.

## Data Sale And Advertising

The extension does not sell user data. It does not use user data for ads, credit decisions, lending, eligibility decisions, or user profiling.

## Permissions

The extension requests Chrome permissions only to support the visible debugging workflows:

- `activeTab` and `scripting` for user-triggered overlay injection and selected-tab context.
- `storage` for local workbench state and replay artifacts.
- `sidePanel` for the persistent workbench surface.
- `debugger` for explicit DevTools Protocol workflows such as WebSocket discovery and selected-tab CSP bypass.
- `declarativeNetRequestWithHostAccess` for selected-tab, session-scoped CSP header debugging in Debug Lab.

The extension does not request default host permissions.

## User Control

Users control when to connect, capture, replay, export, import, clear, and delete debugging artifacts. Active Security Lab checks require explicit authorization confirmation.

## Contact

No public support URL is configured yet. Add the production support address before publishing outside internal testing.

# WebSocket Workbench Store Listing

Prepared for Chrome Web Store release `0.1.1`.

Official submission references checked on 2026-05-16:

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/user_data

## Store Fields

Developer-facing product name: WebSocket Debugger + Security Workbench

Chrome Web Store title:

```text
WebSocket Debugger + Security Workbench
```

Short description:

```text
Inspect, replay, and document WebSocket traffic from a compact Chrome extension workbench.
```

Detailed description:

```text
WebSocket Workbench is a compact Chrome extension for authorized WebSocket debugging and security evidence collection.

Use it to connect to WebSocket endpoints, inspect inbound and outbound frames, replay selected text messages, and document findings without leaving Chrome. It supports extension-context sockets, a direct page overlay for page-context sockets, passive DevTools discovery, bounded replay artifacts, and redacted evidence notes.

Security Lab checks require explicit authorization confirmation and are intended for your own applications, approved internal testing, and authorized security review. The extension is not an exploit automation tool, does not weaken authorization boundaries, and keeps sensitive diagnostics visible to the user.

Core workflows:
- Connect from the popup, side panel, DevTools panel, iframe overlay, or direct page overlay.
- Capture observed WebSocket handshakes and frames through the authorized DevTools flow.
- Inspect text frames and binary wire previews with payload length, hex preview, and base64 preview.
- Save socket recipes and selected outbound text messages as local replay artifacts.
- Replay selected text messages manually against a connected socket.
- Export redacted evidence notes for debugging and security reports.
- Use Debug Lab CSP tools only for explicit, selected-tab debugging.
```

Single-purpose statement:

```text
This extension provides a local WebSocket debugging and authorized security evidence workbench for inspecting, replaying, and documenting WebSocket behavior in Chrome.
```

Category:

```text
Developer Tools
```

Language:

```text
English
```

Website:

```text
Not public yet.
```

Support URL:

```text
Not public yet.
```

Privacy policy:

```text
Use docs/publish/PRIVACY_POLICY.md as the source text until a public policy URL exists.
```

## Release Notes

Version `0.1.1`:

```text
Adds safer binary-frame handling for WebSocket debugging. Binary traffic is now shown as bounded wire previews instead of replayable plaintext, with payload length, hex preview, and base64 preview metadata. Discovery and replay flows continue to save and replay text frames only, so binary placeholders are not sent accidentally. The package also refreshes Chrome Web Store listing, privacy, and release checklist copy for the next submission.
```

## Permission Justifications

`activeTab`

```text
Used only after user action to read the selected tab context, show the active target origin, and inject the selected overlay into the current tab.
```

`scripting`

```text
Injects the iframe overlay, direct page overlay, and page-world WebSocket bridge only after the user chooses that workflow.
```

`storage`

```text
Stores local workbench state, replay artifacts, and user-created debugging notes in Chrome extension storage. Replay artifacts may contain user-saved WebSocket payloads and are kept local unless the user exports them.
```

`sidePanel`

```text
Opens the persistent WebSocket Workbench side panel.
```

`debugger`

```text
Required for explicit Chrome DevTools Protocol workflows, including selected-tab WebSocket discovery and Debug Lab page CSP bypass. This permission is sensitive; the UI keeps it user-visible and tied to selected-tab debugging actions.
```

`declarativeNetRequestWithHostAccess`

```text
Required for Debug Lab CSP header-stripping experiments on the selected tab. Rules are session-scoped, tab-scoped, and intended only for authorized debugging. The extension does not request default host permissions.
```

Host permissions:

```text
No default host permissions are requested.
```

## Privacy Practices Copy

Data use summary:

```text
The extension does not sell user data, does not transfer user data to third parties, and does not use WebSocket traffic for advertising, credit, lending, or profiling. Debugging data is processed locally in the browser and stays in Chrome extension storage unless the user intentionally exports it.
```

Data types handled locally:

- Website content: WebSocket frame contents, selected headers, endpoint URLs, target origin, and evidence notes shown or saved by the user.
- Web browsing activity: current tab URL/origin is used to scope the selected debugging target.
- Authentication-related data: authorization headers, cookies, tokens, or secrets may appear inside captured WebSocket traffic or headers; the extension redacts common sensitive values in evidence output, but users should still review exports before sharing.

Remote transfer:

```text
None by the extension. WebSocket messages are sent only to endpoints the user connects to or replays against.
```

Storage:

```text
Chrome extension storage on the user's device. Saved replay artifacts and evidence exports are user-controlled and can contain sensitive application data.
```

## Image Assets

Included in the package:

- `public/icons/icon-16.png`
- `public/icons/icon-32.png`
- `public/icons/icon-48.png`
- `public/icons/icon-128.png`
- `public/icons/icon-source.svg`

Ready for dashboard upload:

- Store icon: `docs/publish/assets/store-icon-128.png` (`128x128`).
- Required small promotional tile: `docs/publish/assets/promo-small-440x280.png` (`440x280`).
- Optional marquee promotional tile: `docs/publish/assets/promo-marquee-1400x560.png` (`1400x560`).

Screenshot set:

- `docs/publish/assets/screenshots/01-debugger-binary-inspector-1280x800.png`
- `docs/publish/assets/screenshots/02-discovery-redacted-handshake-1280x800.png`
- `docs/publish/assets/screenshots/03-replay-library-1280x800.png`
- `docs/publish/assets/screenshots/04-replay-queue-1280x800.png`
- `docs/publish/assets/screenshots/05-security-authorization-gate-1280x800.png`
- `docs/publish/assets/screenshots/06-debug-lab-csp-controls-1280x800.png`

Screenshot rules:

- Captured from the production `dist/` bundle with a Chrome API shim and synthetic safe data.
- Before final public submission, do one manual smoke pass with `dist/` loaded as an unpacked extension.
- Do not include real customer hosts, tokens, cookies, or raw secrets.
- Prefer public echo endpoints and synthetic payloads.

## Submission Checklist

1. Confirm the manifest version is higher than the currently published Chrome Web Store version.
2. Run `npm test`.
3. Run `npm run build`.
4. Run `npm run test:integration`.
5. Run `npm run package:extension`.
6. Load `dist/` in `chrome://extensions`.
7. Manually verify popup, side panel, DevTools panel, iframe overlay, and direct page overlay.
8. Verify overlay drag, right-edge resize, bottom-edge resize, corner resize, minimize, fit, close, focus, and body scrolling.
9. Verify Debug Lab CDP bypass and header-strip modes only against an authorized selected tab.
10. Confirm `release/websocket-workbench-0.1.1.zip` contains no test hosts, debug-only payloads, screenshots, secrets, or unredacted evidence files.
11. Upload `release/websocket-workbench-0.1.1.zip`.
12. Paste the listing text, permission justifications, privacy practices, and release notes from this file into the Chrome Web Store dashboard.

## Review Risk Notes

- `debugger` is the main review risk. It is justified only by selected-tab WebSocket discovery and explicit Debug Lab CSP bypass. Do not describe it as passive page takeover.
- `declarativeNetRequestWithHostAccess` is also sensitive. Keep the listing tied to selected-tab, session-scoped CSP header debugging.
- If Chrome Web Store review pushes back, the better product move is to convert Debug Lab privileged flows to optional permissions instead of weakening the store description.

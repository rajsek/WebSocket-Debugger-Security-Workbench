# WebSocket Debugger + Security Workbench

TypeScript MV3 Chrome extension with a compact React debugger, explicit target context, authorized Security Lab, and redacted evidence export.

## Automated Checks

```sh
npm test
npm run build
npm run test:integration
npm run package:extension
```

The integration test intentionally reaches a public echo endpoint:

- Manual tester site: `https://tests.ws/tools/websocket-tester`
- Echo endpoint: `wss://echo.websocket.org`
- Probe payload: `codex-integration-probe`

The workbench also includes a `Test endpoint` selector for quick manual checks:

- `wss://echo.websocket.org`
- `wss://echo.websocket.in/`
- `wss://ws.postman-echo.com/raw`

## Manual Integration Flow

1. Open `https://tests.ws/tools/websocket-tester` in Chrome.
2. Load this extension from `dist/` after running `npm run build`.
3. Open the extension popup or DevTools panel.
4. Confirm the visible target host is `tests.ws`.
5. Use the `Test endpoint` selector only when you intentionally want a public echo service. The Security Lab blocks cross-host tests by default, so use the Debugger tab for this public echo check.
6. Connect, send `codex-integration-probe`, and verify the inbound frame stream includes the same payload.

Security Lab active tests remain host-bound by design. That means the public tester page and the public echo endpoint are useful for debugger connectivity, but they are not evidence that active authorization tests are safe or meaningful against a third-party host.

## Strict CSP Page Checks

Use this flow for pages such as Gemini or Uber that block Page engine sockets with `connect-src`:

1. Close Chrome DevTools for the target tab if you want to test CDP bypass. Chrome allows only one debugger attachment for a tab.
2. Open the extension popup and choose `Direct Page Overlay`.
3. Set `Engine` to `Page`, pick or enter a public echo endpoint, and connect once to confirm the CSP block appears.
4. Open `Debug Lab`.
5. Try `CDP bypass`: enable it, go back to `Debugger`, reconnect, send a payload, and confirm the echo frame arrives.
6. Try `Strip headers`: apply `Strip + reload`, reopen `Direct Page Overlay` after the reload, then retry the Page engine socket. To disable it, reopen `Debug Lab` and use `Remove + reload`; the active DNR rule is read from the background session state.
7. Try `Meta probe` only as a negative-control check. It injects a permissive meta CSP, but it cannot relax a CSP header that the page already delivered. Do not substitute `http-equiv="refresh"` here: refresh can reload or navigate the document, but it does not change `connect-src` or make page-world WebSockets legal.

## Surfaces

- `Side Panel`: persistent extension UI. WebSockets are created by the extension page.
- `Iframe Overlay`: iframe-based extension UI over the current page. WebSockets are still created by the extension page. The overlay has explicit drag, minimize, fit, close, right-edge resize, bottom-edge resize, and corner resize behavior.
- `Direct Page Overlay`: injects the same React workbench UI directly into the current page inside a Shadow DOM, then bridges to a WebSocket engine injected into Chrome's `MAIN` world. Use this when you need the browser to create the socket from the page context so the request uses the page origin and normal page cookie rules. Host-page `connect-src` CSP still applies to these page-world sockets. For arbitrary public echo hosts on strict pages such as Gemini or Uber, use the Extension engine or explicitly enable a Debug Lab CSP option. This overlay uses the same explicit window controls as the iframe overlay.

## Publish Prep

Store-listing text, permission explanations, privacy copy, and asset notes live in:

- `docs/publish/STORE_LISTING.md`
- `docs/publish/PRIVACY_POLICY.md`
- `docs/publish/RELEASE_0.1.1.md`
- `docs/publish/PUBLISH_PACKET_0.1.1.md`
- `docs/publish/assets/`

`npm run package:extension` builds the extension and writes `release/websocket-workbench-0.1.1.zip`.

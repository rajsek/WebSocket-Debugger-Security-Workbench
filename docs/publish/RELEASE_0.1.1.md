# Release 0.1.1

Date: 2026-05-16

## Release Goal

Prepare the next Chrome Web Store submission for WebSocket Debugger + Security Workbench with safer binary-frame handling and complete store-submission copy.

## User-Visible Changes

- Binary WebSocket traffic is displayed as wire data instead of replayable plaintext.
- Binary frame details include payload length, bounded hex preview, and bounded base64 preview.
- Replay artifact creation remains text-only so binary placeholders are not sent accidentally.
- Page-engine and extension-engine sockets set `binaryType = 'arraybuffer'` for deterministic binary handling.
- Chrome Web Store listing, permission justification, privacy copy, and submission checklist were refreshed for `0.1.1`.
- Chrome Web Store image assets were prepared under `docs/publish/assets/`.

## Package

Expected artifact:

```sh
release/websocket-workbench-0.1.1.zip
```

Build command:

```sh
npm run package:extension
```

## Required Verification

Automated:

```sh
npm test
npm run build
npm run test:integration
npm run package:extension
```

Manual:

- Load `dist/` as an unpacked extension.
- Verify popup, side panel, DevTools panel, iframe overlay, and direct page overlay.
- Verify connect, send, copy, clear, discovery capture, replay queue, and evidence export against synthetic data.
- Verify a binary frame appears as a binary wire preview and is not offered as a replayable text message.
- Verify Debug Lab privileged modes only against an authorized selected tab.
- Capture store screenshots from the loaded extension, not from the Vite dev server.
- Use `docs/publish/PUBLISH_PACKET_0.1.1.md` as the final dashboard handoff.

## Known Release Risks

- `debugger` and `declarativeNetRequestWithHostAccess` are sensitive permissions and can slow review.
- Store screenshots were rendered from the production `dist/` bundle with a Chrome API shim and synthetic safe data; do a manual loaded-extension smoke pass before public submission.
- The privacy policy currently has no public hosted URL; host it before publishing outside internal or trusted testing.

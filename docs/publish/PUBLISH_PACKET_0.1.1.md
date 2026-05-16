# Chrome Web Store Publish Packet 0.1.1

Use this as the single handoff file for the Chrome Web Store dashboard.

## Upload Package

Extension package:

```text
release/websocket-workbench-0.1.1.zip
```

Manifest version inside package:

```text
0.1.1
```

## Listing Fields

Title:

```text
WebSocket Debugger + Security Workbench
```

Short description:

```text
Inspect, replay, and document WebSocket traffic from a compact Chrome extension workbench.
```

Category:

```text
Developer Tools
```

Language:

```text
English
```

Detailed description, permission justifications, privacy practices copy, and release notes:

```text
Use docs/publish/STORE_LISTING.md.
```

Privacy policy source:

```text
docs/publish/PRIVACY_POLICY.md
```

The privacy policy still needs a public hosted URL for public release.

## Image Uploads

Store icon:

```text
docs/publish/assets/store-icon-128.png
```

Required small promotional image:

```text
docs/publish/assets/promo-small-440x280.png
```

Optional marquee promotional image:

```text
docs/publish/assets/promo-marquee-1400x560.png
```

Screenshots:

```text
docs/publish/assets/screenshots/01-debugger-binary-inspector-1280x800.png
docs/publish/assets/screenshots/02-discovery-redacted-handshake-1280x800.png
docs/publish/assets/screenshots/03-replay-library-1280x800.png
docs/publish/assets/screenshots/04-replay-queue-1280x800.png
docs/publish/assets/screenshots/05-security-authorization-gate-1280x800.png
docs/publish/assets/screenshots/06-debug-lab-csp-controls-1280x800.png
```

Screenshot provenance:

```text
Rendered from the production dist bundle with a Chrome API shim and synthetic safe data. No customer host, token, cookie, or raw secret is shown.
```

## Privacy Practices Answers

Data usage:

```text
The extension processes debugging data locally in the browser to provide WebSocket inspection, replay, and evidence-export features. It does not sell data, does not transfer collected debugging data to the developer or third-party analytics services, and does not use data for ads, credit, lending, or profiling.
```

Data types to disclose:

```text
Website content
Web browsing activity
Authentication information, because captured WebSocket traffic or headers can contain cookies, tokens, or authorization data
User-generated content, because users can create notes and replay artifacts
```

Remote transfer:

```text
No developer-controlled remote transfer. WebSocket messages are sent only to endpoints the user explicitly connects to or replays against.
```

Limited Use:

```text
Data is used only to provide the user-facing WebSocket debugging, replay, and evidence features. It is not transferred except as needed for user-selected WebSocket endpoints or user-initiated exports, and it is not used for advertising or profiling.
```

## Final Manual Gate

Before clicking submit:

1. Host the privacy policy and paste the public URL.
2. Load `dist/` as an unpacked extension.
3. Verify popup, side panel, DevTools panel, iframe overlay, and direct page overlay.
4. Verify the sensitive permission story: `debugger` is only used for selected-tab WebSocket discovery and CDP CSP bypass, and `declarativeNetRequestWithHostAccess` is only used for selected-tab session CSP header stripping.
5. Confirm the uploaded screenshots are acceptable even though they use synthetic safe data.

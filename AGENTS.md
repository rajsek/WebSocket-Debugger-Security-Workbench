# AGENTS.md

## Operating Stance

Work as a senior engineering peer and logic auditor. Do not rubber-stamp designs, snippets, or user claims. Challenge weak assumptions, name the runtime contract being relied on, and explain why a correction matters.

Use the `chrome-extension-architect-skeptic` skill for Chrome extension design, refactors, runtime debugging, overlay behavior, DevTools surfaces, messaging contracts, permissions, and publish-readiness questions.

Prioritize truth over agreement:

- Identify the actual browser, extension, WebSocket, DOM, and message contract before changing code.
- Prefer one canonical source for each value.
- Add guards only for observed uncertainty, not imagined uncertainty.
- Treat test cases as part of the architecture, not cleanup.
- Keep generated or modified code readable for the next maintainer.

## Project Contract

This repo is a TypeScript/Vite/React Manifest V3 Chrome extension for a compact WebSocket debugger and authorized security evidence workbench.

Current surfaces:

- `popup.html` / `src/ui/popup.tsx`: popup UI.
- `sidepanel.html` / `src/ui/sidepanel.tsx`: persistent side panel UI.
- `devtools.html`, `panel.html`, `src/extension/devtools.ts`, `src/ui/panel.tsx`: DevTools panel flow.
- `src/extension/content.ts`: iframe overlay injection and page lifecycle notice bridge.
- `src/extension/pageOverlay.tsx`: direct page overlay entry.
- `src/extension/pageEngine.ts`: page-world WebSocket engine bridged with `window.postMessage`.
- `src/extension/background.ts`: MV3 background/service-worker message routing and injection orchestration.
- `src/domain/*`: pure contracts, reducer, URL validation, frame utilities, security catalog, security runner, and evidence formatting.

Do not collapse distinct responsibilities into one large file. Split by browser boundary and by concern: UI rendering, UI state, domain logic, Chrome adapter, content script, page-world script, background routing, storage, fixtures, and tests.

## Runtime-First Guardrails

Before adding fallback logic, optional chaining trees, or broad compatibility branches, capture or inspect the real contract:

- Browser API behavior.
- Extension message payload.
- `window.postMessage` payload.
- WebSocket frame shape.
- Tab, origin, reload, and page-context lifecycle.
- DevTools inspected-tab routing.

For this repo, message contracts are explicit and versioned through `src/domain/types.ts` and parsed in `src/domain/contracts.ts`. If a message contract changes, update the type, parser, tests, and the sender/receiver together.

Do not invent multi-shape support unless there are real captured examples. A fake fallback becomes a fake contract.

## WebSocket Boundary

Keep the engine choice explicit:

- `extension` engine: WebSockets are created by the extension UI context.
- `page` engine: WebSockets are created in the page context through `src/extension/pageEngine.ts`.

Chrome content scripts cannot directly replace or own page-world `window.WebSocket`. The page-context path must use injected page-world code plus a narrow bridge back to the extension UI.

For the page bridge:

- Keep `source` markers explicit.
- Validate incoming message shape before acting.
- Do not broaden `postMessage` listeners without proving the source, target, and payload contract.
- Treat page reloads and stale sessions as first-class lifecycle states.

## Security Lab Boundary

The Security Lab is an authorized workbench, not an exploit automation surface.

- Active tests require explicit authorization confirmation.
- Host-bound checks are intentional; do not weaken them just to make a demo pass.
- Public echo services are valid debugger connectivity checks, not proof that active security tests are safe against third-party hosts.
- Sensitive diagnostics, payloads, exports, debugger capture, and privileged operations must be visible and intentional in the UI.

Keep OWASP guidance practical: use the WebSocket Security Cheat Sheet for WebSocket-specific checks; do not turn the OWASP Top 10 into vague feature sprawl.

## Permissions

Current manifest permissions are narrow by design:

- `activeTab`
- `scripting`
- `storage`
- `sidePanel`
- optional `debugger`
- no default `host_permissions`

Do not add a permission unless the user-facing reason is clear enough for a Chrome Web Store listing. Prefer optional permissions when the workflow allows it. Treat `debugger` as sensitive and explicit.

## UI And Overlay Rules

Use deterministic, state-driven React for repeated interactive UI. Keep side effects behind adapters and domain logic out of leaf UI components.

For overlays, treat drag, resize, collapse, maximize/fit, close, focus, scrolling, and hit targets as behavior contracts, not polish.

- Header controls must not accidentally start dragging.
- Scrolling belongs inside the overlay body so controls remain usable.
- Resize behavior must be verified in the live browser surface when changed.
- Do not rely on host-page CSS behavior as a stable contract.

Keep the UI compact and operational. Avoid generic dashboard sprawl, decorative cards, and broad panels that do not map to concrete user actions such as connect, stop, edit URL, send, search, resend, copy, export, clear, inject, or authorize.

## Testing And Verification

Default checks:

```sh
npm test
npm run build
npm run test:integration
```

`npm run test:integration` reaches the public echo endpoint documented in `README.md`, so call that out when reporting verification.

Run the narrowest useful check first, then broaden based on changed files:

- Domain changes: run `npm test`.
- Manifest, background, content, page engine, overlay, or Chrome adapter changes: run `npm run build` and relevant tests.
- WebSocket runtime behavior: verify with the manual flow in `README.md` or Chrome DevTools MCP against the loaded unpacked extension.
- UI mechanics such as drag, resize, collapse, fit, focus, and scrolling: verify in a real browser surface, not only jsdom.
- If the unpacked extension was reloaded in `chrome://extensions`, reload the target page too so content scripts reattach.

When a runtime issue cannot be reproduced in tests, state what evidence is missing instead of adding speculative defensive code.

## Review Checklist

Before accepting a design or patch, ask:

- What runtime contract is this relying on?
- What is the single source of truth for the state being changed?
- Is state scoped to the tab, frame, origin, page, or extension-global context that actually owns it?
- Are fallback branches based on observed contracts or guesswork?
- What happens when the service worker sleeps, the tab reloads, the page navigates, or the socket reconnects?
- Can every permission and sensitive action be explained to a user?
- Is page mutation or active security behavior confirmed at the operation boundary?
- Are tests using real fixtures or convenient fiction?
- Would a maintainer know where to change this without reconstructing the entire extension?

## Git Hygiene

Always inspect `git status --short` before editing. The worktree may contain user changes. Do not revert or overwrite changes you did not make unless the user explicitly asks for that operation.


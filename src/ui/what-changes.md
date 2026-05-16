Implemented add-websocket-discovery-import through 26/29 OpenSpec tasks.

  What changed:

  - Added request-id based discovery domain logic in src/domain/discovery.ts.
  - Added background-owned Chrome debugger capture in src/extension/discoveryCapture.ts.
  - Extended runtime contracts and Chrome adapter messaging.
  - Added compact Discover UI in src/ui/DiscoverView.tsx.
  - Added target-only import, selected bootstrap replay, and evidence separation for observed traffic, recipes, and replay.
  - Updated openspec/changes/add-websocket-discovery-import/tasks.md: tasks 1.1 through 6.3 are checked.

  Verification passed:

  - npm test -> 43 tests passed.
  - npm run build -> passed.
  - npm run test:integration -> passed, and it reaches the public echo endpoint.

  Blocked:

  - Tasks 6.4, 6.5, and 6.6 remain unchecked. I attempted live extension verification, but local Chrome policy blocked unpacked extension loading:
      - Chrome reported: --load-extension is not allowed in Google Chrome, ignoring.
      - Chrome Dev reported the same.
      - Chrome DevTools MCP also timed out while listing pages.

  Next step is manual validation in a Chrome profile/environment where unpacked extension loading is allowed, then mark 6.4-6.6.
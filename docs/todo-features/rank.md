# Bug-Bounty Feature Ranking

This ranking is for turning the current WebSocket debugger into a stronger bug-bounty preparation workbench. The order favors evidence quality, target safety, and repeatability before active testing breadth.

| Rank | Feature | Importance | Why It Ranks Here |
| ---: | --- | ---: | --- |
| 1 | [Passive WebSocket CDP Capture](./01-passive-websocket-cdp-capture.md) | 10/10 | Trustworthy passive runtime evidence is the base for every serious workflow. |
| 2 | [Target Scope Profiles](./02-target-scope-profiles.md) | 9/10 | Scope mistakes create real user and program risk. |
| 3 | [Evidence Workspace And Session Transcript](./03-evidence-workspace-session-transcript.md) | 9/10 | Bug-bounty value depends on reproducible, redacted, structured proof. |
| 4 | [Frame Inspector And Replay Builder](./04-frame-inspector-replay-builder.md) | 8/10 | Controlled mutation and replay are core to WebSocket authorization testing. |
| 5 | [Active Test Safety Rails](./05-active-test-safety-rails.md) | 9/10 | Active testing needs explicit limits before the tool grows more powerful. |
| 6 | [Multi-Role Authorization Workflow](./06-multi-role-authorization-workflow.md) | 8/10 | Multi-role comparisons support high-value broken-access-control findings. |
| 7 | [DevTools Origin And Opaque-Origin Safety](./07-devtools-origin-opaque-origin-safety.md) | 8/10 | DevTools needs accurate target context and safe blocking behavior. |
| 8 | [Page Bridge Session Hardening](./08-page-bridge-session-hardening.md) | 8/10 | Page-world control must be hardened before expanding page-context features. |
| 9 | [Local Echo And Authorization Harness](./09-local-echo-auth-harness.md) | 7/10 | A local harness makes feature validation repeatable and realistic. |
| 10 | [Modular UI Architecture Split](./10-modular-ui-architecture-split.md) | 7/10 | This keeps the next feature wave maintainable instead of turning `App.tsx` into a large-file trap. |

## Recommended Build Order

1. Fix target safety first: DevTools origin, opaque-origin blocking, and active-test safety rails.
2. Implement passive CDP capture.
3. Add scope profiles and the session transcript model.
4. Add frame inspector and replay builder.
5. Add multi-role workflow once replay evidence is structured.
6. Add the local harness early enough to verify each feature, not after all feature work is complete.
7. Split UI modules before the feature files become too coupled.

## Ranking Rule

Higher score means the feature is more important for bug-bounty preparation, not necessarily easier to implement. Features that reduce unsafe testing or improve evidence quality rank above features that only add convenience.


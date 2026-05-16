# Modular UI Architecture Split

Status: TODO

Importance: 7/10

Rank: 10

## What The Feature Is

Split the growing React workbench into focused modules before adding the larger bug-bounty features.

The current app is still manageable, but the next features will add capture sessions, scope profiles, transcripts, frame diffing, and role workflows. Keeping all of that in one file would create maintenance debt quickly.

## What To Add

- `DebuggerView` module for frame stream, search, editor, send, resend, copy, and clear.
- `SecurityLabView` module for test selection, preflight, authorization, and active-run controls.
- `EvidenceWorkspaceView` module for transcript review and exports.
- `useExtensionSocket` hook for extension-context WebSocket behavior.
- `usePageBridge` hook for page-context bridge behavior.
- Domain modules for capture session, scope profile, transcript, and mutation recipe.
- Focused tests around hooks and domain modules instead of only end-to-end UI behavior.

## How It Benefits Users

- New features arrive faster because each area has a clear owner.
- Bugs become easier to isolate.
- The UI can grow without becoming a single fragile component.
- Test coverage can target behavior instead of implementation noise.

## Why This Importance

7/10 because this is an engineering enabler, not a direct bounty capability. It should happen before the codebase absorbs several high-rank features.

## Contract Notes

- Do not split just to create folders.
- Split when responsibility is already distinct: rendering, socket effects, bridge effects, evidence export, scope policy, and mutation logic.
- Keep names boring and workflow-oriented.


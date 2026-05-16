# Frame Inspector And Replay Builder

Status: TODO

Importance: 8/10

Rank: 4

## What The Feature Is

Add a structured frame inspector and replay builder for JSON and text WebSocket messages.

The current UI lets users select, edit, and resend payload text. For bounty prep, users need to understand message shape, isolate IDs or role-sensitive fields, mutate one value at a time, and compare original versus modified frames.

## What To Add

- JSON detection and parse-error display.
- JSON tree view with copy path, copy value, and edit value actions.
- Original versus modified diff view.
- Saved mutation recipes such as replace account id, replace object id, toggle role, remove field, add field, and change enum value.
- Replay action that records the original frame id, mutation recipe, outgoing payload hash, and server response frame.
- Tests for JSON path editing, text fallback, diff generation, and replay metadata.

## How It Benefits Users

- Users can test authorization and validation flaws with controlled mutations.
- Accidental broad payload changes become less likely.
- Evidence can show exactly which field changed.
- Repeated tests become faster without turning into uncontrolled fuzzing.

## Why This Importance

8/10 because controlled replay is central to WebSocket authorization testing, but it should come after passive capture and evidence structure.

## Contract Notes

- Do not auto-send mutations.
- Keep every replay tied to one selected original frame.
- Binary frames need explicit unsupported or preview-only handling until real binary workflows are designed.


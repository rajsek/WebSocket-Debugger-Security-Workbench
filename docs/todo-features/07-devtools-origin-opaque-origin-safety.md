# DevTools Origin And Opaque-Origin Safety

Status: TODO

Importance: 8/10

Rank: 7

## What The Feature Is

Resolve the inspected page origin in the DevTools surface and block active testing when the page origin is unknown or opaque.

The current DevTools adapter reports `unknown` origin. That weakens host-bound Security Lab checks exactly where users expect accurate inspected-tab context.

## What To Add

- DevTools origin resolution through `chrome.devtools.inspectedWindow.eval('location.origin')`.
- A normalized origin helper that distinguishes known web origins, unknown origins, and opaque origins such as `null`.
- Security Runner block reasons for unknown origin and opaque origin.
- UI text showing why active tests are disabled.
- Tests for `https://`, `http://`, `chrome://`, `file://`, `about:blank`, and malformed URL cases.

## How It Benefits Users

- DevTools testing gets the same safety behavior as popup and side panel testing.
- Active tests do not accidentally run when the extension cannot prove the page context.
- Users get a clear explanation instead of a silent bypass.

## Why This Importance

8/10 because this is both a bug fix and a safety feature. It is not as broad as passive capture, but it closes a real contract gap.

## Contract Notes

- Do not treat `unknown` as safe.
- Do not call `new URL(origin)` unless the origin has already been classified as a parseable web origin.
- Keep the origin classification pure and unit-tested.


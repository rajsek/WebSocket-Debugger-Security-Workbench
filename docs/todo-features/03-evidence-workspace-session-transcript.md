# Evidence Workspace And Session Transcript

Status: TODO

Importance: 9/10

Rank: 3

## What The Feature Is

Replace the current lightweight evidence list with a session-oriented evidence workspace that can produce a bug-bounty-ready report.

The current export records previews and hashes. That is a start, but bounty reports need reproducible steps, scope, role context, expected result, actual result, impact, and a clean transcript.

## What To Add

- A `SessionTranscript` domain model with target profile, socket URL, engine, timestamps, role label, captured frames, selected evidence frames, user notes, and final finding summary.
- A report builder with sections for summary, scope, prerequisites, reproduction steps, observed behavior, security impact, evidence, and cleanup notes.
- Redacted Markdown export and raw local-only JSON export.
- Per-record redaction preview before export.
- Evidence status: draft, confirmed, false-positive, needs-retest.
- Tests for redaction, export formatting, hash stability, and transcript ordering.

## How It Benefits Users

- Users can move from observation to a structured submission faster.
- Evidence remains tied to the exact target, role, and socket session.
- Reports become easier to review before submission.
- Users can preserve raw local evidence while exporting only redacted data.

## Why This Importance

9/10 because bug-bounty value depends on communicating proof clearly, not just finding an interesting frame.

## Contract Notes

- Raw payload export must be explicit.
- Redaction must be visible before download.
- Report fields should be boring and predictable, not auto-generated claims.


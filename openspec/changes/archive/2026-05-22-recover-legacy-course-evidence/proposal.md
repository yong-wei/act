## Why

5-1 and similar pre-governance sessions contain legacy envelopes and sync errors. A small subset may be recoverable from final state, but most cannot be converted to rich evidence without fabrication.

## What Changes

- Run dry-run-first recovery by lesson or session.
- Report candidates, recoverable, unrecoverable, affected sessions, affected users, already enriched, and newly enriched counts.
- Mark final-state recovered evidence distinctly.
- Regenerate selected session reports and rebuild cache after apply.

## Capabilities

### New Capabilities

- `course-evidence-backfill-reporting`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance/course-evidence-backfill.ts
- scripts/db/backfill-course-evidence
- session reports
- evidence browser quality filters

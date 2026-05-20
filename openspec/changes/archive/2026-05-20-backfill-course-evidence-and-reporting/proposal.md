## Why

Improved submission evidence will only apply to future rows unless recent classroom data can be enriched safely. Existing sessions may contain recoverable answer state in `StudentState` even when submit events only persisted an envelope.

## What Changes

- Add dry-run and apply tooling to enrich eligible historical submission and LearningFact evidence.
- Recover answer summaries from `StudentState`, `StudentStepResponse`, `InteractionLog`, and runtime manifests where possible.
- Mark unrecoverable rows as legacy instead of fabricating data.
- Regenerate class and student session reports for selected sessions, lessons, or date ranges.
- Print before/after coverage metrics for answer, score, question summary, report, and snapshot availability.

## Capabilities

### New Capabilities

- `course-evidence-backfill-reporting`: Safe enrichment and report regeneration for course evidence.

### Modified Capabilities

- None.

## Impact

- New or extended `scripts/db/*` data-governance commands
- `src/lib/data-governance/historical-evidence-materialization.ts`
- `src/lib/data-governance/session-reports.ts`
- Runtime manifest loading utilities used by backfill
- Data-governance tests

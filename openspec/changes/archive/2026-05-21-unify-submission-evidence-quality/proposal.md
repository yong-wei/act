## Why

Evidence quality is currently classified in multiple places, including event ingestion, session reports, data-quality reports, and course evidence backfill. The same manifest submission can drift between rich, partial, legacy, and missing depending on the consumer.

## What Changes

- Add a shared submission evidence quality module.
- Migrate interactive event ingestion, session reports, data-quality reports, and course evidence backfill to the shared classifier.
- Expose answer, score, question summary, subjective, parameter, extra evidence, and scoring support flags.
- Cover objective rich, subjective partial, parameter partial, manifest missing, legacy, final-state enriched, and unrecoverable legacy cases.

## Capabilities

### New Capabilities

- `submission-evidence-quality`

### Modified Capabilities

- None.

## Impact

- src/lib/data-governance/submission-evidence-quality.ts
- src/app/api/interactive/events/route.ts
- src/lib/data-governance/session-reports.ts
- src/lib/data-governance/session-data-quality-report.ts
- src/lib/data-governance/course-evidence-backfill.ts

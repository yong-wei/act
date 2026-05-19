## Why

The 4-7 classroom data review showed that the data-governance pipeline can generate reports, LearningFacts, and snapshots, but the evidence is not yet reliable enough for serious post-class learning analysis. Submitted quiz answers are recoverable only from mutable StudentState, LearningFact scores stay at zero, and sync-error bursts can dominate interaction counts.

This change hardens interactive classroom evidence so reports, immutable submissions, LearningFacts, and snapshots tell the same story after a live lesson.

## What Changes

- Persist submitted answer payloads into immutable submission records for interactive lesson cards.
- Convert objective quiz submissions into scored LearningFacts with per-question correctness and aggregate score metadata.
- De-duplicate or suppress bursty sync-error telemetry before it inflates classroom governance summaries.
- Align ClassSessionReport counts with the stored evidence sources used by follow-up analysis.
- Make snapshot-update coverage auditable from report data, including which participation population was used.
- Add regression coverage based on the 4-7 failure mode: high participation, two explicit quiz steps, repeated submit attempts, and localized sync-error bursts.

## Capabilities

### New Capabilities
- `interactive-governance-evidence`: Defines reliable evidence requirements for interactive classroom submissions, LearningFacts, sync-error accounting, and report/snapshot consistency.

### Modified Capabilities
- None.

## Impact

- Affected storage paths: `InteractionLog`, `StudentStepResponse`, `LearningFact`, `ClassSessionReport`, `StudentCompetencySnapshot`, and related governance workers or backfill scripts.
- Affected runtime paths: interactive lesson submit telemetry, session finalization, data-governance ingestion, and class/session report generation.
- Affected tests: unit and integration coverage for interactive event ingestion, 4-7 style quiz submissions, report summaries, LearningFact scoring, and sync-error burst handling.
- No database schema change is required unless implementation shows current JSON columns cannot preserve the required evidence.

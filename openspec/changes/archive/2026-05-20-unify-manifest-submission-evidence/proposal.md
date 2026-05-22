## Why

The 5-1 production data showed that classroom events, facts, reports, and snapshots are running, but some lessons still submit only an event envelope instead of answer evidence. This makes post-class diagnosis depend on mutable `StudentState` and prevents durable question-level scoring.

## What Changes

- Add one shared manifest submission path for all manifest-driven interactive lessons.
- Define a versioned `manifest-submission-v2` evidence envelope that carries answers, answer digests, question summaries, scoring, misconception tags, subjective completeness, and optional parameter snapshots.
- Persist the same evidence envelope through `InteractionLog`, `StudentStepResponse`, `LearningFact.contextJson`, and session report summaries.
- Derive `LearningFact.score` and `outcome` from submitted evidence instead of treating every submit as unconditional success.
- Keep legacy submit events safe by marking their evidence quality instead of silently pretending they are fully diagnosable.

## Capabilities

### New Capabilities

- `manifest-submission-evidence`: Shared evidence contract and persistence behavior for manifest lesson submissions.

### Modified Capabilities

- None.

## Impact

- `src/features/interactive/shared/manifest-runtime/*`
- `src/features/interactive/session-framework/*`
- `src/app/api/interactive/events/route.ts`
- `src/lib/data-governance/learning-fact-materialization.ts`
- `src/lib/data-governance/session-reports.ts`
- Existing interactive/data-governance tests and new coverage for the v2 evidence envelope

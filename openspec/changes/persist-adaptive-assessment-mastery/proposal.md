## Why

The report identifies the current adaptive-assessment engine as memory-only. It cannot support reproducible mastery updates, governed evidence, or path planning. This change isolates that persistence work so learner state and path planning do not depend on volatile assessment data.

## What Changes

- Persist adaptive assessment sessions, answers, item references, ability estimates, mastery updates, and algorithm versions.
- Emit governed LearningFacts for assessment submissions and mastery updates.
- Add assessment-backed BKT-compatible mastery state while keeping non-assessment evidence conservative.
- Preserve existing assessment API response compatibility during migration.

## Capabilities

### New Capabilities
- `adaptive-assessment-persistence`: Persists adaptive assessment attempts and reproducible ability/mastery updates.
- `adaptive-mastery-state`: Defines assessment-backed knowledge mastery state and confidence rules.

### Modified Capabilities
- None.

## Governance Contract Dependency

This change consumes `establish-adaptive-learning-governance-contracts` for assessment payload privacy classes, evaluation-event envelope fields, feature flag fallback behavior, rollback notes, and ER/data-dictionary/API-example handoff expectations.

## Impact

- Affects `prisma/schema.prisma`, assessment routes/services, and data-governance fact materialization.
- Depends on `establish-adaptive-learning-governance-contracts`.

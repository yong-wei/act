## Why

The source catalog phase identifies which out-of-class and historical records are eligible for profile-grade evidence, but it remains read-only. The platform needs a controlled materialization step that turns eligible high-value records into durable, traceable governance facts without polluting profiles with seed, showcase, demo, or test data.

## What Changes

- Add catalog-driven source adapters for eligible historical out-of-class evidence.
- Add dry-run and apply modes for materializing eligible evidence into governed facts.
- Preserve raw source tables and write only derived governance records.
- Use stable source identities so repeated runs are idempotent.
- Record exclusion and unsupported-source summaries for audit.
- Keep feature-cache, recommendation, and UI consumption out of this change.

## Capabilities

### New Capabilities

- `historical-learning-evidence-materialization`: Dry-run-first and idempotent materialization of eligible historical learning evidence.

### Modified Capabilities

- `learning-evidence-source-catalog`: Materialization adapters must consume catalog eligibility, provenance, value-level, and canonical event policies from the preceding source catalog change.

## Impact

- Affected data sources: `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, Arena submissions/evaluations, eligible `InteractionLog` event families, and existing `LearningFact` traces.
- Affected code areas: data-governance materialization scripts/services, source adapters, audit reports, and tests.
- No raw rows are edited or deleted.
- No profile summary, recommendation behavior, or learner-facing UI changes are required.

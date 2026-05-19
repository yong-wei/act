## Why

The platform already stores substantial out-of-class and classroom-adjacent learning data in `InteractionLog`, `SimulationLog`, `UserAnswer`, Arena tables, prompt/design assessment tables, and `LearningFact`, but only a small fraction is normalized into the evidence layer consumed by profiles, snapshots, and recommendations. This change creates a unified evidence-governance foundation so existing telemetry can support efficient student profiling, personalized learning, teacher diagnosis, and future analytics without each application re-reading raw tables differently.

## What Changes

- Introduce a source evidence catalog that classifies existing learning data sources by provenance, scope, value level, and eligibility for profile contribution.
- Add source-adapter contracts for converting high-value raw rows into normalized learning evidence without losing traceability to their source tables.
- Define historical materialization requirements for out-of-class and standalone learning evidence, including dry-run, idempotency, and exclusion of seed/showcase/test data from real student profiles.
- Establish an evidence feature layer for efficient profile and recommendation consumption so `/profile`, growth views, and recommendation APIs do not need to scan large raw tables.
- Require recommendation and profile outputs to expose reason codes and evidence summaries when they are driven by governed evidence.
- Keep low-value views and navigation events available for activity context while preventing them from directly inflating competency scores.

## Capabilities

### New Capabilities

- `learning-evidence-governance`: Unified governance for cataloging raw learning evidence sources, normalizing high-value evidence, materializing profile-ready facts/features, and serving efficient profile and recommendation consumers.

### Modified Capabilities

- `interactive-governance-evidence`: Align interactive classroom evidence with the unified evidence catalog and shared profile-consumption policy while preserving its durable submission and report requirements.

## Impact

- Affected data sources: `InteractionLog`, `StudentStepResponse`, `LearningFact`, `LearningEventBatch`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, `ArenaSubmission`, `ArenaEvaluationRun`, and profile/snapshot tables.
- Affected services: data-governance worker, historical backfill scripts, `/api/user/profile`, `/api/student/recommendations`, teacher insight APIs, and admin data-governance status reporting.
- Affected policies: source provenance, seed/showcase/demo/test exclusion, high-value vs low-value evidence classification, idempotent materialization, feature-cache refresh, profile explanation, and recommendation reason-code semantics.
- No user-facing UI redesign is required in this change, but profile and recommendation payloads may gain evidence summaries and reason metadata.

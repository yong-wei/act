## Why

Simulation runs, Arena previews, and Konling tool runs become useful for teaching only when they are materialized into governed evidence without leaking raw traces or cross-user memory. The platform needs a draft/outbox/dedupe layer before profiles, recommendations, teacher insights, and data-center summaries consume this evidence.

## What Changes

- Define `LearningEvidenceDraft` or equivalent materialization staging for SimulationRun and AgentToolRun outputs.
- Use event/outbox and dedupe keys so retries do not create duplicate LearningFacts.
- Materialize compact, user-isolated simulation/Arena/agent evidence into LearningFact and feature-cache inputs.
- Require profile, recommendation, and teacher consumers to preserve preview/official provenance, source coverage, confidence, and user/class authorization.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `simulation-arena-evidence-governance`: Adds draft, outbox, dedupe, and materialization boundaries for SimulationRun and AgentToolRun evidence.
- `student-evidence-feature-cache`: Adds deterministic consumption of materialized simulation and agent evidence by owner user.
- `evidence-driven-personalization`: Requires profile and recommendation rationale to preserve simulation/agent provenance and confidence.
- `teacher-evidence-governance`: Adds teacher-scoped simulation/agent evidence summaries without raw trace or memory leakage.

## Impact

- Depends on `bridge-konling-simulation-tools` and `connect-arena-preview-to-simulation-evidence`.
- Affects data governance services, LearningFact materializers, feature cache rebuilds, profile/recommendation APIs, teacher insight APIs, and data-center status.

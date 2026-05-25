## Context

The report notes a governance gap around simulation evidence. Local inspection shows both `SimulationSession` and `SimulationLog` exist; the deeper issue is that sessions, logs, Arena public experiments, virtual previews, submissions, evaluations, and learning facts do not share an explicit evidence lineage.

## Goals

- Model simulation and Arena records as a traceable evidence family.
- Keep `LearningFact` compact and suitable for analytics.
- Make provenance, retention, privacy level, protocol version, run id, and source references visible to governance reporting.

## Non-Goals

- No full data warehouse or feature store in this change; this change emits compact governed summaries that a later feature-cache change consumes.
- No historical data backfill in this change unless needed for tests.
- No leaderboard policy change.
- No high-frequency sample duplication into `LearningFact`.

## Design

Extend the evidence catalog with source definitions for:

- `SimulationSession`: run/session envelope, launch context, course/class/session binding, and replay metadata reference.
- `SimulationLog`: attempt-level or activity-level record, including legacy simulation attempts and game-like practice records.
- `ArenaBlackBoxExperiment`: public experiment dataset and budget evidence.
- `ArenaVirtualSimulationRun`: preview trace and controller evidence.
- `ArenaSubmission`: official student submission.
- `ArenaEvaluationRun`: official hidden evaluation result.
- `LearningFact`: materialized compact learning evidence.

The materialization contract should place identifiers, protocol version, trace reference, summary metrics, governance profile, source provenance, and course/class/session context into `LearningFact.contextJson`. It should not place raw high-frequency samples there.

Admin governance status should be able to show source coverage, readiness, unsupported states, and missing context for the simulation/Arena family.

This change is intentionally a bridge over existing specs, not a replacement for them. It modifies the intent of `learning-evidence-source-catalog` and `arena-learning-evidence-context`, while the new `simulation-arena-evidence-governance` capability records cross-source lineage rules that neither existing spec fully owns.

## Risks

- Governance additions can become vague unless each source has concrete traceability fields.
- Learning facts can become too large. Enforce summary/reference boundaries.

## Verification

- Catalog unit tests for source classification and readiness.
- Materialization tests for compact context and trace references.
- Admin status tests for new source rows where applicable.
- Gate with `rtk proxy openspec validate govern-simulation-and-arena-evidence-sources --strict`.

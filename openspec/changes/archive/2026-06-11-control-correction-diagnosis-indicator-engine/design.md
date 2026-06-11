## Context

Current implementation has the right inputs: `LearningFact`, adaptive assessment records, simulation/Arena summaries, `StudentEvidenceFeatureCache`, control-correction path evidence, document grading drafts, and role-based diagnosis claims. The missing layer is a deterministic metric materializer that turns those inputs into stable diagnosis snapshots.

## Goals / Non-Goals

**Goals:**

- Define the persisted indicator model for control-correction diagnosis.
- Give every indicator an auditable query and scoring policy.
- Produce report snapshots suitable for both student and teacher projections.
- Preserve low-confidence, missing, stale, and partial evidence states instead of inventing precise scores.

**Non-Goals:**

- Creating the final student or teacher UI.
- Replacing `LearningFact` or `StudentEvidenceFeatureCache`.
- Letting LLM output directly decide indicator scores.
- Implementing provider compatibility or RAG authority changes.

## Decisions

### Decision 1: Diagnosis indicators are definitions, not prompt text

Each indicator must be represented as data with dimension id, source families, query spec, normalization policy, confidence policy, privacy visibility, and version. LLMs may explain the result later, but they cannot be the source of the score.

### Decision 2: Snapshots are reproducible materializations

`DiagnosisIndicatorSnapshot` stores the materialized value for one user or class scope. `DiagnosisReportSnapshot` stores the composed report view, source windows, limitations, and materializer version. The raw evidence remains in existing tables.

### Decision 3: Percentile and growth percentile are class-scoped

Percentiles must be calculated only against authorized class cohorts and must expose sample size and fallback state. Growth percentile compares score deltas within a prior-score cohort; it must be unavailable for cold-start students rather than fabricated.

### Decision 4: Existing diagnosis claims consume snapshots

Role-based diagnosis remains the role-specific projection layer. It should read indicator/report snapshots when present and degrade to existing claim materialization only when snapshots are missing.

## Validation

- Unit tests cover indicator definition validation, normalization, confidence, percentile, growth percentile, and cold-start fallbacks.
- Materializer tests cover missing, stale, low-confidence, and conflicting evidence.
- API or service tests prove student and teacher scopes cannot read unauthorized report snapshots.
- `rtk openspec validate control-correction-diagnosis-indicator-engine --strict` passes.

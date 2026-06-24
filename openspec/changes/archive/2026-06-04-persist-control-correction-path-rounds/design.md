## Context

Existing planner output is useful but not yet an auditable product object. The report recommends extending `LearningPath` instead of creating a duplicate table family. This change defines the minimum persistence and API contract required to make a path round resumable, explainable, and measurable.

## Goals / Non-Goals

**Goals:**

- Persist control-correction path rounds with planner version, learner-state snapshot reference, current node, status, path payload, explanation payload, alternatives, and terminal validation policy.
- Persist node execution, deviation, and Konling intervention records as append-only audit objects.
- Provide REST endpoints aligned with existing App Router route-handler style.
- Keep legacy recommendations and old path readers compatible.

**Non-Goals:**

- Replacing all recommendation surfaces.
- Implementing teacher reports.
- Introducing GraphQL or a new recommendation engine.

## Decisions

### Decision 1: Extend `LearningPath` as the main object

Implementation should prefer additive fields and child records around the existing `LearningPath` model. A same-meaning replacement object would fragment the evidence chain.

### Decision 2: Path writes are append-oriented

Execution, deviation, and intervention events must be recorded as durable append records so later cache rebuilds and teacher reports can audit them.

### Decision 3: Legacy compatibility is required

Existing surfaces that read `LearningRecommendation` or lightweight path fields should continue to function, either unchanged or via a documented compatibility mapper.

## API Contract

- `POST /api/learning-paths/plan` creates or recalculates a path round.
- `GET /api/learning-paths/:id` returns path details, explanations, alternatives, current node, and evidence limits.
- `POST /api/learning-paths/:id/execute` records node execution state.
- `POST /api/learning-paths/:id/deviations` records skip, timeout, manual jump, resource failure, or abandonment.
- `POST /api/learning-paths/:id/interventions` records Konling intervention proposals and outcomes.

## Data Ownership, Privacy, and Compatibility

- `LearningPath.userId` remains the ownership boundary for student reads and writes. Teacher access is class-scoped through `LearningPath.classId`; administrators may read or write for operational support.
- `LearningPath` stores the resumable path object: planner version, current node, status, input snapshot reference, serialized path payload, explanation payload, alternatives, entry node, terminal validation, and last execution metadata.
- `LearningPathExecution`, `LearningPathDeviation`, and `LearningPathIntervention` are append-only child records. They use path-scoped idempotency keys so client retries do not duplicate execution, deviation, or intervention events.
- Student-visible state only exposes path ids, status, current node, terminal validation state, and low-confidence markers. Raw execution payloads, raw evidence payloads, and private Konling dialogue remain audit or teacher-scoped data.
- Migration is additive: legacy `LearningPath` columns are retained, new columns are nullable or defaulted, and child tables cascade on path deletion. Rollback can drop the child tables and new columns without rewriting legacy recommendation rows.
- Legacy consumers continue to receive lightweight path summaries through the compatibility mapper, and the `CONTROL_CORRECTION_PATH_ROUNDS_ENABLED=false` feature flag keeps existing adaptive practice and recommendation flows on the legacy path.

## Validation

- Migration tests SHALL verify additive migration and rollback safety.
- API tests SHALL verify ownership, status transition, idempotency, and legacy fallback behavior.
- `rtk openspec validate persist-control-correction-path-rounds --strict` SHALL pass.

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

## Validation

- Migration tests SHALL verify additive migration and rollback safety.
- API tests SHALL verify ownership, status transition, idempotency, and legacy fallback behavior.
- `rtk openspec validate persist-control-correction-path-rounds --strict` SHALL pass.

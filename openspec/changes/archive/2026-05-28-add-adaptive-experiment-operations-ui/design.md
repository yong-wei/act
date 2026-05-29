## Context

The active optimization change explicitly defers contextual bandit reranking, experiment assignment, long-term semantic memory, strategy memory, and bulk resource operations until Stage 1 evidence is stable. This UI change keeps that boundary visible and prevents premature MVP scope expansion.

## Goals / Non-Goals

Goals:

- Define operation views for experiments, metrics, bandit comparisons, memory audit, and teacher bulk ResourceNode workflows.
- Require privacy-safe aggregation, sample counts, confidence markers, and completeness markers.
- Keep Stage 2 disabled unless prerequisite flags and evidence/audit gates pass.

Non-goals:

- No Stage 1 adaptive center features.
- No reinforcement learning or long-horizon hybrid planner UI.
- No exposure of raw learner memory or private intervention content.

## Decisions

### Experiments are operations, not student core UI

Students may benefit from optimized paths, but experiment assignment and metric analysis belong to teacher/admin operation surfaces.

### Bandit remains a local reranking display

The UI can compare local alternatives and variant outcomes, but must not imply that bandit bypasses graph feasibility, privacy, teacher, device, time, or prerequisite constraints.

## Risks

- Experiment dashboards can be misread as causal proof. They must show sample count, confidence, completeness, and cohort/stratum context.
- Memory audit can leak sensitive information. Raw memory stays restricted.

## Verification

- Tests for feature flags, prerequisite-gate display, privacy-safe aggregation, and restricted memory audit states.
- Strict OpenSpec validation for this change.

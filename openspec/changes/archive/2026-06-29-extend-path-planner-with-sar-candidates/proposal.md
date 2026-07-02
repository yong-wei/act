## Why

Path planning should benefit from SAR-associated resources, but dynamic association must not override LearningGoal boundaries, K/A/Q subgraph constraints, learner overlays, teacher policy, ResourceNode audit, PlanningUnit eligibility, readiness, or terminal validation. SAR belongs in the candidate explanation layer, not the path authority layer.

## What Changes

- Add SAR candidate input to adaptive path planning.
- Treat SAR candidates as Tier 4 supplemental candidates after graph-mandated, teacher-assigned, and ResourceNode-eligible candidates.
- Reject SAR candidates that are not audited PlanningUnits or violate privacy, teacher policy, readiness, or terminal validation requirements.
- Record SAR candidate basis, selected/rejected ids, and reasons in path explanations.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `adaptive-learning-path-planning`.
- Depends on SAR expansion and Source Pack path-planning evidence.

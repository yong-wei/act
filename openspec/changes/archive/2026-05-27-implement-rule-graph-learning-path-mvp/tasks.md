## 1. Planner Core

- [x] 1.1 Add learning plan, plan node, alternative, explanation, execution status, deviation, correction, and feedback models/contracts.
- [x] 1.2 Implement rules plus graph search over learner state and ResourceNode graph.
- [x] 1.3 Enforce prerequisite, time, teacher policy, availability, privacy, risk-intervention, device, and terminal constraints.
- [x] 1.4 Implement multi-objective scoring and reason metadata.

## 2. Visualization and Feedback

- [x] 2.1 Add map view payloads with main path, branch paths, current node, completed nodes, risk nodes, blocked nodes, and alternatives.
- [x] 2.2 Add timeline payloads for 3-day, 7-day, and 14-day windows.
- [x] 2.3 Add evidence view payloads with evidence basis, confidence, source coverage, learner-state deficits, prerequisite reasons, teacher policy, and alternatives.
- [x] 2.4 Record path adoption, node completion, deviation, correction success, explanation clicks, and helpfulness feedback.

## 3. Validation

- [x] 3.1 Add tests for constraint enforcement, explanation consistency, fallback behavior, privacy filtering, correction paths, and visualization payload shape.
- [x] 3.2 Validate with `rtk openspec validate implement-rule-graph-learning-path-mvp --strict`.

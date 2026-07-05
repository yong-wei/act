## Design Notes

Review runtime lesson steps and promote only valid steps to PlanningUnit or classify them as supporting, embedded, evidence-producing, or excluded resources.

### Batch Boundary

- Use helper workqueues to split runtime lesson steps by lesson, LearningGoal, and missing fields.
- The implementing agent reviews step title, route target, graph binding, capability target, estimated time, evidence behavior, and prerequisite role.
- Add reviewed disposition and parent/child relationships for non-planning steps.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

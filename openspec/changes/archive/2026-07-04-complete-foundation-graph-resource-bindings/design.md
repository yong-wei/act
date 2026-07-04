## Design Notes

Manually bind foundation-domain graph nodes to existing resources and classify insufficient nodes with actionable gaps.

### Batch Boundary

- Cover feedback-loop-concept-foundations, transfer-function-modeling-foundations, and time-domain-response-analysis target nodes.
- Use helper workqueues, SAR/RAG candidate search, and human review to choose resources.
- Update graph-resource coverage artifacts or source records according to existing ownership rules.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

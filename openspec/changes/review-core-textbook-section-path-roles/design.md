## Design Notes

Review core automatic-control textbook sections at section grain and classify them for path planning, supporting citation, remediation, or exclusion.

### Batch Boundary

- Prioritize core course textbooks used for automatic-control foundations, analysis, design, and simulation topics.
- Promote only reviewed section-level units, not paragraph chunks, figure descriptions, or raw retrieval chunks.
- Link reviewed sections to LearningGoals, graph nodes, prerequisite position, estimated time, and citation addresses.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

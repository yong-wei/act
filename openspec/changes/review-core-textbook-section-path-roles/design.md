## Design Notes

Review core automatic-control textbook sections at section grain and classify them for path planning, supporting citation, remediation, or exclusion.

### Batch Boundary

- Prioritize core course textbooks used for automatic-control foundations, analysis, design, and simulation topics.
- Promote only reviewed section-level units, not paragraph chunks, figure descriptions, or raw retrieval chunks.
- Link reviewed sections to LearningGoals, graph nodes, prerequisite position, estimated time, and citation addresses.
- If the current helper output lacks a scoped core-textbook section bucket or mixes section/chunk/search-document rows, repairing or adding that scoped workqueue is part of this change. The agent should not escalate that worklist mismatch to `needs-human`.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

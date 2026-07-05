## Design Notes

Build and review the minimum assessment resource set needed for every current LearningGoal to support readiness, practice, checkpoint, remediation, and terminal-validation stages.

### Batch Boundary

- Reuse existing static bank, Prisma Question rows, AC-Q files, iCourse objective items, K/A/Q foundation items, and manually authored checkpoint items before creating new items.
- The implementing agent reviews every counted item for LearningGoal, K/A/Q objective, graph node, difficulty, cognitive level, misconception, remediation, and source hash.
- Author only the minimum new items needed to close verified gaps.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

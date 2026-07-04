## Design Notes

Extend the helper output so agents can claim bounded resource-completion workqueues and verify before/after progress without scanning the entire resource universe manually.

### Batch Boundary

- Emit stable workqueue JSON/Markdown grouped by resource family, LearningGoal, graph domain, missing-field code, and suggested review batch.
- Preserve privacy-minimized output and raw-content exclusion.
- Add tests proving each queue is deterministic, deduplicated, and references stable candidate ids from existing helper output.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

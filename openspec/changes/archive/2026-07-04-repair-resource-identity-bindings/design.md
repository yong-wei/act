## Design Notes

Repair source identity and teaching-resource binding blockers so downstream semantic review starts from stable resource identities.

### Batch Boundary

- Restore or generate the missing runtime lesson 1-3 JSON expected by mapped runtime lessons.
- Resolve missing and unregistered TeachingResource registryId values through existing registry contracts.
- Manually bind each TeachingResource to appropriate knowledge nodes or mark it with an explicit reviewed limitation when no binding is valid.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

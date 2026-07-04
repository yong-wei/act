## Design Notes

Bind simulation-validation and ship-ocean transfer graph nodes to governed resources and classify remaining high-complexity gaps.

### Batch Boundary

- Cover simulation-validation-practice and ship-ocean-transfer-application target graph nodes.
- Review simulation, control workbench, Arena preview, terminal-validation, reflection, and transfer-application resources.
- Preserve official Arena scoring boundaries and preview/official distinction.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

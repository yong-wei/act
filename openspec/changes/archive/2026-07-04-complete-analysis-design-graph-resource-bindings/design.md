## Design Notes

Manually bind analysis/design graph nodes to reviewed resources and expose remaining instructional gaps.

### Batch Boundary

- Cover root-locus-analysis-foundations, frequency-response-foundations, stability-margin-frequency-analysis, and control-correction target nodes.
- Review resource candidates from knowledge cards, runtime lessons, handouts, textbooks, exercises, simulations, and Arena/context resources.
- Keep terminal-validation and assessment semantics separate from ordinary concept resources.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

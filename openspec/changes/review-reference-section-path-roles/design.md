## Design Notes

Classify reference-resource sections as supporting citation, remediation, extension, enrichment, or excluded resources, with reviewed path promotion only for suitable sections.

### Batch Boundary

- Review reference and encyclopedia sections by source family and graph/LearningGoal candidate fit.
- Prioritize sections that fill gaps left after core textbook review.
- Mark advanced, duplicate, off-topic, copyright-restricted, or unsuitable material with explicit rationale.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

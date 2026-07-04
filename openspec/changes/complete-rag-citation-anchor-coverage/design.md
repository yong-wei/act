## Design Notes

Close RAG indexing and citation-anchor gaps for reviewed resource projections without promoting citation-only chunks into path nodes.

### Batch Boundary

- Index reviewed textbook/reference sections, related chunks, figures, and anchors through governed corpus metadata.
- Complete or explicitly limit media transcript, slide, image, figure, page, equation, and timestamp anchors.
- Verify CitationAddress resolution for selected/supporting path resources and Konling grounding.

### Manual Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require human review. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as human-confirmed.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

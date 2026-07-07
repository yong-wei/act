## Design Notes

Resolve the residual disposition backlog through implementing-agent item-by-item semantic review of remaining resources or by creating precise exclusion/limitation states.

### Batch Boundary

- Run the helper after upstream resource-family batches and isolate all remaining missing semantic-review, missing disposition, invalid promotion, unmatched projection, or unexplained exclusion findings.
- Review residual knowledge cards, infographs, registered resources, quiz/exercise/homework resources, slides, video/audio, image descriptions, miscellaneous runtime projections, and any cross-family leftovers.
- Produce a final before/after helper summary for downstream evidence-lineage and full-readiness gate changes.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

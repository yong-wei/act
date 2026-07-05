## Design Notes

Classify runtime media, slides, audio, video, PDFs, and handouts into path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded dispositions.

### Batch Boundary

- Review 904 runtime lesson media and 36 handout projections by lesson family and source hash.
- Define transcript/anchor needs for audio/video and page/figure anchors for slides/PDFs.
- Separate independent teaching resources from embedded assets and citation-only media.
- If the current helper output includes non-media/handout families or omits handout rows behind identity repair, repairing or adding a scoped runtime-media/handout workqueue is part of this change. The agent should not escalate that worklist mismatch to `needs-human`.

### Implementing-Agent Semantic Review Policy

Semantic fields such as graph binding, LearningGoal fit, capability or quality contribution, path role, remediation purpose, and exclusion rationale require implementing-agent item-by-item semantic review against source content. Scripts, SAR, RAG, and local or external model output may propose candidates, but they cannot mark final semantic fields as review-confirmed without per-record rationale.

### Dependency Position

This change is part of the `resource-path-readiness` series and must preserve before/after helper evidence so downstream changes can prove that their blockers are not caused by incomplete resource semantics.

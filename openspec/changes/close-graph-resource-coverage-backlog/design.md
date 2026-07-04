## Design Notes

This change closes the graph-node side of the resource completeness audit. It is intentionally separate from resource disposition review: a resource can be fully classified while a graph node still lacks a suitable resource ref, and a graph node can have a reviewed gap even when no existing resource should be attached.

### Batch Boundary

- Input is the helper workqueue for `graph-node-resource-missing`, currently 541 findings in the latest audit snapshot.
- Priority graph batches should have already handled foundation, analysis/design, and simulation/transfer target nodes.
- This batch handles the remaining graph nodes, including knowledge cards, infographs, exercises, homework-derived resources, slides, video/audio transcripts, image descriptions, textbook/reference sections, or explicit reviewed gaps where relevant.

### Manual Review Policy

SAR/RAG may propose candidate resources, but accepted graph refs require reviewer-visible rationale, source/version evidence, and explicit distinction between citation support, path eligibility, assessment support, remediation, terminal validation, and exclusion.

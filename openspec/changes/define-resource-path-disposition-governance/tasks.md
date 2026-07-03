## Tasks

- [ ] 1. Add resource path-planning disposition semantics.
  - Define accepted disposition values, required fields, and promotion rules for path-plannable, supporting-citation, embedded-asset, evidence-producing, and excluded resources.
  - Ensure provisional or script-inferred fields cannot satisfy human-reviewed promotion requirements.

- [ ] 2. Extend data-completeness helper output.
  - Report missing disposition, missing human review, missing rationale, missing parent planning unit, and invalid promotion separately.
  - Preserve existing layer separation for graph, resource binding, citation, path readiness, evidence lineage, and learner fixture readiness.

- [ ] 3. Add governance tests and fixtures.
  - Verify retrieval chunks and citation targets remain non-path nodes unless backed by audited ResourceNode or checkpoint contracts.
  - Verify embedded assets can be counted through parent planning units without being promoted independently.

- [ ] 4. Validate the change.
  - Run `rtk openspec validate define-resource-path-disposition-governance --strict`.
  - Run the data-completeness helper and confirm new disposition gaps are visible without mutating data.

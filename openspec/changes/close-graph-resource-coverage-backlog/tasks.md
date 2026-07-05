## Tasks

- [ ] Task 1: Generate residual graph-node workqueue.
  Covers: AC-1
  Acceptance: The workqueue enumerates every remaining `graph-node-resource-missing` finding after upstream graph/resource batches.
  Evidence: helper workqueue output with current and remaining graph-node-resource-missing totals.
  Reviewer Check: Confirm foundation, analysis/design, and simulation/transfer batches are not counted twice.

- [ ] Task 2: Bind remaining graph nodes item by item or create reviewed gaps.
  Covers: AC-1, AC-2
  Acceptance: Every remaining graph node receives reviewed resource refs or a reviewed limitation state with actionable category.
  Evidence: graph coverage helper before/after output.
  Reviewer Check: Confirm SAR/RAG suggestions were not accepted without implementing-agent per-record rationale.

- [ ] Task 3: Validate graph coverage closure.
  Covers: AC-2, AC-3
  Acceptance: The helper reports zero unexplained `graph-node-resource-missing` findings, or reports only reviewed limitation states, and baseline overlays expose the remaining limitation categories.
  Evidence: data-completeness helper, graph coverage overlay output, and `rtk openspec validate close-graph-resource-coverage-backlog --strict`.
  Reviewer Check: Confirm citation-only resources and provisional metadata do not count as path-eligible coverage.

## Validation

- [ ] Run `rtk openspec validate close-graph-resource-coverage-backlog --strict`.
- [ ] Run the data-completeness helper and preserve before/after graph-node-resource-missing totals.

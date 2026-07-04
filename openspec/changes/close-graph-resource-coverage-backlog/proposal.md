## Why

The data-completeness helper reports 541 active graph nodes without resource refs. Foundation, analysis/design, and simulation/transfer batches cover priority goal domains, but the remaining graph-node-resource-missing work still needs an explicit closure batch so the final readiness gate can prove every graph node is either resource-grounded or has a reviewed limitation.

## What Changes

- Consume the graph-node-resource-missing workqueue after priority graph/resource batches complete.
- Manually bind remaining graph nodes to reviewed resources where suitable.
- Mark nodes without suitable resources with reviewed limitation states and actionable gap categories.
- Recompute graph coverage and LearningGoal baseline overlays so downstream gates can distinguish resolved refs from reviewed gaps.

## Impact

- Adds a graph-coverage closure batch under `resource-path-readiness`.
- Blocks residual resource disposition closeout and the final full-resource readiness gate.
- Does not promote citation-only or provisional resource suggestions to path eligibility.

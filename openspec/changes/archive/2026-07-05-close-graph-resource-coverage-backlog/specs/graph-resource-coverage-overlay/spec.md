## ADDED Requirements
### Requirement: Residual graph resource coverage backlog is closed
The graph resource coverage workflow SHALL close residual graph nodes without resource refs after priority graph/resource batches complete.

#### Scenario: Residual graph-node workqueue is reviewed
- **WHEN** the helper emits remaining `graph-node-resource-missing` findings after foundation, analysis/design, simulation/transfer, runtime, media, long-form, and assessment batches
- **THEN** each finding SHALL be resolved by a reviewed resource ref or a reviewed limitation state
- **AND** the decision SHALL include graph node id, source family where applicable, coverage role, reviewer rationale, source/version evidence, and whether the result is citation support, path support, assessment support, remediation, terminal validation, or an explicit gap.

#### Scenario: Graph node remains without a suitable resource
- **WHEN** no existing resource should be linked to a graph node
- **THEN** the node SHALL carry an actionable reviewed limitation category
- **AND** downstream coverage overlays and final readiness gates SHALL not treat it as an unexplained missing resource ref.

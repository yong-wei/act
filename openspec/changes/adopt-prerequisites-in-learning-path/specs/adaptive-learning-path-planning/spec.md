## MODIFIED Requirements

### Requirement: Path planner generates constrained explainable paths
The planner MUST traverse only ACT Teaching Projection `ACT_TEACHING` prerequisites with `REQUIRED` strength for hard dependencies, exclude learner-mastered nodes, topologically order the remainder, and choose current accessible Teaching Projection resources. ActKG engineering relations and textbook/lesson order MAY be rationale only and MUST NOT become hard edges.

#### Scenario: Goal has required prerequisites
- **WHEN** a path-eligible goal has a valid current Projection and required prerequisite DAG
- **THEN** the planner SHALL reverse-traverse unmet REQUIRED nodes and return a deterministic topological path
- **AND** each emitted node SHALL have at least one accessible projected resource

#### Scenario: Engineering relation is present
- **WHEN** an ActKG engineering relation connects two nodes but no ACT REQUIRED edge exists
- **THEN** the planner SHALL not add that relation as a prerequisite
- **AND** it SHALL preserve the relation only as optional explanation/context

### Requirement: Planner gates active path nodes by learner readiness
Every formal path node MUST have `pathEligible=true`, a valid current Authority/Projection identity, and at least one accessible projected resource. A node with no resource or an unresolved required binding MUST be excluded or returned as an explicit blocked diagnostic.

#### Scenario: Node has no accessible resource
- **WHEN** an unmet prerequisite node has no accessible lesson, handout, step, card, textbook, or other projected resource
- **THEN** the planner SHALL not emit an executable node
- **AND** it SHALL report the exact readiness blocker

#### Scenario: Optional card is missing
- **WHEN** a node has an accessible handout/step but no optional card
- **THEN** the node SHALL remain path-eligible
- **AND** the planner SHALL choose the other resource and annotate card absence

### Requirement: Generated paths use governed resource nodes
Path nodes MUST reference registered ResourceNodes from the active Teaching Projection and MUST preserve resource role, scope, source/provenance, and Projection identity. The planner MUST NOT synthesize a PathNode directly from a raw ActKG node, engineering edge, or unreviewed textbook locator.

#### Scenario: Projected lesson is selected
- **WHEN** a governed lesson or interactive resource is selected for a Canonical prerequisite
- **THEN** the path node SHALL carry its ResourceNode identity and launch target
- **AND** the path rationale SHALL identify the Canonical and prerequisite evidence

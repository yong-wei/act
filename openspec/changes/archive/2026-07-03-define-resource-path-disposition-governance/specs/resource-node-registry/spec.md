## ADDED Requirements

### Requirement: Every resource declares a path-planning disposition
The ResourceNode governance layer SHALL require every existing platform resource discovered by registry, runtime, authoring export, RAG projection, or teaching-resource data to declare a reviewed path-planning disposition.

#### Scenario: Resource is inventoried for path planning
- **WHEN** a resource is discovered by the completeness helper or ResourceNode registry builder
- **THEN** it SHALL be classified as `path-plannable`, `supporting-citation`, `embedded-asset`, `evidence-producing`, or `excluded-with-rationale`
- **AND** the classification SHALL include source family, stable source ref, review state, version or source hash where available, and reviewer-visible rationale.

#### Scenario: Resource is not an independent path node
- **WHEN** a resource is a textbook chunk, citation target, transcript segment, image description, slide fragment, lesson module, or other sub-resource without its own launch target and evidence contract
- **THEN** it SHALL NOT become a PathNode directly
- **AND** it SHALL be linked to a parent PlanningUnit, supporting citation, embedded asset record, or exclusion rationale.

#### Scenario: Resource is promoted to path-plannable
- **WHEN** a resource disposition is promoted to `path-plannable`
- **THEN** it SHALL have human-reviewed knowledge mapping, capability or quality mapping where applicable, LearningGoal fit, route target, path profile, evidence behavior, privacy policy, readiness metadata, and citation or source authority metadata
- **AND** provisional automated suggestions SHALL NOT satisfy this promotion.

### Requirement: Resource disposition gaps are auditable
The data-completeness helper SHALL report resource path-planning disposition gaps without mutating source records.

#### Scenario: Disposition is missing
- **WHEN** an inventoried resource has no reviewed path-planning disposition
- **THEN** the helper SHALL report a stable finding with source family, resource ref, missing disposition code, and follow-up bucket.

#### Scenario: Resource is intentionally excluded
- **WHEN** a resource is marked `excluded-with-rationale`
- **THEN** the helper SHALL require a reviewer-visible rationale and source/version reference
- **AND** the planner SHALL not treat that resource as an unexplained coverage gap.

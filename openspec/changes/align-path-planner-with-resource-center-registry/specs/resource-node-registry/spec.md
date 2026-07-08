## ADDED Requirements

### Requirement: ResourceNode registry exposes a planner-consumable projection
The ResourceNode governance layer SHALL provide a planner-consumable projection that matches the resource center inventory boundary.

#### Scenario: Planner projection is built
- **WHEN** the planner requests governed resource candidates
- **THEN** the projection SHALL include all audited path-eligible ResourceNodes and reviewed non-path dispositions from the resource center inventory
- **AND** the projection SHALL identify source family, source ref, registry version, projection version, review state, path disposition, and eligibility blockers.

#### Scenario: Projection excludes raw content
- **WHEN** the planner consumes the ResourceNode projection
- **THEN** it SHALL receive metadata, graph bindings, path profile, evidence policy, citation refs, privacy policy, and readiness data
- **AND** it SHALL NOT receive raw textbook content, raw media bytes, hidden assessment internals, or private learner evidence.

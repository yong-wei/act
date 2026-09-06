## ADDED Requirements

### Requirement: Projection core nodes come from the prerequisite publication
The Teaching Projection authoring MUST source its core-node set from the prerequisite publication `core-nodes.json` bound to the same Authority release identity as the projection. The builder MUST NOT accept a hard-coded or empty core-node set for a non-empty course active-domain scope.

#### Scenario: Core nodes feed the projection
- **WHEN** a projection is built for a non-empty active-domain scope
- **THEN** its core-node set SHALL equal the path-eligible core set of the prerequisite publication matching the projection Authority release

#### Scenario: Empty core-node set is supplied
- **WHEN** authoring supplies an empty or hard-coded core-node set while the course active-domain scope is non-empty
- **THEN** the projection build SHALL fail closed
- **AND** the prior published projection SHALL remain selected

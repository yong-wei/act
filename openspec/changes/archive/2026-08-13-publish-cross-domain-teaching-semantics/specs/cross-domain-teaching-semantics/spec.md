## ADDED Requirements

### Requirement: Cross-domain teaching relations are direct and reviewed
The system SHALL publish only evidence-backed direct REQUIRED or RECOMMENDED ACT_TEACHING relations between reviewed core nodes in different registered domains. Domain proximity, boundary portals and engineering relations SHALL NOT constitute teaching evidence.

#### Scenario: Direct domain boundary is accepted
- **WHEN** reviewers confirm that one domain concept is a direct learning prerequisite for another-domain concept
- **THEN** the cross-domain fragment SHALL preserve exact endpoints, direction, strength and evidence
- **AND** the relation SHALL appear in each relevant domain shard without duplication

### Requirement: Composed prerequisite graph remains globally valid
Before publishing the cross-domain fragment, the system MUST validate endpoint closure, deterministic edge identity, duplicate conflicts and acyclicity of all REQUIRED edges across the complete composed Teaching Projection.

#### Scenario: Cross-domain edge closes a required cycle
- **WHEN** a candidate edge creates a directed REQUIRED cycle after composition
- **THEN** the candidate projection SHALL fail closed
- **AND** the prior valid projection and all published domain fragments SHALL remain unchanged

#### Scenario: Coverage remains incomplete
- **WHEN** the global graph is valid but some domain boundaries have no reviewed direct relation
- **THEN** the projection MAY publish with partial coverage
- **AND** missing coverage SHALL not be replaced by transitive or engineering edges

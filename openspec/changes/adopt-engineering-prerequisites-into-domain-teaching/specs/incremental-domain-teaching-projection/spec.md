## MODIFIED Requirements

### Requirement: Teaching coverage is independent from Authority readiness
The system SHALL represent domain teaching coverage as `available`, `partial`, `empty` or `unavailable` independently from Engineering Authority readiness. Authority objects outside the domain-default overview MAY remain uncovered without failing Authority activation. The default DomainConcept overview teaching-prerequisite graph SHALL NOT be published as `empty` or `partial` when any overview concept is isolated; that overview coverage gate is defined by `domain-teaching-order-coverage` and SHALL fail closed. An unresolved teaching service SHALL still be distinguished from empty published coverage and SHALL NOT fabricate a teaching relation or alter the Authority binding.

#### Scenario: Domain has partial teaching coverage
- **WHEN** reviewed teaching relations exist but Authority objects outside the domain-default overview remain uncovered
- **THEN** the composed artifact SHALL retain the overview teaching-order graph and MAY record partial coverage for non-overview objects
- **AND** the Authority binding SHALL remain valid for the independent activation contract

#### Scenario: Overview teaching order is incomplete
- **WHEN** a registered domain's default DomainConcept overview is not weakly connected under published teaching prerequisites
- **THEN** the candidate Teaching Projection SHALL fail closed
- **AND** the prior published projection SHALL remain unchanged

#### Scenario: Teaching service is unavailable
- **WHEN** the optional teaching layer cannot be resolved
- **THEN** the artifact contract SHALL distinguish unavailability from empty published coverage
- **AND** it SHALL not fabricate a teaching relation or alter the Authority binding

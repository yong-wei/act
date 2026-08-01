# canonical-knowledge-kaq-binding Specification

## Purpose
TBD - created by archiving change bind-kaq-to-canonical-knowledge. Update Purpose after archive.
## Requirements
### Requirement: KAQ knowledge roles bind explicitly to Canonical Objects
Each migrated KAQ knowledge role MUST reference one or more Canonical Objects through a versioned binding that records role, aggregate ReleaseSet/Release, evidence, and review status.

#### Scenario: Reviewed KAQ binding is used
- **WHEN** a KAQ consumer resolves an active knowledge role
- **THEN** it SHALL traverse only reviewed bindings within the current aggregate CourseCoverage and pinned aggregate ReleaseSet

#### Scenario: Same-name legacy node exists
- **WHEN** a Legacy node has the same label as a Canonical Object
- **THEN** the system MUST NOT create a binding without independent semantic review

### Requirement: KAQ retains capability and quality governance
The KAQ graph SHALL continue to own knowledge-to-capability, capability-to-quality, learning-goal, and runtime pedagogical relations.

#### Scenario: Canonical binding is activated
- **WHEN** a KAQ knowledge role obtains a Canonical binding
- **THEN** its capability, quality, objective, and runtime teaching relations SHALL remain KAQ-owned

### Requirement: Teaching Projection becomes knowledge-relation authority
When ActKG formally releases a Teaching Projection, it MUST become the authority for knowledge-to-knowledge contains, prerequisite, association, and other released teaching predicates.

#### Scenario: No Teaching Projection is released
- **WHEN** the Engineering Release lacks formal teaching relations
- **THEN** the system SHALL retain reviewed KAQ teaching relations and MUST NOT infer replacements from engineering predicates

#### Scenario: Teaching relation conflicts with KAQ
- **WHEN** a released ActKG teaching relation conflicts with an active KAQ knowledge-to-knowledge relation
- **THEN** the system SHALL require one-time review and retire the corresponding KAQ relation after ActKG acceptance

### Requirement: Conflicting teaching relations cannot remain jointly active
Path and recommendation consumers MUST NOT consume two conflicting knowledge-to-knowledge teaching relations from ActKG and KAQ.

#### Scenario: Conflict is unresolved
- **WHEN** one-time review has not completed
- **THEN** the affected relation SHALL remain unavailable to formal planning rather than being unioned

### Requirement: Historical learning facts are outside KAQ rebinding
KAQ Canonical bindings MUST apply to active consumers and MUST NOT rewrite historical facts or derived learner states.

#### Scenario: Binding migration completes
- **WHEN** active KAQ roles are rebound to Canonical Objects
- **THEN** historical facts SHALL retain their Legacy knowledge revision and no Canonical sidecar SHALL be created

### Requirement: Canonical KAQ bindings remain shadow before cutover
The KAQ authority selector MUST keep formal KAQ consumers on Legacy knowledge identity until the final production cutover.

#### Scenario: Reviewed Canonical bindings exist before cutover
- **WHEN** KAQ roles have complete reviewed Canonical bindings but Legacy remains active
- **THEN** formal diagnosis, recommendation, and planning consumers SHALL continue using Legacy KAQ knowledge identity while Canonical bindings remain migration-review data

#### Scenario: Final selector activates
- **WHEN** the final downtime transaction activates Canonical KAQ together with all formal consumers
- **THEN** active KAQ roles SHALL resolve only through reviewed Canonical bindings and supported Teaching Projection relations


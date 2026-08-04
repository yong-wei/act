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
ActKG MUST remain the authority for engineering entities and engineering relations. A formally released ACT Teaching Projection, rather than ActKG engineering data or the historical aggregate CourseCoverage, MUST become authoritative only for the ACT-owned teaching relations it explicitly contains. Until such a projection is released, existing reviewed ACT/KAQ teaching relations remain the scoped fallback.

#### Scenario: No Teaching Projection is released
- **WHEN** the Engineering Release is valid but no ACT Teaching Projection is published
- **THEN** the system SHALL not infer teaching relations from engineering predicates or CourseCoverage
- **AND** scoped reviewed ACT/KAQ teaching relations MAY remain available under their existing authority

#### Scenario: Teaching relation conflicts with KAQ
- **WHEN** a released ACT Teaching Projection relation conflicts with an active KAQ knowledge-to-knowledge relation
- **THEN** the system SHALL require one-time review and retire the corresponding KAQ relation after ACT acceptance of the projection edge
- **AND** ActKG engineering relations SHALL remain unchanged by that teaching conflict

#### Scenario: Teaching Projection is released
- **WHEN** a versioned ACT Teaching Projection is published with an explicit consumer scope
- **THEN** only its contained teaching relations SHALL supersede the corresponding scoped fallback
- **AND** engineering relations SHALL remain ActKG-owned and unchanged

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
KAQ and teaching consumers SHALL retain their existing Legacy or pinned combination until their own ACT Teaching Projection, resource binding, and consumer readiness gates pass. Engineering Authority activation alone SHALL NOT switch KAQ selectors.

#### Scenario: Reviewed Canonical bindings exist before cutover
- **WHEN** KAQ roles have complete reviewed Canonical bindings but the consumer's Teaching Projection or readiness gate has not passed
- **THEN** formal diagnosis, recommendation, and planning consumers SHALL continue using Legacy or an explicit pinned prior combination while Canonical bindings remain migration-review data

#### Scenario: Final selector activates
- **WHEN** the consumer's own Teaching Projection, resource binding, and readiness gates pass in the later activation transaction
- **THEN** active KAQ roles SHALL resolve only through reviewed Canonical bindings and the explicit teaching relations owned by that projection

#### Scenario: Engineering Authority activates first
- **WHEN** ActKG Authority is `ACTIVE` but a KAQ/teaching projection is absent or unresolved
- **THEN** KAQ consumers SHALL remain on their prior valid combination
- **AND** no global selector SHALL be advanced


## MODIFIED Requirements

### Requirement: Teaching Projection becomes knowledge-relation authority
ActKG MUST remain the authority for engineering entities and engineering relations. A formally released ACT Teaching Projection, rather than ActKG engineering data or the historical aggregate CourseCoverage, MUST become authoritative only for the ACT-owned teaching relations it explicitly contains. Until such a projection is released, existing reviewed ACT/KAQ teaching relations remain the scoped fallback.

#### Scenario: No Teaching Projection is released
- **WHEN** the Engineering Release is valid but no ACT Teaching Projection is published
- **THEN** the system SHALL not infer teaching relations from engineering predicates or CourseCoverage
- **AND** scoped reviewed ACT/KAQ teaching relations MAY remain available under their existing authority

#### Scenario: Teaching Projection is released
- **WHEN** a versioned ACT Teaching Projection is published with an explicit consumer scope
- **THEN** only its contained teaching relations SHALL supersede the corresponding scoped fallback
- **AND** engineering relations SHALL remain ActKG-owned and unchanged

### Requirement: Canonical KAQ bindings remain shadow before cutover
KAQ and teaching consumers SHALL retain their existing Legacy or pinned combination until their own ACT Teaching Projection, resource binding, and consumer readiness gates pass. Engineering Authority activation alone SHALL NOT switch KAQ selectors.

#### Scenario: Engineering Authority activates first
- **WHEN** ActKG Authority is `ACTIVE` but a KAQ/teaching projection is absent or unresolved
- **THEN** KAQ consumers SHALL remain on their prior valid combination
- **AND** no global selector SHALL be advanced

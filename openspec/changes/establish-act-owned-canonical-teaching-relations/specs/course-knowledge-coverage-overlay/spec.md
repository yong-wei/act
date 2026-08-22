## MODIFIED Requirements

### Requirement: Coverage baseline is exhaustive
The system MUST NOT require every member of an ActKG Release to receive an ACT course role or exclusion. For object-to-object teaching-relation governance, the denominator SHALL be every real Canonical Object in the target course's exact sealed active-domain selection, independent of resource bindings; each member SHALL have containment, prerequisite, and pedagogical-association dispositions. Root domain navigation projections and ActKG objects outside that course selection SHALL remain outside the denominator. Resource-binding completeness SHALL remain a separate capability and MUST NOT determine relation-scope membership.

#### Scenario: Candidate has no governed coverage baseline
- **WHEN** the selected ActKG Release and course active-domain selection have no ACT teaching baseline
- **THEN** Engineering Authority MAY still activate after integrity validation
- **AND** the ACT relation projection SHALL report `NOT_PROJECTED` rather than treating missing governance as complete or as an Engineering block

#### Scenario: Baseline has an unaccounted active-domain object
- **WHEN** a Canonical Object in the sealed active-domain selection lacks any of its three family dispositions
- **THEN** the relation governance receipt SHALL remain incomplete and containment gaps SHALL block a new formal relation projection
- **AND** unrelated upstream Engineering objects outside the course scope SHALL not create the failure

#### Scenario: Unprojected upstream object exists
- **WHEN** a valid ActKG Release contains an object not selected by the target course active-domain scope
- **THEN** the object SHALL remain outside that course's teaching-relation denominator
- **AND** it SHALL not enter an ACT relation review denominator or teaching activation gate

#### Scenario: Active-domain member has no resource binding
- **WHEN** an in-scope Canonical Object has no learning resource
- **THEN** it SHALL still receive containment, prerequisite, and association dispositions
- **AND** resource absence SHALL not be interpreted as an upstream object exclusion or a no-relation decision

#### Scenario: Root domain navigation is present
- **WHEN** a domain catalog emits a circular root entry for presentation navigation
- **THEN** that entry SHALL not count as a Canonical Object or require a family disposition
- **AND** its child membership SHALL not be invented as a relation edge

### Requirement: Coverage updates follow ReleaseSet Delta
After Authority changes, ACT SHALL recompute impact against the exact target course active-domain member set and current relation decisions. Unaffected members and decisions MAY be carried forward deterministically only when their Canonical semantic identity, scope membership, evidence, and governing inputs remain compatible. A new object SHALL create three-family governance work only when it enters the target active-domain scope; unrelated new Engineering objects SHALL not create course work.

#### Scenario: Compatible Release adds an active-domain object
- **WHEN** an accepted Delta adds a Canonical Object to the target course active-domain member set
- **THEN** ACT SHALL create containment, prerequisite, and association dispositions for that object
- **AND** the new relation projection SHALL fail if its containment disposition is not closed

#### Scenario: Object is removed
- **WHEN** an accepted Delta removes a covered object from the target active-domain scope
- **THEN** its relation decisions and dependent projection eligibility SHALL become stale without deleting historical records
- **AND** Engineering Authority validation SHALL depend only on integrity of the remaining Release

#### Scenario: Bundle packaging alone changes
- **WHEN** the Delta is a semantic-empty packaging revision and scope/evidence identities remain compatible
- **THEN** the system SHALL record deterministic no-op revalidation without regenerating relation semantics

#### Scenario: Delta adds unrelated engineering objects
- **WHEN** a ReleaseSet Delta adds objects that remain outside the target course active-domain selection
- **THEN** ACT SHALL emit zero teaching-relation disposition or review items for those objects
- **AND** the Engineering Release MAY activate after integrity validation

### Requirement: Coverage does not create teaching relations
Course roles, active-domain membership, and exclusions MUST NOT create containment, prerequisite, sequence, association, or any other Teaching Projection relation. They establish governed course scope only; every published teaching relation still requires the ACT relation qualification and item admission contract.

#### Scenario: Object is a necessary prerequisite
- **WHEN** an object receives the course role `necessary_prerequisite`
- **THEN** that role SHALL permit course consumption and membership processing but SHALL NOT create a graph prerequisite edge

#### Scenario: Object enters active-domain scope
- **WHEN** a Canonical Object is selected into the target active-domain member set
- **THEN** the system SHALL create three family-disposition work items without inventing any edge
- **AND** only admitted ACT relation results SHALL become published topology

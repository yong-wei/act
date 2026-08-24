# course-knowledge-coverage-overlay Specification

## Purpose
TBD - created by archiving change add-course-knowledge-coverage-overlay. Update Purpose after archive.
## Requirements
### Requirement: Complete Release import and course activation are separate
The system MUST keep every integrity-valid ActKG Release available for engineering Authority browsing and engineering consumers, while ACT teaching consumers use only the explicitly scoped, version-matched Teaching Projection records. A missing, empty, or unresolved ACT overlay MUST NOT make the engineering Release invalid.

#### Scenario: Object is outside course coverage
- **WHEN** an imported Canonical Object has an explicit excluded disposition or no valid current ACT teaching binding
- **THEN** it SHALL remain browsable under Engineering Authority and SHALL NOT enter recommendation, KAQ, path, assessment, or new-fact computation until bound by an ACT Teaching Projection

#### Scenario: Release name implies broad scope
- **WHEN** a Release or component name suggests control theory, engineering, or a course domain
- **THEN** the system SHALL still require object-level ACT teaching decisions for teaching consumers and SHALL NOT infer complete course coverage from the name
- **AND** the engineering Release MAY still activate Authority after integrity validation

#### Scenario: Valid Release has no teaching bindings
- **WHEN** an integrity-valid ActKG Release is admitted and the ACT Teaching Projection is empty or absent
- **THEN** engineering Authority MAY become `ACTIVE`
- **AND** ACT teaching consumers SHALL report `NOT_PROJECTED` or remain on an explicitly pinned prior projection

#### Scenario: Teaching binding is unresolved
- **WHEN** one course/resource binding is `REVIEW_REQUIRED` or missing
- **THEN** only that affected teaching consumer SHALL be blocked
- **AND** engineering browsing and Engineering RAG SHALL remain available from Authority

### Requirement: Coverage uses three explicit roles
Each active coverage entry MUST identify exactly one of `formal_objective`, `necessary_prerequisite`, or `explicit_extension`, together with the course, Canonical ID, and pinned Release.

#### Scenario: Valid entry is imported
- **WHEN** a reviewed authoring entry names a valid course, object, Release, and allowed role
- **THEN** the runtime projection SHALL admit that object for the declared course role

#### Scenario: Unsupported role is supplied
- **WHEN** an entry uses an unregistered role or an object outside the pinned Release
- **THEN** the Overlay import SHALL fail without changing the active projection

### Requirement: Course coverage has a Git-governed authoring source
The coverage implementation MUST use structured repository authoring data reviewed through Git and deterministically imported into the database, with every record bound to one candidate ReleaseSet, ReleaseSet Delta Receipt and clean ACT capture revision.

#### Scenario: Authoring data changes
- **WHEN** a reviewed Git revision changes the coverage source
- **THEN** deployment SHALL validate and transactionally replace the corresponding runtime projection for the exact ReleaseSet and Delta identity

#### Scenario: Runtime user attempts direct edit
- **WHEN** a teacher or administrator attempts to change coverage through the running application
- **THEN** the system SHALL provide no direct mutation endpoint in this change

#### Scenario: Inputs come from mixed captures
- **WHEN** coverage source, ReleaseSet, Delta Receipt, resource index, Git revision, or database watermark do not belong to one coherent capture
- **THEN** import SHALL fail without changing the prior shadow projection

### Requirement: Evidence and model output cannot self-activate coverage
Resource occurrence, textbook mention, vector similarity, and model suggestions MUST remain candidates until a reviewed authoring change admits them.

#### Scenario: Model proposes an extension
- **WHEN** a model identifies a Canonical Object as relevant to the course
- **THEN** the system SHALL record or export a candidate without activating it

### Requirement: Overlay versions are auditable
Every runtime coverage projection MUST identify its authoring revision, import version, candidate ReleaseSet, ReleaseSet Delta Receipt, source hashes, capture revision and baseline-or-incremental mode.

#### Scenario: Consumer queries coverage
- **WHEN** a formal or shadow consumer receives covered objects
- **THEN** the response or diagnostic SHALL expose the corresponding Overlay, ReleaseSet and Delta identities for audit

### Requirement: Coverage baseline is exhaustive
The system MUST NOT require every member of an ActKG Release to receive an ACT course role or exclusion. For object-to-object teaching-relation governance, the denominator SHALL be every real Canonical Object in the target course's exact sealed active-domain selection, independent of resource bindings; each member SHALL have containment, prerequisite, and pedagogical-association dispositions. Root domain navigation projections and ActKG objects outside that course selection SHALL remain outside the denominator. Resource-binding completeness SHALL remain a separate capability and MUST NOT determine relation-scope membership.

#### Scenario: Candidate has no governed coverage baseline
- **WHEN** the selected ActKG Release and course active-domain selection have no ACT teaching baseline
- **THEN** Engineering Authority MAY still activate after integrity validation
- **AND** the ACT relation projection SHALL report `NOT_PROJECTED` rather than treating missing governance as complete or as an Engineering block

#### Scenario: Baseline has an unaccounted object
- **WHEN** a Canonical Object in the sealed active-domain selection lacks any of its three family dispositions
- **THEN** the relation governance receipt SHALL remain incomplete and containment gaps SHALL block a new formal relation projection
- **AND** unrelated upstream Engineering objects outside the course scope SHALL not create the failure

#### Scenario: Unprojected upstream object exists
- **WHEN** a valid ActKG Release contains an object not selected by the target course active-domain scope
- **THEN** the object SHALL remain outside that course's teaching-relation denominator
- **AND** it SHALL not enter an ACT relation review denominator or teaching activation gate

#### Scenario: Required ACT resource has no binding
- **WHEN** an in-scope resource is marked `REQUIRED` but has no valid Canonical binding
- **THEN** the affected resource-binding Teaching Projection SHALL fail closed
- **AND** the ActKG Authority and object-to-object relation governance SHALL remain independently evaluable

#### Scenario: Active-domain member has no resource
- **WHEN** an in-scope Canonical Object has no learning resource
- **THEN** it SHALL still receive containment, prerequisite, and association dispositions
- **AND** resource absence SHALL not be interpreted as an upstream object exclusion or a no-relation decision

#### Scenario: Root domain navigation is present
- **WHEN** a domain catalog emits a circular root entry for presentation navigation
- **THEN** that entry SHALL not count as a Canonical Object or require a family disposition
- **AND** its child membership SHALL not be invented as a relation edge

### Requirement: Coverage updates follow ReleaseSet Delta
After Authority changes, ACT SHALL recompute impact against the exact target course active-domain member set and current relation decisions. Unaffected members and decisions MAY be carried forward deterministically only when their Canonical semantic identity, scope membership, evidence, and governing inputs remain compatible. A new object SHALL create three-family governance work only when it enters the target active-domain scope; unrelated new Engineering objects SHALL not create course work.

#### Scenario: Compatible Release adds objects
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


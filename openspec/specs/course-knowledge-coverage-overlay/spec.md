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
The system MUST NOT require every member of an ActKG Release to receive an ACT course role or exclusion. The denominator SHALL be the current ACT resource/core-node scope selected for Teaching Projection, and each in-scope resource SHALL have `BOUND`, `EXPLICIT_NONE`, or `REVIEW_REQUIRED` status with a deterministic reason. Exhaustive Release-member coverage is no longer an Engineering Authority gate.

#### Scenario: Candidate has no governed coverage baseline
- **WHEN** the selected ActKG Release has no ACT teaching baseline
- **THEN** Engineering Authority MAY still activate after integrity validation
- **AND** the ACT Teaching Projection SHALL report `NOT_PROJECTED` rather than treating missing exhaustive coverage as an Authority block

#### Scenario: Baseline has an unaccounted object
- **WHEN** an in-scope ACT resource/core node selected for Teaching Projection has neither a valid binding nor an evidenced exclusion/`EXPLICIT_NONE`
- **THEN** Teaching Projection publication for that scope SHALL fail closed
- **AND** unprojected upstream engineering objects outside the ACT scope SHALL not create the failure

#### Scenario: Unprojected upstream object exists
- **WHEN** a valid ActKG Release contains an object not used by any ACT course or resource
- **THEN** the object SHALL remain `NOT_PROJECTED`
- **AND** it SHALL not enter an ACT coverage review denominator or Authority gate

#### Scenario: Required ACT resource has no binding
- **WHEN** an in-scope resource is marked `REQUIRED` but has no valid Canonical binding
- **THEN** the affected Teaching Projection SHALL fail closed
- **AND** the ActKG Authority SHALL remain independently activatable

### Requirement: Coverage updates follow ReleaseSet Delta
After Authority changes, ACT SHALL compute impact only for changed Canonical identities and their existing local bindings. Unaffected teaching records may be carried forward deterministically; new unbound engineering objects do not create review work.

#### Scenario: Compatible Release adds objects
- **WHEN** an accepted Delta adds Canonical Objects with no ACT binding
- **THEN** ACT SHALL emit zero teaching-review items for those unbound objects
- **AND** only objects that already participate in ACT teaching scope or bindings SHALL require impact review

#### Scenario: Object is removed
- **WHEN** an accepted Delta removes a covered object that had an ACT teaching binding
- **THEN** its teaching binding and dependent shadow eligibility SHALL become stale without deleting the historical decision
- **AND** Engineering Authority validation SHALL depend only on integrity of the remaining Release

#### Scenario: Bundle packaging alone changes
- **WHEN** the Delta is a semantic-empty packaging revision
- **THEN** the system SHALL record that no coverage recomputation was required

#### Scenario: Delta adds unrelated engineering objects
- **WHEN** a ReleaseSet Delta adds objects with no ACT binding
- **THEN** ACT SHALL emit zero teaching-review items for those objects
- **AND** the engineering Release may activate after integrity validation

### Requirement: Coverage does not create teaching relations
Course roles and exclusions MUST NOT create prerequisite, containment, sequence, association, or other Teaching Projection relations.

#### Scenario: Object is a necessary prerequisite
- **WHEN** an object receives the course role `necessary_prerequisite`
- **THEN** that role SHALL permit course consumption but SHALL NOT create a graph prerequisite edge


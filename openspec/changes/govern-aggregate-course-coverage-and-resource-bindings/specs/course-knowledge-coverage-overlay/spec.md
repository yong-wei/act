## MODIFIED Requirements

### Requirement: Complete Release import and course activation are separate
The system MUST keep every object in the aggregate ReleaseSet available for authoritative browsing while allowing teaching consumers to use only objects admitted by the version-matched course coverage Overlay.

#### Scenario: Aggregate object is outside course coverage
- **WHEN** an imported Canonical Object has an explicit excluded disposition or no active coverage entry for the course
- **THEN** it SHALL remain browsable and SHALL NOT enter recommendation, KAQ, path, assessment, or new-fact computation

#### Scenario: Aggregate release name suggests broad scope
- **WHEN** the Release is named `control-theory-engineering-v0.2`
- **THEN** the system SHALL still use object-level coverage decisions and SHALL NOT infer complete course or teaching-semantic coverage from the release name

### Requirement: Course coverage has a Git-governed authoring source
The aggregate coverage implementation MUST use structured repository authoring data reviewed through Git and deterministically imported into the database, with every record bound to the aggregate ReleaseSet and one clean ACT capture revision.

#### Scenario: Authoring data changes
- **WHEN** a reviewed Git revision changes the aggregate coverage source
- **THEN** deployment SHALL validate and transactionally replace the corresponding runtime projection for that exact ReleaseSet

#### Scenario: Inputs come from mixed revisions
- **WHEN** coverage source, release lock, or importer evidence comes from different ACT revisions or a dirty worktree
- **THEN** the import SHALL fail without changing the active shadow projection

#### Scenario: Runtime user attempts direct edit
- **WHEN** a teacher or administrator attempts to change coverage through the running application
- **THEN** the system SHALL provide no direct mutation endpoint in this change

### Requirement: Overlay versions are auditable
Every runtime coverage projection MUST identify its authoring revision, import version, aggregate source ReleaseSet, source release hash, and projection digest.

#### Scenario: Consumer queries coverage
- **WHEN** a candidate consumer receives covered objects
- **THEN** the response or diagnostic SHALL make the corresponding Overlay and aggregate ReleaseSet versions available for audit

## ADDED Requirements

### Requirement: Newly published system-modeling objects receive exhaustive disposition
Every Canonical Object newly introduced through the system-modeling component MUST receive exactly one reviewed disposition: `formal_objective`, `necessary_prerequisite`, `explicit_extension`, or `excluded_with_rationale`.

#### Scenario: Object is admitted to the course
- **WHEN** item-by-item semantic review establishes one allowed course role
- **THEN** the authoring record SHALL contain that role, aggregate object identity, object revision, rationale, source evidence, and review version

#### Scenario: Object is not admitted
- **WHEN** an object is outside current course scope or lacks sufficient teaching evidence
- **THEN** the authoring record SHALL retain `excluded_with_rationale` and the object SHALL remain browsable

#### Scenario: Object has no disposition
- **WHEN** any newly introduced system-modeling object is absent, duplicated, or carries an unsupported disposition
- **THEN** aggregate coverage import and readiness SHALL fail

### Requirement: Coverage does not fabricate Teaching Projection relations
Course coverage roles MUST NOT be interpreted as prerequisite, containment, sequence, or association relations.

#### Scenario: Covered object has no teaching relation
- **WHEN** an admitted object lacks an upstream formal Teaching Projection relation
- **THEN** KAQ or later consumers MAY use its course role but SHALL NOT infer a missing graph relation from that role

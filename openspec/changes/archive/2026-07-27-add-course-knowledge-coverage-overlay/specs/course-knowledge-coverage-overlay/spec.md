## ADDED Requirements

### Requirement: Complete Release import and course activation are separate
The system MUST keep every object in an accepted ReleaseSet available for authoritative browsing while allowing teaching consumers to use only objects admitted by the course coverage Overlay.

#### Scenario: Object is outside course coverage
- **WHEN** an imported Canonical Object has no active coverage entry for the course
- **THEN** it SHALL remain browsable and SHALL NOT enter recommendation, KAQ, path, assessment, or new-fact computation

### Requirement: Coverage uses three explicit roles
Each active coverage entry MUST identify exactly one of `formal_objective`, `necessary_prerequisite`, or `explicit_extension`, together with the course, Canonical ID, and pinned Release.

#### Scenario: Valid entry is imported
- **WHEN** a reviewed authoring entry names a valid course, object, Release, and allowed role
- **THEN** the runtime projection SHALL admit that object for the declared course role

#### Scenario: Unsupported role is supplied
- **WHEN** an entry uses an unregistered role or an object outside the pinned Release
- **THEN** the Overlay import SHALL fail without changing the active projection

### Requirement: Course coverage has a Git-governed authoring source
The first coverage implementation MUST use structured repository authoring data reviewed through Git and deterministically imported into the database.

#### Scenario: Authoring data changes
- **WHEN** a reviewed Git revision changes the coverage source
- **THEN** deployment SHALL validate and transactionally replace the corresponding runtime projection

#### Scenario: Runtime user attempts direct edit
- **WHEN** a teacher or administrator attempts to change coverage through the running application
- **THEN** the system SHALL provide no direct mutation endpoint in this change

### Requirement: Evidence and model output cannot self-activate coverage
Resource occurrence, textbook mention, vector similarity, and model suggestions MUST remain candidates until a reviewed authoring change admits them.

#### Scenario: Model proposes an extension
- **WHEN** a model identifies a Canonical Object as relevant to the course
- **THEN** the system SHALL record or export a candidate without activating it

### Requirement: Overlay versions are auditable
Every runtime coverage projection MUST identify its authoring revision, import version, and source ReleaseSet.

#### Scenario: Consumer queries coverage
- **WHEN** a formal consumer receives covered objects
- **THEN** the response or diagnostic SHALL make the corresponding Overlay and ReleaseSet versions available for audit

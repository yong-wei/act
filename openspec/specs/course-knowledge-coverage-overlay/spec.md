# course-knowledge-coverage-overlay Specification

## Purpose
TBD - created by archiving change add-course-knowledge-coverage-overlay. Update Purpose after archive.
## Requirements
### Requirement: Complete Release import and course activation are separate
The system MUST keep every object in an accepted candidate ReleaseSet available for authoritative browsing while allowing teaching consumers to use only objects with a valid, version-matched course coverage disposition.

#### Scenario: Object is outside course coverage
- **WHEN** an imported Canonical Object has an explicit excluded disposition or no valid current coverage entry
- **THEN** it SHALL remain browsable and SHALL NOT enter recommendation, KAQ, path, assessment, or new-fact computation

#### Scenario: Release name implies broad scope
- **WHEN** a Release or component name suggests control theory, engineering, or a course domain
- **THEN** the system SHALL still require object-level coverage decisions and SHALL NOT infer complete course coverage from the name

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
When no governed coverage baseline exists for the accepted candidate ReleaseSet, the system MUST assign every Release member exactly one active role or an `excluded_with_rationale` disposition with source evidence and review identity.

#### Scenario: Candidate has no governed coverage baseline
- **WHEN** the selected candidate has no valid governed CourseCoverage baseline, regardless of whether its ReleaseSet Delta is an empty-installation baseline or a change from #1125
- **THEN** the coverage manifest SHALL account for every current Canonical Object exactly once

#### Scenario: Baseline has an unaccounted object
- **WHEN** a current Release member has neither an allowed course role nor an evidenced exclusion
- **THEN** baseline publication SHALL fail

### Requirement: Coverage updates follow ReleaseSet Delta
After a baseline exists, the system MUST review additions and supported payload changes, invalidate removals and identity-affecting changes, and preserve unchanged current dispositions through auditable revalidation rather than full semantic recomputation.

#### Scenario: Compatible Release adds objects
- **WHEN** an accepted Delta adds Canonical Objects
- **THEN** only the new objects and directly invalidated dispositions SHALL require new course review

#### Scenario: Object is removed
- **WHEN** an accepted Delta removes a covered object
- **THEN** its coverage entry and dependent shadow eligibility SHALL become stale without deleting the historical decision

#### Scenario: Bundle packaging alone changes
- **WHEN** the Delta is a semantic-empty packaging revision
- **THEN** the system SHALL record that no coverage recomputation was required

### Requirement: Coverage does not create teaching relations
Course roles and exclusions MUST NOT create prerequisite, containment, sequence, association, or other Teaching Projection relations.

#### Scenario: Object is a necessary prerequisite
- **WHEN** an object receives the course role `necessary_prerequisite`
- **THEN** that role SHALL permit course consumption but SHALL NOT create a graph prerequisite edge


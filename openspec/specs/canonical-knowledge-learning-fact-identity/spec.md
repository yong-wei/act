# canonical-knowledge-learning-fact-identity Specification

## Purpose
Defines fixed-identity contracts for knowledge-scoped LearningFacts: complete Canonical/Projection/resource identity on new writes, teaching admission gates, no dual-write, and Legacy-bound historical facts resolved through immutable crosswalk at read time.
## Requirements
### Requirement: New facts carry complete Canonical knowledge identity
After a Projection-bound path or resource activity is active, every new knowledge-scoped LearningFact MUST persist `canonicalId`, `authorityReleaseId`, `projectionId`, and `resourceId` alongside existing evidence/source identity. The producer MUST reject candidate, missing, or cross-scope combinations. After production authority cutover, every knowledge-scoped learning fact MUST also atomically record Canonical Object ID, active aggregate ReleaseSet/Release identity, projection or knowledge revision, and its governed source identity.

#### Scenario: Projection-bound fact is accepted
- **WHEN** a learner completes an eligible projected resource under the current Authority/Projection combination
- **THEN** the fact SHALL persist all four identities and the resource role/scope

#### Scenario: Canonical fact is accepted
- **WHEN** an authorized producer submits a fact for the active Canonical authority
- **THEN** the fact SHALL persist all required knowledge and source identities in one transaction

#### Scenario: Resource identity is incomplete
- **WHEN** a writer lacks canonical, Authority, Projection, or resource identity
- **THEN** the write SHALL fail closed without a partial fact

#### Scenario: Knowledge version is incomplete
- **WHEN** Canonical ID, aggregate ReleaseSet/Release, projection, or revision is missing or inconsistent
- **THEN** the producer SHALL fail closed without creating a partial fact

### Requirement: Candidate knowledge cannot receive formal facts
Candidate ReleaseSets MUST be excluded from every formal learning-fact writer.

#### Scenario: Candidate-aware page triggers an event
- **WHEN** a user views or asks about a candidate Canonical Object
- **THEN** no formal knowledge-scoped learning fact SHALL be written from that candidate context

### Requirement: Canonical facts obey teaching admission gates
A new Canonical fact MUST target a node admitted by the active ACT Teaching Projection and an accessible resource/path scope, and MUST also be admitted by the active aggregate CourseCoverage and supported by a current aggregate resource or KAQ producer contract. ActKG visibility alone, a RECOMMENDED edge, or an unprojected node MUST NOT authorize a fact.

#### Scenario: Object is browsable but outside coverage
- **WHEN** a producer targets an imported object that is not admitted for the course
- **THEN** the write SHALL be rejected even though the object is visible in the authoritative graph

#### Scenario: Node is browsable but not projected
- **WHEN** a learner interacts with an engineering-only node lacking a current teaching resource
- **THEN** the formal knowledge fact write SHALL be rejected
- **AND** engineering browsing telemetry SHALL remain separate

### Requirement: Historical facts remain Legacy-bound
Historical LearningFacts MUST remain unchanged and MUST be interpreted through their stored Legacy revision/identity and an immutable old-ID-to-Canonical crosswalk at read time. This change MUST NOT perform full backfill or create a Canonical sidecar fact. The migration MUST preserve historical facts, portraits, diagnoses, risks, growth records, class aggregations, and completed paths under their original Legacy revisions.

#### Scenario: Historical fact is read after cutover
- **WHEN** a reader loads a fact without Projection identity from a prior revision
- **THEN** it SHALL resolve the display Canonical/resource context through crosswalk metadata
- **AND** the original fact bytes and authority revision SHALL remain unchanged

#### Scenario: Canonical authority activates
- **WHEN** the platform begins writing Canonical facts
- **THEN** existing historical records SHALL remain unchanged and SHALL NOT receive a Canonical sidecar

#### Scenario: Historical portrait is read
- **WHEN** a user views a pre-cutover result
- **THEN** the system SHALL interpret it through its Legacy snapshot or revision rather than the current Canonical graph

### Requirement: New facts are not dual-written
The system MUST NOT write both Legacy and Canonical knowledge identities for a post-cutover fact.

#### Scenario: Writer selector is switched
- **WHEN** the cutover transaction activates the Canonical writer boundary
- **THEN** all governed producers SHALL use only the Canonical identity contract

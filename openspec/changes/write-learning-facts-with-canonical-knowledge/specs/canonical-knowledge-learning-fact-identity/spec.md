## ADDED Requirements

### Requirement: New facts carry complete Canonical knowledge identity
After production authority cutover, every knowledge-scoped learning fact MUST atomically record Canonical Object ID, ReleaseSet or Release identity, and knowledge revision together with its governed source identity.

#### Scenario: Canonical fact is accepted
- **WHEN** an authorized producer submits a fact for the active Canonical authority
- **THEN** the fact SHALL persist all required knowledge and source identities in one transaction

#### Scenario: Knowledge version is incomplete
- **WHEN** Canonical ID, Release, or revision is missing or inconsistent
- **THEN** the producer SHALL fail closed without creating a partial fact

### Requirement: Candidate knowledge cannot receive formal facts
Candidate ReleaseSets MUST be excluded from every formal learning-fact writer.

#### Scenario: Candidate-aware page triggers an event
- **WHEN** a user views or asks about a candidate Canonical Object
- **THEN** no formal knowledge-scoped learning fact SHALL be written from that candidate context

### Requirement: Canonical facts obey teaching admission gates
A Canonical fact MUST target an object admitted by CourseCoverage and supported by the active resource or KAQ producer contract.

#### Scenario: Object is browsable but outside coverage
- **WHEN** a producer targets an imported object that is not admitted for the course
- **THEN** the write SHALL be rejected even though the object is visible in the authoritative graph

### Requirement: Historical facts remain Legacy-bound
The migration MUST preserve historical facts, portraits, diagnoses, risks, growth records, class aggregations, and completed paths under their original Legacy revisions.

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

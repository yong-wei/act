## ADDED Requirements

### Requirement: Teacher owns class-scoped evidence adaptation
Teacher SHALL own the adapter that maps authorized current projections and report delivery records into class/student evidence views. The adapter SHALL derive teacher, class and student scope from server authorization and SHALL not reconstruct official facts from raw events or accept URL hints as authority.

#### Scenario: Teacher requests an authorized class
- **WHEN** an authenticated teacher requests insights or diagnosis evidence for a class they own
- **THEN** the Teacher owner SHALL read the qualified class/student projection and return coverage, freshness, provenance and permitted evidence fields
- **AND** it SHALL preserve independent-learner suppression and missing/stale status

#### Scenario: Teacher requests another class
- **WHEN** the requested class or student is outside the teacher's authorized membership scope
- **THEN** the adapter SHALL reject before reading evidence
- **AND** it SHALL not fall back to global, raw or client-supplied identifiers

### Requirement: Teacher adapter migration preserves report and privacy semantics
Moving Teacher evidence adapters SHALL preserve report revision, class-session provenance, role-minimum fields, small-sample suppression, raw access restrictions and historical report identity. It MUST NOT write official scores, LearningFacts or Personalization state as a side effect of a read.

#### Scenario: Small class has sensitive aggregate
- **WHEN** an authorized class has fewer than the independent-learner threshold
- **THEN** the Teacher owner SHALL suppress sensitive aggregate values while retaining truthful status and coverage
- **AND** it SHALL not replace missing values with zero or include another class

#### Scenario: Legacy report adapter remains in use
- **WHEN** a route, worker or report still imports the old data-governance business adapter
- **THEN** the migration SHALL keep that path until parity and zero-caller evidence exist
- **AND** it SHALL not add a forwarding facade that hides the unresolved dependency

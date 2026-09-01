## MODIFIED Requirements

### Requirement: Consumers use stable Learning Record read ports
Student, teacher, AI and Personalization consumers SHALL read governed current projections through stable role-appropriate ports. Normal page/runtime code MUST NOT scan or aggregate raw events, invoke backfill tools or retain a second evidence source as a result of simplification.

#### Scenario: Student route reads current evidence
- **WHEN** an authenticated student requests evidence
- **THEN** the route reads the student-safe port and receives revision, status and provenance metadata without raw event aggregation

#### Scenario: Projection is unavailable
- **WHEN** the current projection is unavailable or stale
- **THEN** the port returns the explicit status/limitation and the consumer does not silently rebuild from raw events or historical tools

### Requirement: Truthful status, provenance and small-sample handling
Consumer ports SHALL preserve projection status, coverage, freshness, confidence, watermark, revision and permitted provenance. Known zero SHALL remain distinct from missing, partial, stale or unavailable. Teacher aggregate suppression SHALL count independent learners, not rows or events, after any projection simplification.

#### Scenario: Small teacher cohort
- **WHEN** an aggregate has fewer than the independent-learner threshold
- **THEN** sensitive values are suppressed while status and coverage remain truthful

#### Scenario: Stale evidence is shown
- **WHEN** a newer LearningFact exists without a qualified replacement projection
- **THEN** the consumer marks the result stale/limited and does not label it current or fresh

## ADDED Requirements

### Requirement: Session readiness metrics are distinct
The system SHALL expose distinct governance readiness metrics for interactive
classroom sessions.

#### Scenario: Report renders readiness metrics
- **WHEN** a class session report or data-quality script evaluates an
  interactive session
- **THEN** it SHALL distinguish participants, logged users, durable submission
  coverage, required evidence coverage, scoreable evidence coverage, scoring
  coverage, snapshot coverage, post-class update-window coverage, and
  feature-cache freshness.

### Requirement: Snapshot coverage is not post-class regeneration
The system SHALL evaluate snapshot coverage separately from post-class refresh
timing.

#### Scenario: Latest snapshot covers latest fact before session end
- **WHEN** a student's latest snapshot covers the latest relevant LearningFact
  but was generated before the session end timestamp
- **THEN** snapshot coverage SHALL be satisfied for that student
- **AND** post-class update-window coverage MAY be partial or missing as a
  separate metric.

### Requirement: Readiness names match data sources
The system SHALL name readiness fields and reason codes according to their
source and calculation policy.

#### Scenario: Feature cache is stale
- **WHEN** feature-cache freshness is stale but snapshots are current
- **THEN** the report SHALL use a feature-cache freshness reason
- **AND** it SHALL NOT report the state as missing snapshots.

#### Scenario: Scoreable evidence is absent
- **WHEN** durable submissions exist but no supported reference answers or
  scoring inputs exist
- **THEN** scoreable evidence coverage SHALL be low or unsupported
- **AND** durable submission coverage SHALL remain visible separately.

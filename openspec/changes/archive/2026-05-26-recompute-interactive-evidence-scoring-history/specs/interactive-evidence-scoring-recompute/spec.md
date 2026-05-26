## ADDED Requirements

### Requirement: Historical scoring recomputation is controlled
The system SHALL provide a controlled path to recompute historical manifest
objective scoring context from durable evidence.

#### Scenario: Dry-run reports score deltas
- **WHEN** the recomputation command runs in dry-run mode
- **THEN** it SHALL report affected lessons, sessions, steps, users, question
  kinds, old scores, new scores, correctness changes, and trace-link repairs
- **AND** it SHALL NOT write database changes.

#### Scenario: Apply updates derived context only
- **WHEN** the recomputation command runs in apply mode
- **THEN** it SHALL update derived score, correctness, scoring detail, scoring
  version, and repairable trace fields
- **AND** it SHALL NOT overwrite raw submitted answers, raw event payloads,
  attempt identity, or submitted timestamps.

### Requirement: Recompute is idempotent and traceable
The system SHALL make historical scoring recomputation repeatable and
auditable.

#### Scenario: Apply runs twice
- **WHEN** apply mode is run twice over the same unchanged evidence set
- **THEN** the second run SHALL produce no additional scoring changes
- **AND** the audit output SHALL make the no-op result visible.

#### Scenario: sourceLogId can be repaired
- **WHEN** a LearningFact has sourceEventId and a matching InteractionLog exists
- **THEN** the recomputation path SHALL repair or propose repair of sourceLogId
- **AND** unrepairable rows SHALL be reported with a reason.

### Requirement: Recompute depends on shared scoring semantics
The system SHALL use the shared manifest objective scorer for historical
recomputation.

#### Scenario: Shared scorer is unavailable
- **WHEN** the shared scorer or required scoring version is unavailable
- **THEN** the recomputation command SHALL stop before writing
- **AND** it SHALL report the missing prerequisite.

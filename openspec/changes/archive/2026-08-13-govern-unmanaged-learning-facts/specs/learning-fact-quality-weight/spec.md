## MODIFIED Requirements

### Requirement: Profile contribution follows evidence quality
The system SHALL weight or suppress competency contribution according to complete, explicit evidence governance.

#### Scenario: Legacy submit does not advance profile score
- **WHEN** a lesson_submit fact is materialized from legacy or missing evidence
- **THEN** the fact remains traceable but does not contribute as profile-grade competency evidence

#### Scenario: Partial submit is downgraded
- **WHEN** a lesson_submit fact is materialized from partial evidence
- **THEN** the fact carries a reduced profile weight and the context records the policy reason

#### Scenario: Unmanaged fact is context-only
- **WHEN** a LearningFact lacks a finite `profileWeight`, boolean `skipProfileContribution`, or policy reason in its evidence governance
- **THEN** the system SHALL assign zero profile weight
- **AND** it SHALL not contribute to competency or portrait projections

#### Scenario: Materialized unknown source is auditable
- **WHEN** a materialized learning event has no source-specific profile policy
- **THEN** its LearningFact SHALL record an explicit context-only governance policy
- **AND** it SHALL retain the event as traceable context

### Requirement: Rich objective evidence remains profile-grade
The system SHALL preserve rich objective submission contribution when submitted answers and scoring context are available.

#### Scenario: Rich objective fact is weighted normally
- **WHEN** a manifest-submission-v2 objective payload contains score and question summaries
- **THEN** the materialized fact keeps profile-grade contribution and records rich evidence quality

#### Scenario: Approved direct producer declares its contribution
- **WHEN** teacher-reviewed document grading or official Arena evidence writes a LearningFact intended for profile use
- **THEN** the producer SHALL persist explicit profile weight, skip flag, and policy reason

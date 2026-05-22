# learning-fact-quality-weight Specification

## Purpose
Define how evidence quality controls LearningFact contribution to competency profiles while preserving traceability for low-quality or incomplete evidence.
## Requirements
### Requirement: Profile contribution follows evidence quality
The system SHALL weight or suppress competency contribution according to evidence quality.

#### Scenario: Legacy submit does not advance profile score
- **WHEN** a lesson_submit fact is materialized from legacy or missing evidence
- **THEN** the fact remains traceable but does not contribute as profile-grade competency evidence

#### Scenario: Partial submit is downgraded
- **WHEN** a lesson_submit fact is materialized from partial evidence
- **THEN** the fact carries a reduced profile weight and the context records the policy reason

### Requirement: Rich objective evidence remains profile-grade
The system SHALL preserve rich objective submission contribution when submitted answers and scoring context are available.

#### Scenario: Rich objective fact is weighted normally
- **WHEN** a manifest-submission-v2 objective payload contains score and question summaries
- **THEN** the materialized fact keeps profile-grade contribution and records rich evidence quality

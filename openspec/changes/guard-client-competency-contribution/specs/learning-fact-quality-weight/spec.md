## MODIFIED Requirements

### Requirement: Profile contribution follows evidence quality
The system SHALL evaluate evidence quality only after a LearningFact has received a non-serializable server-side competency-contribution authorization. A LearningFact without that authorization SHALL remain traceable but SHALL NOT contribute competency evidence to learner profiles.

#### Scenario: Legacy submit does not advance profile score
- **WHEN** a lesson_submit fact is materialized from legacy or missing evidence
- **THEN** the fact remains traceable but does not contribute as profile-grade competency evidence

#### Scenario: Partial submit is downgraded
- **WHEN** a server-authorized lesson_submit fact is materialized from partial evidence
- **THEN** the fact carries a reduced profile weight and the context records the policy reason

#### Scenario: Client contribution is rejected
- **WHEN** an event received through the interactive events HTTP API includes a numeric `competencyContribution`, derived metrics, or an action type with a static competency mapping
- **THEN** its LearningFact SHALL preserve the permitted behavioral and learning fields with an empty competency contribution
- **AND** it SHALL NOT produce Portrait v2 profile evidence

### Requirement: Rich objective evidence requires trusted service authorization
The system SHALL allow rich objective evidence to remain profile-grade only when the LearningFact is authorized by a server-side verified assessment or review path.

#### Scenario: Rich client objective fact remains traceable
- **WHEN** a manifest-submission-v2 objective payload received through the interactive events HTTP API contains a score and question summaries
- **THEN** the materialized fact SHALL retain its score, question-summary context, and rich evidence-quality record
- **AND** its competency contribution SHALL be empty

#### Scenario: Verified assessment fact is weighted normally
- **WHEN** a server-verified assessment event contains eligible scoring and governance evidence and receives server-side authorization
- **THEN** the materialized fact SHALL retain its competency contribution and rich evidence-quality record

## ADDED Requirements

### Requirement: Student profile consumes Arena summaries
The student profile API SHALL expose Arena summary fields derived from persisted official submissions and Arena LearningFact context.

#### Scenario: Student Arena summary
- **WHEN** a student has Arena official submissions
- **THEN** `/api/user/profile` MUST include best score, valid submission rate, recent challenges, weak metrics, method preference, and improvement count for Arena activity

#### Scenario: Student without Arena submissions
- **WHEN** a student has no Arena official submissions
- **THEN** `/api/user/profile` MUST return an empty Arena summary without failing the profile response

### Requirement: Teacher class insights consume Arena summaries
Teacher class insight APIs SHALL expose Arena summary fields derived from class-scoped persisted official submissions and Arena LearningFact context.

#### Scenario: Class Arena summary
- **WHEN** a teacher requests class insights for a class with Arena activity
- **THEN** the response MUST include task achievement rate, average score, hard-constraint failure distribution, weak metric distribution, method distribution, and non-submission counts where publication context is available

#### Scenario: Cross-class data protection
- **WHEN** Arena submissions from another class exist for the same task
- **THEN** a teacher class insight response MUST NOT include those submissions in the requested class summary

### Requirement: Arena evidence aggregation is backend-owned
Arena profile and class insight summaries SHALL be computed by backend analytics modules, not by front-end reconstruction.

#### Scenario: Backend summary source
- **WHEN** a profile or class insight endpoint returns Arena summary fields
- **THEN** the summary MUST be produced from backend queries and pure analytics functions
- **AND** the front end MUST NOT derive official validity, weak metrics, or method distribution from raw leaderboard markup

#### Scenario: LearningFact context fallback
- **WHEN** LearningFact Arena context exists for high-value Arena events
- **THEN** backend aggregation MAY use it as supporting evidence
- **AND** it MUST prefer authoritative ArenaSubmission rows for official score and validity when both sources are present

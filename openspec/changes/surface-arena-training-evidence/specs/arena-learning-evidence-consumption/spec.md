## MODIFIED Requirements

### Requirement: Student profile consumes Arena summaries
The student profile API SHALL expose official Arena summary fields derived from persisted official submissions and a separate training summary derived from governed Arena virtual simulation runs and Arena LearningFact context. Training summary fields SHALL not alter official best score, valid submission rate, ranking, or official capability claims.

#### Scenario: Student Arena summary
- **WHEN** a student has Arena official submissions or governed virtual training runs
- **THEN** `/api/user/profile` MUST include official best score, valid submission rate, recent challenges, weak metrics, method preference, and improvement count for official Arena activity
- **AND** it MUST include separate virtual-training count, recent training records, task attribution, quality summary, and preview provenance when training runs exist

#### Scenario: Student with training but no Arena submissions
- **WHEN** a student has governed Arena virtual training runs but no official submissions
- **THEN** `/api/user/profile` MUST return empty official Arena submission aggregates and the available training summary without failing the profile response

### Requirement: Arena evidence aggregation is backend-owned
Arena profile and class insight summaries SHALL be computed by backend analytics modules, not by front-end reconstruction. Backend aggregation SHALL preserve the distinction between official submissions and preview training evidence.

#### Scenario: Backend summary source
- **WHEN** a profile or class insight endpoint returns Arena summary fields
- **THEN** the summary MUST be produced from backend queries and pure analytics functions
- **AND** the front end MUST NOT derive official validity, weak metrics, method distribution, or preview provenance from raw leaderboard markup

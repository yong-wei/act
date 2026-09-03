# arena-learning-evidence-consumption Specification

## Purpose
Define how persisted Arena submissions and Arena learning-fact context are consumed by student profiles and teacher class insights without reconstructing official evaluation meaning in the front end.
## Requirements
### Requirement: Student profile consumes Arena summaries
The student profile API SHALL expose official Arena summary fields derived from persisted official submissions and a separate training summary derived from governed Arena virtual simulation runs and Arena LearningFact context. Training summary fields SHALL not alter official best score, valid submission rate, ranking, or official capability claims.

#### Scenario: Student Arena summary
- **WHEN** a student has Arena official submissions or governed virtual training runs
- **THEN** `/api/user/profile` MUST include official best score, valid submission rate, recent challenges, weak metrics, method preference, and improvement count for official Arena activity
- **AND** it MUST include separate virtual-training count, recent training records, task attribution, quality summary, and preview provenance when training runs exist

#### Scenario: Student with training but no Arena submissions
- **WHEN** a student has governed Arena virtual training runs but no official submissions
- **THEN** `/api/user/profile` MUST return empty official Arena submission aggregates and the available training summary without failing the profile response

#### Scenario: Student without Arena submissions
- **WHEN** a student has no Arena official submissions
- **THEN** `/api/user/profile` MUST return an empty official Arena summary without failing the profile response

### Requirement: Teacher class insights consume Arena summaries
Teacher class insight APIs SHALL expose Arena summary fields derived from class-scoped persisted official submissions and Arena LearningFact context.

#### Scenario: Class Arena summary
- **WHEN** a teacher requests class insights for a class with Arena activity
- **THEN** the response MUST include task achievement rate, average score, hard-constraint failure distribution, weak metric distribution, method distribution, and non-submission counts where publication context is available

#### Scenario: Cross-class data protection
- **WHEN** Arena submissions from another class exist for the same task
- **THEN** a teacher class insight response MUST NOT include those submissions in the requested class summary

### Requirement: Arena evidence aggregation is backend-owned
Arena profile and class insight summaries SHALL be computed by backend analytics modules, not by front-end reconstruction. Backend aggregation SHALL preserve the distinction between official submissions and preview training evidence.

#### Scenario: Backend summary source
- **WHEN** a profile or class insight endpoint returns Arena summary fields
- **THEN** the summary MUST be produced from backend queries and pure analytics functions
- **AND** the front end MUST NOT derive official validity, weak metrics, method distribution, or preview provenance from raw leaderboard markup

#### Scenario: LearningFact context fallback
- **WHEN** LearningFact Arena context exists for high-value Arena events
- **THEN** backend aggregation MAY use it as supporting evidence
- **AND** it MUST prefer authoritative ArenaSubmission rows for official score and validity when both sources are present

### Requirement: Arena summaries are consumed through the Arena owner port
Student profile and Teacher class insight consumers SHALL obtain official and preview Arena summaries from the Arena-owned server API or read port. Front ends and generic Learning Record code MUST NOT reconstruct official validity, weak metrics, method distribution or preview provenance from raw rows or markup.

#### Scenario: Profile reads mixed Arena evidence
- **WHEN** a student has official submissions and governed virtual training runs
- **THEN** the Arena owner port SHALL return separate official and preview/training summaries with source status and provenance
- **AND** training SHALL not alter official score, rank, valid rate or capability claims

#### Scenario: Class insight reads Arena evidence
- **WHEN** a teacher requests Arena evidence for an authorized class
- **THEN** the port SHALL aggregate only class-scoped persisted summaries
- **AND** it SHALL exclude other-class submissions and preserve independent learner counts

### Requirement: Arena evidence adapter removal preserves official authority
An old Arena evidence adapter SHALL be removed only after all profile, class, path and report callers use the Arena owner port and parity tests prove official/preview outputs equivalent.

#### Scenario: Legacy adapter has a remaining caller
- **WHEN** a production consumer still imports or invokes the old adapter
- **THEN** the deletion gate SHALL fail closed
- **AND** no second summary or Learning Record writer SHALL be introduced


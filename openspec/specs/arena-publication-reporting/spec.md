## ADDED Requirements

### Requirement: Teachers can view Arena publication reports
The system SHALL provide a teacher-facing report for each Arena publication that the teacher is allowed to manage.

#### Scenario: Teacher opens owned publication report
- **WHEN** a teacher opens `/teacher/arena/publications/{publicationId}`
- **THEN** the system MUST verify that the publication belongs to a class the teacher manages or that the actor is an admin
- **AND** it MUST render a report scoped to that publication

#### Scenario: Unauthorized report access
- **WHEN** a teacher attempts to open another teacher's class publication report
- **THEN** the system MUST deny access
- **AND** it MUST NOT reveal publication submissions or student identities from that class

### Requirement: Publication report aggregates official Arena submissions
The publication report SHALL aggregate only official submissions for the selected publication and class scope.

#### Scenario: Report statistics
- **WHEN** a publication has official submissions
- **THEN** the report MUST show participant count, submission count, valid submission rate, average score, median score, highest score, hard-constraint failure distribution, weak metric distribution, method distribution, personal-best rows, and excellent-solution summaries

#### Scenario: Empty publication
- **WHEN** a publication has no submissions
- **THEN** the report MUST show an empty state
- **AND** it MUST still show publication task, class, deadline, visibility, and leaderboard policy context

### Requirement: Deadline leaderboard hiding applies to reports
The report SHALL respect publication grading policy when showing peer leaderboard details before a deadline.

#### Scenario: Leaderboard hidden before deadline
- **WHEN** a publication has `hideFullLeaderboardBeforeDeadline` enabled and the deadline has not passed
- **THEN** the report MUST avoid exposing full peer ranking to students
- **AND** teacher report access MUST remain available to the authorized teacher

### Requirement: Teacher Arena page links to publication reports
The teacher Arena configuration surface SHALL provide a report entry for persisted publications.

#### Scenario: Published item report link
- **WHEN** `/teacher/arena` renders an existing publication row
- **THEN** the row MUST include a link to the publication report
- **AND** status actions such as pause, active, and archive MUST remain available

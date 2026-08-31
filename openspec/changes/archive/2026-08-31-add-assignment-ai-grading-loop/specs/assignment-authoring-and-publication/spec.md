## MODIFIED Requirements

### Requirement: Student payloads do not disclose protected grading material
Assignment delivery contracts SHALL separate student-visible question content from teacher-only reference answers, rubric internals, and publication controls. New assignment revisions SHALL use a teacher-confirmed result release policy: reference answers and scoring standards SHALL become visible only through the owning student's released assignment-result package. Frozen historical revisions using an existing time-based solution-release policy SHALL preserve their historical policy behavior.

#### Scenario: Student reads an active new assignment
- **WHEN** an authorized student requests a new assigned revision before the student's assignment result is released
- **THEN** the response SHALL include only student-visible instructions, questions, points, response rules, schedule, and submission state
- **AND** it SHALL NOT disclose reference answers, scoring standards, final scores, or teacher comments.

#### Scenario: Teacher publishes a new assignment with time-based answer release
- **WHEN** an authorized teacher attempts to publish a new revision using `AT_TIME` or another independent time-based solution-release policy
- **THEN** the server SHALL reject publication before the revision or audience becomes visible
- **AND** it SHALL require the teacher-confirmed result release policy.

#### Scenario: Student result is released
- **WHEN** the teacher releases a complete confirmed assignment result for the owning student
- **THEN** the student response SHALL reveal the result package's final score, teacher-confirmed comments, reference answers, and scoring standards together.

#### Scenario: Grading finishes without a releasable result
- **WHEN** question grading finishes but the assignment result is incomplete, unconfirmed, or unreleased
- **THEN** reference answers, scoring standards, final scores, and teacher comments SHALL remain private.

#### Scenario: Teacher releases a solution result package
- **WHEN** an authorized teacher releases a confirmed result for a specific student assignment submission
- **THEN** only that student's explicitly released result package, derived from immutable question-level approval snapshots, SHALL become visible
- **AND** reference answers and scoring standards SHALL be visible only as part of the same package.

#### Scenario: Historical revision has a time-based policy
- **WHEN** a student reads a revision frozen before this requirement that has a valid historical `AT_TIME` solution-release policy
- **THEN** the system SHALL preserve that policy's existing visibility behavior
- **AND** it SHALL not rewrite the revision or require a new result release record.

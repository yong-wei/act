## ADDED Requirements

### Requirement: Arena submissions must explain ranking and validity
The system SHALL show whether an Arena submission is official, active, expired, late, zero-score, effective for ranking, and whether best/latest/all attempts are displayed.

#### Scenario: Multiple submissions are explained
- **WHEN** a student submits multiple times to one Arena publication
- **THEN** the student and teacher report explain which attempt counts and how other attempts are represented

#### Scenario: Zero or late submission is not labeled excellent
- **WHEN** a submission is zero-score or late
- **THEN** teacher reports do not classify it as an excellent solution without an explicit exception reason

### Requirement: Arena and classroom actions must write back evidence or explain non-writeback
The system SHALL create student evidence or show an explicit non-writeback state for audited Arena and classroom submission flows.

#### Scenario: Arena official submission writes evidence
- **WHEN** a student completes an official Arena submission
- **THEN** the student's evidence or growth view shows the Arena source, or the page explains why evidence writeback is unavailable

#### Scenario: Classroom submission writes evidence once
- **WHEN** a student submits a classroom response
- **THEN** evidence writeback is keyed to session, step, card, and submission identity to avoid unexplained duplicates

### Requirement: Classroom runtime states must be recoverable
The system SHALL provide visible status for classroom code errors, release actions, student submission, teacher summary, session ending, and post-class review routes.

#### Scenario: Invalid classroom code is explained
- **WHEN** a user enters an invalid classroom code
- **THEN** the join page shows the code error and recovery path with accessible status

### Requirement: Arena/classroom remediation must update audit findings
The system SHALL mark Arena and classroom findings remediated only after new route, submission, and evidence screenshots or API checks are captured.

#### Scenario: Arena/classroom finding is closed
- **WHEN** a result explanation or evidence writeback finding is fixed
- **THEN** the audit report links the original finding and new evidence artifact

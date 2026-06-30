## ADDED Requirements

### Requirement: Arena attempt policy shall be visible at submission report and evidence surfaces
Arena student entries, submission result pages, leaderboards, and teacher reports SHALL display official attempt policy, effective attempt selection, late/zero/invalid status, and evidence writeback state.

#### Scenario: Student reviews attempt policy
- **WHEN** a student submits or reviews an Arena task
- **THEN** the result SHALL explain whether the attempt is official, effective, late, zero-score, invalid, or evidence-only.

#### Scenario: Teacher reviews official report source
- **WHEN** a teacher opens a publication report
- **THEN** leaderboard, honors, and report rows SHALL identify their authoritative submission source and shall not promote invalid or late-only attempts as excellent official solutions.

### Requirement: Arena evidence回流 shall be governed
Arena completion SHALL either materialize governed student evidence or show a student-visible limitation.

#### Scenario: Official attempt creates evidence state
- **WHEN** an official Arena attempt is accepted
- **THEN** the system SHALL expose the resulting evidence reference or a pending writeback state.

#### Scenario: Arena evidence writeback is limited
- **WHEN** evidence cannot be written back
- **THEN** the student and teacher views SHALL show the limitation and recovery or retry path.


### Requirement: Arena mobile actions shall remain reachable
Arena student submission and teacher publication report mobile states SHALL keep official submission, report delivery, and evidence review actions reachable.

#### Scenario: Student uses Arena on mobile
- **WHEN** a student opens an Arena official submission or result page at audited mobile widths
- **THEN** the official submission, result review, and evidence status actions SHALL remain reachable without being hidden by global floating controls.

#### Scenario: Teacher reviews Arena report on mobile
- **WHEN** a teacher opens a publication report at audited mobile widths
- **THEN** export, send, lock, copy commentary, or the supported primary report action SHALL remain reachable and associated with the report state.

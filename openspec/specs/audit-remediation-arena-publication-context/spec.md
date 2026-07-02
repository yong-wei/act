# audit-remediation-arena-publication-context Specification

## Purpose
TBD - created by archiving change audit-remediation-arena-publication-context. Update Purpose after archive.
## Requirements
### Requirement: Arena publications shall expose product context and lifecycle state
Arena publication lists, reports, and student entries SHALL distinguish active, expired, report-ready, late-only, and unavailable states and SHALL avoid primary display of internal ids.

#### Scenario: Expired publication
- **WHEN** a publication is expired
- **THEN** teacher and student views SHALL visibly distinguish it from active publications
- **AND** available actions SHALL reflect report/review status rather than active challenge status.

#### Scenario: Student challenge entry
- **WHEN** a student opens a publication challenge
- **THEN** the page SHALL show task title, class or assignment scope, deadline, teacher or source context, and leaderboard source boundaries.

### Requirement: Arena report delivery shall preserve attempt policy and add delivery actions
Teacher publication reports SHALL retain effective/late/zero/invalid attempt policy while adding delivery actions and product naming.

#### Scenario: Teacher report
- **WHEN** a teacher opens an Arena publication report
- **THEN** the report SHALL show product task naming and ownership context
- **AND** export, send/publish, lock/finalize, or copy commentary states SHALL be visible where supported.
- **AND** official report rows, honors, and leaderboard entries SHALL use server-side `ArenaSubmission` records as the authoritative source of score, submission time, hard-constraint pass, late status, and attempt validity.
- **AND** `LearningFact` Arena context SHALL be treated only as auxiliary evidence and SHALL NOT by itself create official ranking, honor, or report rows.

#### Scenario: Mobile publication actions
- **WHEN** the publication report or challenge drawer is viewed on mobile
- **THEN** primary publication actions SHALL remain reachable without being hidden by global floating controls
- **AND** active/expired and leaderboard-source explanations SHALL remain visible or reachable.

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


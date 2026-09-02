# teacher-review-grading-workspace-simplification Specification

## Purpose

Define a behavior-preserving simplification of teacher Assignment review and
grading workspaces after Assignment orchestration is consolidated.

## ADDED Requirements

### Requirement: Simplification covers real review complexity

The implementation SHALL baseline queue, review workspace, grade workspace, and
grading console callers, state transitions, async side effects, error paths,
and historical guards.  Each accepted transformation SHALL remove identified
duplication or control-flow complexity and name direct regression evidence.
Pure file splitting, renaming, or styling SHALL not qualify.

#### Scenario: A review action is simplified

- **WHEN** queue/open, criterion, annotation, save, approval, return, release,
  or projection code is changed
- **THEN** the before/after ledger SHALL identify the original path,
  transformation, unchanged behavior, and test
- **AND** action ordering and authority boundaries SHALL remain explicit.

#### Scenario: A forwarding facade is proposed

- **WHEN** a helper only forwards to a second grading state machine or legacy
  owner
- **THEN** it SHALL be rejected
- **AND** the workspace SHALL continue to use the Assignment public API.

### Requirement: Review lineage and teacher authorization remain enforced

The simplified workspaces SHALL preserve assignment, published revision,
question, submission, current-attempt, grading-run, review, and teacher
authorization lineage.  Server-derived author, active-class, or explicit grant
checks SHALL remain authoritative.

#### Scenario: A teacher opens a review without access

- **WHEN** the teacher lacks author, active-class, or explicit review-grant
  authorization
- **THEN** the workspace SHALL show the existing denial/limited state
- **AND** it SHALL not disclose student, score, answer, or review metadata.

#### Scenario: A current attempt is stale

- **WHEN** the review is no longer bound to the student's current attempt
- **THEN** the existing stale/current-attempt behavior SHALL remain visible
- **AND** the workspace SHALL not approve or total the stale attempt silently.

### Requirement: Teacher approval remains the score authority

The simplified workspace SHALL retain criterion completeness, score bounds,
teacher-approved values, immutable approval snapshots, CAS/version fences, and
idempotent approval.  AI criterion values, confidence, comments, and
`draftTotalScore` SHALL remain advisory and SHALL not set a final question or
assignment total.

#### Scenario: Machine and teacher totals conflict

- **WHEN** AI grading output differs from the teacher's approved criterion sum
- **THEN** the existing approval snapshot and released score SHALL use only
  teacher-approved criteria
- **AND** the machine value SHALL remain labeled provenance/advisory data.

#### Scenario: Approval is retried

- **WHEN** the same review version and idempotency key are approved again
- **THEN** the existing snapshot/outbox result SHALL be reused
- **AND** no duplicate snapshot, release, or outbox command SHALL be created.

### Requirement: Completeness and partial feedback remain distinct

The workspace SHALL continue to withhold a final assignment total when any
required current attempt is missing, returned, processing, stale, or
unapproved.  Approved question feedback MAY be released independently, but
the UI SHALL label it partial and SHALL not present it as a final grade.

#### Scenario: One question is approved first

- **WHEN** one question's feedback is released while another required question
  remains under review
- **THEN** the workspace SHALL show question-scoped partial feedback
- **AND** it SHALL not expose an assignment final total.

#### Scenario: A required question is incomplete

- **WHEN** the completeness evaluator returns a blocker
- **THEN** the workspace SHALL show the blocker and retain review state
- **AND** no simplified render branch SHALL bypass the evaluator.

### Requirement: Evidence and Learning Record boundaries remain separate

The teacher workspaces SHALL use Assignment commands and the existing approved-
snapshot governance handoff.  They SHALL not write LearningFact, scan raw
Learning Record events, or expose internal outbox/teacher data to students.

#### Scenario: Evidence writeback is blocked

- **WHEN** evidence mapping, privacy, or Learning Record eligibility is
  incomplete after approval
- **THEN** the workspace SHALL preserve approved review/release state and show
  the existing limitation
- **AND** it SHALL not change the score or bypass governance.

#### Scenario: A student-safe projection is produced

- **WHEN** approved feedback is later projected to the owning student
- **THEN** only the existing released, role-safe fields SHALL be available
- **AND** teacher diagnostics and raw evidence payloads SHALL remain excluded.

### Requirement: Review UI states and accessibility remain complete

The simplification SHALL retain loading, empty, filtered-empty, stale,
conflict, processing, blocked, saved, approved, returned, partial, released,
and recoverable-error states with existing keyboard order, focus restoration,
error association, and responsive behavior.

#### Scenario: A save conflicts

- **WHEN** a teacher saves with a stale review version
- **THEN** the conflict SHALL be surfaced with the existing reload/retry path
- **AND** the workspace SHALL not silently overwrite another teacher's work.

#### Scenario: A teacher uses keyboard navigation

- **WHEN** the teacher moves through criteria, annotations, blockers, and
  approval/release controls without a pointer
- **THEN** accessible names, focus order, and recovery actions SHALL remain
  usable at supported widths.

### Requirement: Before/after metrics prove net simplification

The change SHALL record before and after lines, components/functions,
branches/state transitions or equivalent complexity, duplicate request/render
paths, imports, and behavior/privacy/accessibility test results.  Accepted,
rejected, and deferred transformations SHALL be listed and bound to one source
revision.

#### Scenario: Teacher workspace simplification is reviewed

- **WHEN** completion is requested
- **THEN** focused queue/review/grading, Assignment API, approval, completeness,
  evidence, privacy, and accessibility tests SHALL pass
- **AND** the record SHALL demonstrate reduced reasoning complexity beyond file
  movement.

# assignment-orchestration-governance-boundary Specification

## Purpose
TBD - created by archiving change move-assignment-orchestration-out-of-data-governance. Update Purpose after archive.
## Requirements
### Requirement: Assignment owns assignment command orchestration

Concrete coordination for assignment review, grading, approval, return,
feedback release, resubmission, and related document-grading commands SHALL
live under the existing Assignment application owner and SHALL be reached via
the C15 public API.  `src/lib/data-governance/assignment-grading-orchestration.ts`
SHALL not remain the command authority.

#### Scenario: A teacher approves a review

- **WHEN** a route or worker processes an assignment review approval
- **THEN** Assignment SHALL resolve lineage, authorization, criteria,
  idempotency, and the existing transaction
- **AND** the caller SHALL not invoke Data Governance orchestration directly.

#### Scenario: A worker retries a grading command

- **WHEN** the same command is delivered again after a worker interruption
- **THEN** the Assignment owner SHALL reuse the existing command/snapshot/
  outbox identity
- **AND** it SHALL preserve the existing deterministic retry result.

### Requirement: Data Governance receives only an approved-snapshot handoff

Assignment SHALL hand governed processing an immutable approved-snapshot
context through an explicit port.  The context SHALL retain assignment,
revision, question, submission, current-attempt, criterion, teacher-approval,
provenance, and idempotency identities while excluding raw answer payloads and
route authority.

#### Scenario: Approved evidence is handed off

- **WHEN** an approved question is eligible for governed evidence processing
- **THEN** Data Governance SHALL receive the approved snapshot reference and
  permitted normalized context through the port
- **AND** it SHALL revalidate mapping, privacy, authorization, and Learning
  Record eligibility before writing.

#### Scenario: The handoff is incomplete

- **WHEN** revision, attempt, approval, mapping, or privacy context is missing
  or mismatched
- **THEN** Data Governance SHALL block the writeback with an explicit
  limitation
- **AND** Assignment SHALL not bypass the boundary or fabricate fields.

### Requirement: Existing Assignment and Assessment identities remain canonical

The move SHALL reuse AssignmentRevision, question/content snapshots,
submissions, answer attempts, TeacherAssignmentReview, GradingRun,
TeacherAssignmentApprovalSnapshot, outbox/derivative/release, and audit
records.  Assessment remains the owner of attempt semantics and its immutable
selection/scoring contract.

#### Scenario: A current attempt changes after a review opens

- **WHEN** an answer receives a newer permitted attempt while a review is
  working
- **THEN** Assignment SHALL retain the original review lineage and apply the
  existing stale/current-attempt rules
- **AND** it SHALL not copy or mutate Assessment's attempt authority.

#### Scenario: A teacher-approved total conflicts with AI output

- **WHEN** machine criterion values or `draftTotalScore` differ from teacher
  criteria
- **THEN** the existing approved snapshot and final-total rules SHALL remain
  authoritative
- **AND** machine values SHALL remain advisory provenance.

### Requirement: Learning Record writes remain separately authorized

Assignment orchestration SHALL not write LearningFact, current projections, or
raw Learning Record events.  Governed consumers SHALL use the existing
Learning Record authorization, privacy, idempotency, revision, and projection
contracts after receiving the approved-snapshot handoff.

#### Scenario: A route attempts direct evidence writeback

- **WHEN** an Assignment route or UI calls a LearningFact/projection writer
- **THEN** the import or runtime boundary SHALL reject the path
- **AND** no fact, projection, or raw event SHALL be written.

#### Scenario: Governance processing is delayed

- **WHEN** the approved snapshot is queued, retryable, or blocked
- **THEN** the snapshot, review, release, and outbox state SHALL remain
  recoverable
- **AND** Assignment SHALL report the limitation without changing score or
  approval authority.

### Requirement: The old orchestration authority is deleted at zero callers

After production, worker, script, document, test, and dynamic callers migrate,
the old Data Governance orchestration module and any forwarding facade SHALL be
removed.  The ledger SHALL distinguish retained governance policy/writer
modules from deleted command orchestration.

#### Scenario: The caller inventory is closed

- **WHEN** every required caller uses Assignment or the approved-snapshot port
- **THEN** the old command authority SHALL be absent from the qualified tree
- **AND** the ownership/deletion proof SHALL bind to one source revision.

#### Scenario: A direct governance caller remains

- **WHEN** an unclassified route, worker, script, or test still invokes old
  orchestration
- **THEN** qualification SHALL remain blocked
- **AND** governance policy modules SHALL not be deleted as a shortcut.


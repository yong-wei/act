## ADDED Requirements

### Requirement: Assignment owns the public review and feedback orchestration

Assignment-scoped review, approval, return, release, resubmission, queue, and
feedback operations SHALL enter through the Assignment public API established
by `introduce-assignment-lifecycle-public-api`.

#### Scenario: A teacher opens an assignment review

- **WHEN** an authorized teacher requests a queue item or review by assignment,
  submission, question, or grading-run identity
- **THEN** the Assignment public API SHALL resolve the complete lineage and
  return a role-safe review DTO without a route or feature querying Prisma

#### Scenario: A data-governance consumer receives an approved review

- **WHEN** governed evidence processing needs review context
- **THEN** it SHALL receive the immutable approved-snapshot context through an
  explicit port and SHALL remain the sole authority for LearningFact/evidence
  writeback

### Requirement: The existing teacher-review state machine remains canonical

The migration SHALL reuse `TeacherAssignmentReview`, `GradingRun`,
`TeacherAssignmentApprovalSnapshot`, `TeacherAssignmentReviewOutbox`,
derivative/release, resubmission, and audit records and SHALL NOT add a second
table, enum, state, worker contract, or grading state machine.

#### Scenario: An existing working review is edited

- **WHEN** a teacher saves criteria, annotations, or comments with the current
  review version
- **THEN** the API SHALL use the existing optimistic version fence and retain
  machine values, teacher values, diffs, lineage, and audit semantics

#### Scenario: An approval is retried

- **WHEN** the same review version and idempotency key are approved again
- **THEN** the API SHALL return the existing approval snapshot and SHALL NOT
  create a duplicate snapshot or outbox command

### Requirement: Teacher approval is the only score authority

The published question score SHALL be derived from all current teacher-approved
criterion values and persisted in the immutable approval snapshot.  AI
criterion values, confidence, comments, and `draftTotalScore` SHALL remain
advisory and SHALL NOT set a final question or assignment total.

#### Scenario: AI and teacher totals conflict

- **WHEN** `GradingRun.draftTotalScore` differs from the teacher-approved
  criterion sum
- **THEN** the approval snapshot and any released score SHALL use only the
  teacher-approved criterion sum and retain the AI value as provenance

#### Scenario: A direct total override is requested

- **WHEN** a caller submits an assignment or question total without complete
  criterion values
- **THEN** the API SHALL reject the mutation and SHALL NOT alter an approved
  snapshot or final total

### Requirement: Final assignment totals require current-attempt completeness

An assignment final total SHALL be exposed only when every required question
has an approved snapshot for its current submitted attempt or an explicit
audited exemption with a defined score effect.

#### Scenario: A required question is incomplete

- **WHEN** any required question is never submitted, returned awaiting
  resubmission, missing an attempt, processing, stale, or unapproved
- **THEN** the assignment SHALL remain in review and SHALL NOT expose a final
  total, even if other questions have approved snapshots

#### Scenario: All required questions are complete

- **WHEN** each required question resolves to its current attempt and an
  approved criterion snapshot, or a valid audited exemption
- **THEN** the API MAY persist and expose the derived assignment total from
  those snapshots and exemptions

### Requirement: Partial feedback is independent from final grading

Approved question feedback MAY be released independently through the existing
release/derivative outbox, but partial release SHALL NOT imply grading
completeness or publish an assignment total.

#### Scenario: One question is approved first

- **WHEN** a question approval and its feedback release succeed while another
  required question remains under review
- **THEN** the student SHALL see labeled question-scoped feedback and SHALL
  NOT see an assignment final total

#### Scenario: A derivative or release consumer is delayed

- **WHEN** feedback publication or derivative generation is pending, blocked,
  or retryable
- **THEN** the API SHALL preserve the approved snapshot and expose the
  limitation/state without changing the score authority or deleting history

### Requirement: Review commands preserve lineage, authorization, and privacy

Every review read and mutation SHALL validate assignment, revision, submission,
answer, attempt, question, grading-run, audience, and frozen-student lineage,
then apply current teacher authorization or frozen student ownership.

#### Scenario: A teacher has no current grant

- **WHEN** a teacher requests a historical submission without author, active
  class, or explicit unrevoked review-grant authorization
- **THEN** the API SHALL deny access without disclosing review, score, or
  student metadata

#### Scenario: A student requests teacher review data

- **WHEN** a student reads feedback before approved release or requests machine
  diagnostics, teacher guidance, or another student's snapshot
- **THEN** the API SHALL return a denial or redacted state and SHALL NOT expose
  those fields

### Requirement: Governed evidence writeback remains separately authorized

Assignment approval SHALL enqueue the existing governed writeback path with the
approved snapshot identity, but Assignment routes SHALL NOT write LearningFact
or bypass evidence policy, mapping, privacy, or idempotency gates.

#### Scenario: Evidence mapping is eligible

- **WHEN** a teacher-approved criterion has valid governed mapping, anchor,
  rubric, reviewer, and lifecycle evidence
- **THEN** the Data Governance consumer MAY create an idempotent evidence
  candidate with complete lineage and the Assignment release remains separate

#### Scenario: Evidence mapping is incomplete

- **WHEN** feedback release is authorized but evidence mapping or privacy
  policy is incomplete
- **THEN** feedback MAY remain visible according to release policy while
  LearningFact/evidence writeback remains blocked with an explicit limitation

### Requirement: Migration has no competing facade or hidden caller

The change SHALL move real Assignment orchestration into the public API and
shall close the review caller denominator; a module that only forwards to the
old `teacher-assignment-review.ts` entrypoint is not sufficient.

#### Scenario: Caller inventory is re-run

- **WHEN** route, feature, pipeline, worker, script, test, and data-governance
  callers are checked after migration
- **THEN** Assignment-facing production callers SHALL use the public API,
  explicit governed ports SHALL be the only evidence boundary, and remaining
  legacy callers SHALL be recorded for the retirement change

#### Scenario: Review rollback is invoked

- **WHEN** the new public entrypoint is disabled after a failed deployment
- **THEN** new mutations SHALL stop while existing working reviews, snapshots,
  releases, outbox records, submissions, attempts, derivatives, and audit
  lineage remain recoverable

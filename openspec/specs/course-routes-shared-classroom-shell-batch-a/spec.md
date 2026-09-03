# course-routes-shared-classroom-shell-batch-a Specification

## Purpose

Define the fixed first route batch migration to the existing shared Classroom
shell while preserving runtime identity, session access, live/evidence
separation, and published course behavior.

## Requirements

### Requirement: Batch A has a closed canonical route denominator

The migration SHALL cover exactly lesson ids `1-1`, `1-2`, `1-3`, `1-4`,
`1-5`, `2-1`, `2-2`, `2-3`, `2-4`, `3-1`, `3-2`, `3-3`, `3-4`, `3-5`,
`3-6`, `3-7`, `3-8`, and `3-9`, including each applicable entry, student,
teacher, waiting, and demo route.  Route aliases SHALL resolve to those
canonical identities and SHALL not expand the batch.

#### Scenario: A batch-A route is selected

- **WHEN** a route segment, preset key, lesson key, or supported evidence alias
  selects a batch-A lesson
- **THEN** the route SHALL resolve one canonical lesson identity and its
  qualified runtime bundle
- **AND** it SHALL not create a course-specific identity or session path.

#### Scenario: A route outside Batch A is requested

- **WHEN** a unit-4, unit-5, Cruise, or unrelated legacy route is requested
- **THEN** this change SHALL not migrate or reinterpret that route
- **AND** it SHALL remain in its separately governed denominator.

### Requirement: All Batch-A classroom variants use the existing shell

Batch-A entry, student, teacher, and waiting routes SHALL use the existing
Classroom shell and session application use cases.  They SHALL share the
existing authentication, class access, join, waiting, reconnect, progression,
and finalization semantics and SHALL not own a private session state machine.

#### Scenario: Teacher starts and waits for a class

- **WHEN** an authorized teacher starts a batch-A lesson and opens its waiting
  view
- **THEN** the route SHALL use the shared session create/read/waiting use cases
- **AND** class ownership and teacher launch authorization SHALL be evaluated
  by their existing owner.

#### Scenario: Student joins a batch-A session

- **WHEN** an authorized student joins or refreshes a batch-A session
- **THEN** the route SHALL use the same session id and access policy as the
  teacher route
- **AND** teacher-only state and controls SHALL not enter the student
  projection.

### Requirement: Batch-A routes remain bound to runtime identity and revision

Every batch-A content read SHALL use the C10 canonical CourseBundle runtime
surface and preserve the session's captured bundle revision, runtime source
identity, complete digest, resource hashes, and manifest hash.  Runtime routes
SHALL not read authoring content or infer identity from mutable plan titles.

#### Scenario: Runtime content changes after a session starts

- **WHEN** a later release or manifest is available after a batch-A session is
  created
- **THEN** the session route SHALL continue to read its captured revision/hash
- **AND** a drift or mismatch SHALL return the existing explicit failure state.

#### Scenario: Generated courseware is used

- **WHEN** a batch-A lesson is backed by generated courseware
- **THEN** its publication revision and manifest hash SHALL remain checked by
  the existing generated-courseware contract
- **AND** route migration SHALL not select an unbound draft or new hash.

### Requirement: Live state and submission evidence remain distinct

Batch-A response-producing steps SHALL use the existing durable submission and
evidence contract.  Draft progress, cursor, and presence MAY use live state;
live state SHALL not replace durable answer attempts, and teacher/report
consumers SHALL not reconstruct submissions from mutable state alone.

#### Scenario: A student submits and resubmits

- **WHEN** a student submits a response and later creates a permitted
  resubmission
- **THEN** each attempt SHALL retain its durable identity and evidence
- **AND** live progress updates SHALL not overwrite or erase either attempt.

#### Scenario: Preview is opened

- **WHEN** a teacher or guest opens the batch-A demo/preview route
- **THEN** it MAY render role-safe runtime content
- **AND** it SHALL create no student session state, submission, interaction log,
  or Learning Record write.

### Requirement: Private route authorities are removed after qualification

After all required Batch-A callers use the shared shell, the migration SHALL
delete superseded course-private route, session, and component authorities.  A
permanent redirect, forwarding facade, or second shell SHALL not satisfy the
deletion gate.

#### Scenario: Caller inventory is closed

- **WHEN** static, dynamic, test, and browser inventories find no required
  private authority caller
- **THEN** the old authority SHALL be deleted in the qualified revision
- **AND** the ledger SHALL identify its replacement and deletion evidence.

#### Scenario: A private caller remains

- **WHEN** a required route, feature, test, or browser entry still reaches the
  private authority
- **THEN** qualification SHALL remain blocked
- **AND** the implementation SHALL not claim Batch-A completion.

### Requirement: Batch-A qualification includes role and browser evidence

The migration SHALL compare characterization and post-migration behavior for
entry, join, waiting, progression, response submit/resubmit, refresh,
reconnect, finish, unauthorized access, optional resources, and preview.  The
qualification ledger SHALL bind tests and browser artifacts to one source
revision.

#### Scenario: Batch-A browser acceptance runs

- **WHEN** teacher and student journeys exercise representative ordinary,
  response-producing, and compute/visual lessons
- **THEN** route behavior, session identity, role projection, evidence, and
  runtime hashes SHALL match the characterization
- **AND** any unapproved behavior difference SHALL block deletion.


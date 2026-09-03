# assignment-lifecycle-public-api Specification

## Purpose
Own Assignment authoring, publication, and student delivery behind one public API in `src/lib/assignments`, with routes limited to authentication, mutation protection, parsing, and response mapping.
## Requirements
### Requirement: Assignment lifecycle has one public business owner

Assignment lifecycle behavior SHALL be owned by `src/lib/assignments` and the
existing Assignment Prisma aggregate.  Assignment-authoring and assignments
feature directories SHALL remain UI slices and SHALL NOT become business
owners.

#### Scenario: A new route needs assignment behavior

- **WHEN** a route or feature reads or mutates an assignment, revision,
  audience, question, submission, answer, attempt, or assignment asset
- **THEN** it SHALL call the Assignment public API and SHALL NOT query Prisma
  or import a private implementation path directly

#### Scenario: A caller is outside the Assignment domain

- **WHEN** a downstream domain needs assignment data
- **THEN** it SHALL consume a documented public DTO/use case or port and SHALL
  NOT create a second assignment repository, state machine, or persistence
  owner

### Requirement: The public API exposes typed lifecycle contracts

The Assignment public API SHALL expose stable, role-appropriate DTOs,
application use cases, domain errors, and minimal ports/adapters for teacher
authoring/publication, student delivery/submission, and historical reads.

#### Scenario: A teacher lists assignments

- **WHEN** an authorized teacher requests the assignment list
- **THEN** the public API SHALL return a teacher-safe assignment summary with
  stable assignment/revision identifiers and governed review counts

#### Scenario: A student reads an assignment

- **WHEN** an authorized student requests an assignment or answer projection
- **THEN** the public API SHALL return only the student-safe DTO for the
  authorized revision and SHALL omit reference answers, teacher guidance,
  provider metadata, and other students' data

### Requirement: Routes are delivery adapters

Assignment routes SHALL be limited to authentication, mutation protection,
bounded input parsing, one public use-case invocation, and response/error
mapping.

#### Scenario: A state-changing request reaches a route

- **WHEN** a teacher or student sends a non-GET assignment mutation
- **THEN** the route SHALL enforce Origin/CSRF and session checks, parse the
  bounded schema, invoke the public API, and return its safe result

#### Scenario: A route attempts direct persistence

- **WHEN** a route imports Prisma, selects Assignment fields ad hoc, or calls
  a private Assignment service helper
- **THEN** the architecture fitness test SHALL fail the change

### Requirement: Published revisions and submitted evidence remain immutable

The public API SHALL preserve stable Assignment identity, append-only
published revision and question/answer/attempt snapshots, audience bindings,
content hashes, and restrictive historical relations.

#### Scenario: A published revision is edited

- **WHEN** a caller submits changes for a published revision
- **THEN** the API SHALL reject the mutation or require a new draft revision,
  and the published revision, question snapshots, and existing submissions
  SHALL remain unchanged

#### Scenario: A submission is read after a revision changes

- **WHEN** the assignment later receives a new draft or published revision
- **THEN** the submission and each attempt SHALL continue to resolve against
  their original revision/question identity and content hash

### Requirement: Audience and frozen ownership checks protect students

Teacher and student access SHALL be authorized against the assignment author,
managed class, explicit review grant, current audience, or frozen historical
ownership as applicable; identity drift SHALL fail closed.

#### Scenario: A student accesses a current audience

- **WHEN** the student belongs to the active class bound to a published
  revision and the delivery window permits access
- **THEN** the API SHALL return that student's assignment projection and bind
  answer/asset mutations to that student and question

#### Scenario: A student forges another student's identity

- **WHEN** a request supplies another student, class, submission, answer,
  question, or asset identifier
- **THEN** the API SHALL reject the request without exposing the target's
  assignment or grading metadata

#### Scenario: Historical student ownership is valid

- **WHEN** current class membership no longer exists but a non-anonymized
  frozen historical ownership grants the student access
- **THEN** the API MAY return that student's permitted historical projection
  while keeping teacher review access separately authorized

### Requirement: Publication and submission mutations are compare-and-swap and idempotent

Publication and other retryable lifecycle mutations SHALL use the existing
version, digest, unique-operation, and idempotency contracts; a request SHALL
NOT silently save a different baseline.

#### Scenario: The same publication request is retried

- **WHEN** the same assignment, saved revision/version, digest, request hash,
  and idempotency key are submitted again
- **THEN** the API SHALL return the original immutable publication result
  without creating a second published revision or audience binding

#### Scenario: A stale publication is submitted

- **WHEN** the revision version or content digest no longer matches the
  saved baseline
- **THEN** the API SHALL return a conflict and SHALL NOT publish or mutate
  the revision

### Requirement: No parallel facade or authority is introduced

The migration SHALL prove a single dependency direction from route/UI to the
Assignment public API, then ports/adapters and existing persistence.  It SHALL
NOT leave a second facade that owns no behavior or create a new model, worker,
score/evidence authority, or QA artifact source.

#### Scenario: The caller denominator is closed

- **WHEN** characterization and migration verification complete
- **THEN** every production Assignment caller SHALL be recorded as migrated or
  an explicitly approved downstream handoff, and forbidden deep imports SHALL
  be zero

#### Scenario: A run-specific QA artifact is produced

- **WHEN** tests or QA capture assignment behavior
- **THEN** large outputs and private payloads SHALL remain external and the
  repository receipt SHALL contain only source/revision hash, output hash or
  reference, and conclusion

### Requirement: Assignment owner closure has one consumer migration and deletion gate

The change SHALL close the Assignment owner denominator without introducing a
new lifecycle API.  All production routes, UI features, server actions,
workers, scripts, tests, dynamic imports, Assessment adapters, Learning Record
consumers, and Data Governance handoffs SHALL be mapped to the existing
Assignment public API or an explicitly owned cross-domain port.  A legacy
implementation SHALL be deleted only after its replacement, behavior/privacy
evidence, and zero-required-caller proof are bound to the same source
revision.

#### Scenario: An Assignment consumer is migrated

- **WHEN** a route, feature, worker, script, test, Assessment adapter,
  Learning Record consumer, or governance handoff needs Assignment behavior
- **THEN** it SHALL use the existing Assignment public API or a documented
  owner-approved port
- **AND** the migration ledger SHALL record its old path, replacement, owner,
  preserved behavior, and deletion condition

#### Scenario: The legacy consumer inventory reaches zero

- **WHEN** static, dynamic, worker, script, and test inventories find no
  required caller of a superseded Assignment implementation
- **THEN** the superseded entrypoint SHALL be removed in the qualified
  revision
- **AND** no forwarding facade, duplicate repository, or hidden state machine
  SHALL remain

#### Scenario: A caller crosses an Assessment or Learning Record boundary

- **WHEN** Assignment needs attempt semantics, current projection data, or
  governed evidence writeback
- **THEN** it SHALL use the existing Assessment or Learning Record owner and
  preserve revision, snapshot, authorization, privacy, and idempotency
  identity
- **AND** it SHALL not copy that domain's state machine or write its records
  directly


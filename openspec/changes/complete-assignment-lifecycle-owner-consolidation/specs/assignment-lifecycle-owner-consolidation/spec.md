# assignment-lifecycle-owner-consolidation Specification

## Purpose

Define closure of the existing Assignment application owner across lifecycle
consumers without redefining the Assignment, Assessment, or Learning Record
contracts.

## ADDED Requirements

### Requirement: Assignment has one application owner

Assignment authoring, publication, delivery, submission, review, grading,
feedback release, and resubmission commands and role-safe reads SHALL enter
through the existing `src/lib/assignments` public API.  Routes and UI features
SHALL remain adapters for authentication, mutation protection, parsing, and
response mapping only.

#### Scenario: A route handles an assignment mutation

- **WHEN** a teacher or student submits an assignment lifecycle command
- **THEN** the route SHALL call the existing Assignment public API
- **AND** it SHALL not query Assignment persistence or assemble a second state
  machine.

#### Scenario: A worker consumes an assignment command

- **WHEN** a worker processes grading, release, derivative, or resubmission
  work
- **THEN** it SHALL use the Assignment-owned application operation or an
  explicit owned port
- **AND** it SHALL preserve the existing outbox identity and retry semantics.

### Requirement: Assignment lineage and immutable identities are preserved

Owner consolidation SHALL retain assignment, published revision, question and
content snapshot, audience, submission, answer attempt, review, approval
snapshot, outbox, derivative, release, and audit identities.  Every read and
mutation SHALL validate the existing revision/question/submission/attempt
lineage and frozen ownership rules.

#### Scenario: A new revision is published

- **WHEN** a teacher edits a draft after an earlier revision was published
- **THEN** the existing public API SHALL create or update only the permitted
  draft revision
- **AND** published content and historical submissions SHALL remain immutable.

#### Scenario: A historical submission is read

- **WHEN** a student or authorized teacher reads a historical submission
- **THEN** the API SHALL use frozen ownership or explicit review authorization
- **AND** it SHALL not infer access from current class membership alone.

### Requirement: Idempotency, concurrency, and approval authority remain canonical

The migration SHALL preserve request hashes, idempotency keys, optimistic
version fences, duplicate handling, and outbox delivery behavior.  Teacher
approved criterion snapshots remain the score authority; AI drafts and machine
scores remain advisory and cannot approve, publish, or set final totals.

#### Scenario: A lifecycle command is retried

- **WHEN** an identical command with the same idempotency identity is retried
- **THEN** the API SHALL return or reuse the existing result
- **AND** it SHALL not create duplicate revisions, snapshots, attempts,
  releases, or outbox commands.

#### Scenario: AI and teacher values differ

- **WHEN** machine output conflicts with teacher-approved criteria
- **THEN** the existing approval snapshot and final score rules SHALL prevail
- **AND** the AI value SHALL remain provenance/advisory data only.

### Requirement: Assessment and Learning Record ownership stays explicit

Assignment SHALL consume Assessment attempt use cases and Learning Record
role-safe/current projection or governed writeback ports where required.  It
SHALL not copy Assessment attempt state, scan raw Learning Record events, or
write LearningFact/projection records outside their existing authorized owner.

#### Scenario: Assignment needs current attempt context

- **WHEN** a review or submission operation needs an answer attempt
- **THEN** it SHALL resolve it through the existing Assessment/Assignment
  boundary
- **AND** it SHALL retain the immutable attempt and assignment revision link.

#### Scenario: Governed evidence is eligible

- **WHEN** approved assignment context is sent for evidence processing
- **THEN** the existing governed adapter MAY evaluate and write evidence
- **AND** Assignment routes SHALL not bypass Learning Record authorization,
  privacy, mapping, or idempotency gates.

### Requirement: Owner consolidation closes all required callers

The change SHALL enumerate production routes/features, workers, scripts, tests,
dynamic imports, Assessment adapters, and Learning Record consumers.  A direct
internal caller is migrated only when its replacement, behavior, privacy, and
deletion condition are recorded; a forwarding facade SHALL not count as
consolidation.

#### Scenario: The caller inventory reaches zero

- **WHEN** all required non-owner callers use the public API or explicit port
- **THEN** superseded direct imports SHALL be removed
- **AND** the owner ledger SHALL bind the zero-caller proof to one source
  revision.

#### Scenario: A cross-domain caller is not classified

- **WHEN** a caller's owner or boundary cannot be established
- **THEN** qualification SHALL remain blocked
- **AND** the caller SHALL not be silently moved into Assignment.

## ADDED Requirements

### Requirement: Legacy retirement starts from a closed denominator

The retirement SHALL freeze a source revision/tree and classify assignment-bound
and unbound historical/demo data, legacy `LearningEvidenceDraft` rows,
native runs, associated `LearningFact` rows, workers/outboxes, routes, aliases,
flags, scripts, capture references, specs, tests, and observed callers.

#### Scenario: The denominator is captured

- **WHEN** retirement preparation begins
- **THEN** the receipt SHALL record query definitions, draft and associated
  `LearningFact` counts, canonical row/source-event/contribution hashes,
  route/import inventory hash, privacy-safe run/revision/content hashes,
  owners, and a disposition for every denominator member

#### Scenario: Only the old submission route returns 410

- **WHEN** the production submission route is disabled but approve,
  writeback-preview, legacy pages, or fallback readers remain
- **THEN** retirement SHALL remain open and SHALL NOT claim completion

### Requirement: Valid assignment-bound records migrate to Assignment authority

Every valid assignment-bound legacy record SHALL resolve its Assignment,
published revision, question, submission, answer, attempt, grading run,
student ownership, teacher authorization, rubric/content identity, and source
checksum before migration through the Assignment review/feedback public API.

#### Scenario: Legacy identity is complete

- **WHEN** all required lineage and authorization identities match
- **THEN** the record SHALL be reconciled to the existing Assignment review,
  approval snapshot, release/derivative, and outbox contract without creating
  a new grading model or changing an approved score, and every already
  materialized `LearningFact` SHALL be retained and mapped to that authority

#### Scenario: Legacy identity is incomplete

- **WHEN** any assignment, revision, question, attempt, owner, authorization,
  or checksum cannot be proven
- **THEN** the record SHALL be blocked or placed in an explicit migration
  disposition and SHALL NOT be silently approved or released

### Requirement: Legacy evidence has one parseable authority mapping

Each retained legacy `LearningEvidenceDraft` SHALL map to exactly one existing
`TeacherAssignmentApprovalSnapshot` or one explicitly named read-only
historical authority.  Every associated `LearningFact` SHALL be included in
that mapping with a unique deterministic `sourceEventId`, source checksum,
criterion/evidence locator, and a source path the data-completeness audit can
resolve without the retired route or provider payload.

#### Scenario: A legacy draft and its facts are reconciled

- **WHEN** an assignment-bound or approved unbound draft is dispositioned
- **THEN** the mapping SHALL contain the draft id, target authority kind/id,
  all associated fact ids, each `sourceEventId`, source checksum, criterion
  locator, and parse result, with no fact assigned to two authorities

#### Scenario: A historical fact lacks a usable source identity

- **WHEN** an associated `LearningFact` has a null/colliding `sourceEventId`
  or its source cannot be resolved to the draft and authority
- **THEN** a reviewed idempotent identity-enrichment step MAY assign a
  deterministic namespaced id without changing the fact contribution; if
  uniqueness or parsing cannot be proven, the row SHALL remain BLOCKED and no
  replacement fact SHALL be created

### Requirement: Materialized criterion evidence is never replayed

Retirement SHALL preserve criterion evidence that the old approval path already
materialized in `LearningFact` and SHALL NOT replay its criterion writeback or
`EvidenceOutbox` event.  The migration SHALL be idempotent on the existing
`sourceEventId` and SHALL not create a second fact or duplicate learner-profile
contribution.

#### Scenario: A criterion fact already exists

- **WHEN** a legacy draft resolves to an existing criterion `LearningFact`
- **THEN** migration SHALL map and retain the existing fact, timestamps,
  source references, `competencyContribution`, and audit chain, and SHALL NOT
  enqueue writeback or materialize another fact

#### Scenario: Fact and learner profile parity is checked

- **WHEN** the retirement receipt compares the frozen pre-migration state with
  the post-migration state
- **THEN** the associated fact set, unique source-event set, and effective
  learner-profile contribution digest SHALL match exactly, and any mismatch
  SHALL keep retirement BLOCKED

### Requirement: Unbound history has a read-only controlled boundary

Unbound historical or demo records MAY remain only through a named,
privacy-scoped, read-only adapter with an owner, retention rule, and deletion
condition.  The adapter SHALL NOT approve, write back, publish feedback, or
appear as a current assignment workflow.

#### Scenario: Approved unbound history is requested

- **WHEN** a permitted operator requests an unbound historical record with an
  approval snapshot or explicit proof of reviewer, score, source checksum, and
  immutable lineage
- **THEN** the adapter MAY return a read-only historical projection and SHALL
  mark it as non-production history while preserving the associated fact
  mapping and source checksum

#### Scenario: Unbound draft lacks approval proof

- **WHEN** a historical/demo draft has no approved snapshot or sufficient
  read-only proof
- **THEN** the adapter SHALL return a blocked state and SHALL NOT expose
  student feedback, score authority, or writeback actions

### Requirement: Obsolete production bridges are deleted only after gates close

The old approve/writeback-preview fallback, teacher workbench/demo, student
document-feedback shell, aliases, flags, and obsolete callers SHALL be
deleted only after all valid callers migrate and the retirement receipt closes
usage/data/log, worker, identity/hash, and rollback gates.

#### Scenario: Deletion gates are complete

- **WHEN** the observation window has zero legacy reads/writes or only counted
  controlled-adapter reads, no new legacy run ids, all jobs are drained/fenced,
  route/import inventory is clean, and rollback rehearsal passes
- **THEN** the implementation MAY delete the obsolete source and references
  and SHALL record exact retained/deleted paths and hashes

#### Scenario: A deletion gate is missing

- **WHEN** usage, data, logs, active jobs, identity hashes, or recovery proof
  are incomplete or contradictory
- **THEN** deletion SHALL be blocked and legacy writes SHALL remain disabled or
  fenced with an explicit limitation

### Requirement: Governed data and audit lineage are retained

Retirement SHALL preserve approved grading/feedback, original submissions and
checksums, immutable revision/attempt lineage, audit records, and governed
outbox evidence, associated `LearningFact` rows, and learner-profile
contribution history.  It SHALL NOT drop generic `LearningEvidenceDraft` or
governance migration/repair scripts solely because their names are legacy.

#### Scenario: A retained record has another governance consumer

- **WHEN** a `LearningEvidenceDraft`, migration script, repair script, an
  outbox record, or an associated `LearningFact` remains required by a
  governed consumer
- **THEN** it SHALL be marked retained with an owner and purpose and SHALL NOT
  be deleted or rematerialized by this change

#### Scenario: Approved history is preserved

- **WHEN** legacy route code is removed
- **THEN** approved history SHALL remain readable through its new Assignment
  projection or controlled adapter with the source checksum, immutable
  lineage, parseable fact mapping, and original learner-profile contribution
  intact

### Requirement: Legacy workers and retries cannot recreate the fallback

All legacy document-grading jobs, review/evidence outbox messages, producers,
and retry paths SHALL be inventoried and drained, cancelled, or fenced before
actual deletion.

#### Scenario: A stale legacy retry arrives

- **WHEN** a legacy worker retries after the replacement path is active
- **THEN** it SHALL be rejected or recorded as fenced and SHALL NOT create a
  new fallback draft, approval, feedback release, or duplicate `LearningFact`
  / learner-profile contribution

#### Scenario: Queue closure is verified

- **WHEN** no active legacy job or retry remains and retained outcomes are
  audited
- **THEN** the receipt SHALL bind queue counts and hashes to the frozen
  denominator and allow source retirement to proceed

### Requirement: Retirement proves no facade or hidden caller remains

The final fitness check SHALL cover production imports, dynamic links, route
inventory, feature flags, scripts, capture fixtures, worker registrations, and
tests and SHALL distinguish retained governance adapters from deleted bridges.

#### Scenario: A caller still targets the old workbench

- **WHEN** source, script, capture, or route inventory finds an unclassified
  old workbench/document-feedback reference
- **THEN** qualification SHALL fail until it is migrated, retained as
  controlled history, or explicitly deleted with evidence

#### Scenario: A retained adapter is inspected

- **WHEN** the controlled historical adapter is statically checked
- **THEN** it SHALL be read-only, identity-bound, privacy-scoped, and unable
  to import or invoke approve, writeback-preview, LearningFact writers, or
  criterion-evidence replay paths

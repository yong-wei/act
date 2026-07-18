## MODIFIED Requirements

### Requirement: Learner portrait updates are stable and incremental
The learner portrait update engine SHALL treat portrait data as long-term state that is incrementally corrected only by admitted governed state-changing evidence or recomputation after formal evidence revocation.

#### Scenario: No new state-changing evidence is available
- **WHEN** a learner has an existing valid portrait v2 state
- **AND** no new admitted governed evidence affects a dimension
- **THEN** every dimension score SHALL be preserved
- **AND** the engine SHALL NOT create a replacement learner-state snapshot solely because time passed, a scheduler ran, or a rolling evidence window is empty
- **AND** the existing snapshot SHALL remain the effective state.

#### Scenario: Evidence freshness changes without state-changing evidence
- **WHEN** the latest effective snapshot or its supporting evidence becomes older
- **AND** no new admitted governed evidence affects learner state
- **THEN** the system MAY report freshness or confidence metadata under a named policy version
- **AND** it SHALL NOT null, zero, hide, or decrease an established score, manufacture a weakness, or suppress a recommendation solely because of age
- **AND** it SHALL NOT persist a learner-state snapshot solely to record aging.

#### Scenario: Sparse evidence affects one dimension
- **WHEN** new admitted governed evidence affects only one portrait dimension
- **THEN** only that dimension SHALL receive a score update
- **AND** unrelated dimensions SHALL NOT be reset to zero or treated as missing.

#### Scenario: Negative evidence is admitted
- **WHEN** evidence comes from an authorized profile-eligible source family
- **AND** required review and quality state is accepted
- **AND** it has a non-empty profile contribution, canonical negative classification, rationale, and traceable source lineage for named dimensions
- **THEN** only those dimensions MAY decrease through a bounded update
- **AND** free-form outcome text, inactivity, elapsed time, or revocation alone SHALL NOT satisfy this admission contract.

#### Scenario: Negative evidence fails admission
- **WHEN** any required source, authorization, review, quality, contribution, classification, rationale, or lineage condition is missing
- **THEN** the evidence SHALL be quarantined or treated as context-only for portrait purposes
- **AND** it SHALL NOT decrease learner state.

#### Scenario: Context-only evidence is processed
- **WHEN** a LearningFact or event is context-only or has no admitted profile contribution
- **THEN** it SHALL NOT overwrite any portrait score or create a learner-state snapshot
- **AND** the independent processing checkpoint SHALL advance transactionally so the same evidence is not repeatedly processed
- **AND** it MAY appear in authorized activity history.

#### Scenario: Evidence is partially revoked
- **WHEN** governed revocation removes a subset of previously effective evidence
- **THEN** the engine SHALL recompute from all remaining authorized evidence
- **AND** unaffected evidence and dimensions SHALL remain effective
- **AND** revoking negative evidence MAY increase the recomputed state without treating revocation as positive evidence.

#### Scenario: Class authorization is revoked
- **WHEN** evidence loses authorization in one class scope
- **THEN** only that class-scoped projection SHALL be recomputed
- **AND** the learner's global portrait SHALL NOT be revoked solely because of the class authorization change.

### Requirement: Legacy learner portraits migrate to portrait v2 with lineage
The system SHALL provide auditable migration and repair paths from legacy six-dimensional learner portrait data and provably erroneous compatibility projections to primary seven-dimensional portrait v2 records.

#### Scenario: Legacy snapshot is migrated
- **WHEN** a legacy six-dimensional snapshot is migrated
- **THEN** the resulting portrait v2 record SHALL include source snapshot refs, mapping version, mapping confidence, limitation metadata, original timestamp, migration timestamp, scope, and source watermark
- **AND** it SHALL NOT claim native portrait v2 authority when values are compatibility-derived.

#### Scenario: Migration is rerun
- **WHEN** migration apply runs again with the same signed manifest, migration version, and source checksums
- **THEN** it SHALL be idempotent
- **AND** it SHALL NOT duplicate state or dependent projections, erase lineage, or republish outbox work.

#### Scenario: A time-only compatibility snapshot is provably erroneous
- **WHEN** canonical lineage and source records prove that a `no-recent-evidence` snapshot was created only because a rolling evidence window became empty
- **AND** an earlier valid state or authoritative state-changing evidence exists in the same scope
- **THEN** repair SHALL classify the time-only snapshot as superseded
- **AND** it SHALL build a current-generation effective projection from the valid baseline and authorized evidence
- **AND** preserve the superseded row and repair lineage for audit.

#### Scenario: Historical classification is ambiguous
- **WHEN** lineage cannot prove whether a zero-fact or lifecycle row is time-only, revoked, invalid, or scope-correct
- **THEN** repair SHALL classify it as `ambiguous` or `unresolved`
- **AND** automatic apply SHALL fail closed unless an authorized reasoned per-record override is included in the signed manifest
- **AND** it SHALL NOT revive or supersede the row by inference from label, fact count, or timestamp alone.

#### Scenario: No valid source exists for repair
- **WHEN** neither a valid baseline nor authoritative state-changing evidence exists for a learner
- **THEN** repair SHALL report the learner as unresolved or never-evidenced
- **AND** it SHALL NOT synthesize a capability score.

#### Scenario: Canonical fixture account is migrated
- **WHEN** Yang Fan diagnostic fixture data is generated or migrated
- **THEN** the canonical student number and canonical email SHALL identify the target account
- **AND** display-name-only duplicate accounts SHALL NOT receive fixture overwrite data.

## ADDED Requirements

### Requirement: Materialization progress is independent from learner-state snapshots
The system SHALL persist a per-scope processing checkpoint independently from learner-state snapshots and SHALL advance it through an append-only journal with a contiguous commit-safe order.

#### Scenario: A learner-state change is journaled
- **WHEN** evidence is created, governed evidence is revoked before source deletion, class authorization changes, or a durable user/downstream action affects projection or rollback truth
- **THEN** the source transaction SHALL lock the scope's transactional counter row before allocating the next contiguous sequence
- **AND** it SHALL hold the lock until the source mutation, journal event, and counter update commit together
- **AND** rollback SHALL leave neither an event nor a sequence gap
- **AND** physical deletion or mutable source updates SHALL NOT be the only record of revocation.

#### Scenario: Journal producers commit out of attempted order
- **WHEN** concurrent producers target the same scope
- **THEN** the scope counter lock SHALL serialize their allocation and commit-visible order
- **AND** a processor SHALL advance only through the contiguous committed prefix
- **AND** it SHALL NOT use PostgreSQL sequence allocation or `MAX(sequence)` as a safe watermark.

#### Scenario: A late or backfilled fact is ingested
- **WHEN** a fact is created after the current checkpoint but has an old `startedAt` or `finishedAt`
- **THEN** processing SHALL order it by journal sequence rather than business time
- **AND** identical timestamps and cross-batch arrival order SHALL NOT cause omission or duplicate processing.

#### Scenario: A context-only batch commits
- **WHEN** a materialization batch contains only context-only or inadmissible facts
- **THEN** the checkpoint SHALL advance once under the scope lock and generation fence
- **AND** no learner-state or dependent projection write SHALL occur.

#### Scenario: Processing transaction fails
- **WHEN** checkpoint advancement or a state-changing projection write fails before commit
- **THEN** the checkpoint and every state/dependent write in that transaction SHALL roll back together
- **AND** retry SHALL process the batch exactly once.

#### Scenario: State-changing evidence follows context-only evidence
- **WHEN** a later admitted fact follows a committed context-only batch
- **THEN** processing SHALL start after the committed checkpoint
- **AND** old context-only facts SHALL NOT be reprocessed
- **AND** the new fact SHALL affect state at most once.

### Requirement: Learner-state consumers select deterministic scoped effective state
Learner-state consumers SHALL use the active projection generation and a shared semantic selector with explicit scope, authority, and total ordering.

#### Scenario: Global portrait is selected
- **WHEN** a consumer requests global learner state
- **THEN** the selector SHALL use `userId` scope
- **AND** order valid candidates by covered state-changing evidence watermark, authority rank, projection generation, commit time, and stable id
- **AND** native portrait v2 SHALL outrank migrated portrait v2, which SHALL outrank legacy compatibility at the same watermark.

#### Scenario: Class-scoped learner state is selected
- **WHEN** a consumer requests state for a learner in a class
- **THEN** the selector SHALL use `(classId, userId)` and require class/session provenance
- **AND** it SHALL NOT substitute the global portrait or another class's evidence when class provenance is absent.

#### Scenario: A newer physical row is time-only invalid
- **WHEN** the newest physical row is provably time-only and an older valid candidate exists in the same scope
- **THEN** the selector SHALL retain the valid candidate as current effective state
- **AND** expose `effectiveSnapshotAt`, `lastStateChangingEvidenceAt`, `freshnessState`, and `freshnessAsOf` separately.

#### Scenario: Ordering or scope cannot be proven
- **WHEN** candidate authority, watermark, lineage, or scope conflicts cannot be resolved
- **THEN** the selector SHALL fail closed as unresolved
- **AND** it SHALL NOT choose by physical row recency alone.

### Requirement: Historical repair freezes sources and is restartable
Historical repair SHALL use deterministic audit, apply, and verify modes over an immutable source manifest.

#### Scenario: Repair audit runs
- **WHEN** audit runs in a consistent database snapshot
- **THEN** it SHALL freeze source cutoffs, exact source ids and checksums, scope keys, classifications, actions, expected outputs, schema version, stable ordering, and UTC serialization in a signed manifest
- **AND** it SHALL write no projections.

#### Scenario: Evidence arrives after the base cutoff
- **WHEN** governed evidence is created or revoked after the manifest journal cutoff
- **THEN** baseline apply SHALL exclude it from the frozen reconstruction
- **AND** dual-generation processors SHALL replay the append-only event into both generations before final activation.

#### Scenario: A source row drifts before its batch
- **WHEN** a referenced source row no longer matches its manifest checksum
- **THEN** apply SHALL fail that scope without partial writes
- **AND** it SHALL require a new manifest or authorized resolution rather than mutate the frozen manifest.

#### Scenario: Repair resumes after interruption
- **WHEN** apply is interrupted after committed bounded batches
- **THEN** retry SHALL skip verified idempotent actions and continue remaining manifest scopes
- **AND** preserve a complete operation trail.

### Requirement: Projection generations activate and roll back atomically
Historical repair SHALL build snapshots and mutable dependent projections in a shadow generation, keep both generations synchronized through the append-only change journal, and enforce cutover and rollback watermarks before an atomic active-generation switch.

#### Scenario: Migration is still building
- **WHEN** any required scope or dependent projection in the new generation is incomplete or unverified
- **THEN** all consumers SHALL continue reading the previous active generation
- **AND** migration outbox work SHALL remain unpublished.

#### Scenario: Migration activates
- **WHEN** every required scope passes checksum, lineage, downstream, class-boundary, and unresolved-record gates
- **AND** a state-change barrier is active
- **AND** both generation checkpoints and revocation backlogs are drained through the same final contiguous committed watermark for every scope
- **THEN** the system SHALL atomically switch the active generation before releasing the barrier
- **AND** every dual-capable consumer SHALL observe one generation rather than mixed projections.

#### Scenario: Activation is rolled back
- **WHEN** post-activation verification fails
- **THEN** operators SHALL acquire the state-change barrier and drain both continuously synchronized generations to one final journal watermark
- **AND** rollback SHALL be refused unless durable user actions and revocations are synchronized and generation outbox backlog is fenced
- **AND** operators SHALL atomically switch to the preserved previous generation using the expanded dual-capable release.

#### Scenario: Generation outbox work is delivered
- **WHEN** a generation produces dependent outbox work
- **THEN** each item SHALL carry a semantic idempotency key, activation fence epoch, and claim lease
- **AND** a cutover or rollback barrier SHALL stop new claims and wait for every old-epoch claimed lease to complete, cancel, or expire and be reclaimed
- **AND** the irreversible receiver or first durable consumer SHALL validate the active fence epoch immediately before applying effects
- **AND** a stale rejected item SHALL NOT consume the semantic idempotency key
- **AND** inactive pending work SHALL be held or cancelled and accepted effects SHALL NOT be republished during activation or rollback.

### Requirement: Repair artifacts minimize personal data
Learner-state change journals, repair manifests, ledgers, logs, and reports SHALL contain only data required for deterministic processing and repair and SHALL remain restricted to authorized data-governance operators.

#### Scenario: A journal event is persisted
- **WHEN** the system records a learner-state change event
- **THEN** it SHALL store only pseudonymous scope, governed event type and schema version, minimal source reference, reason code, checksum, contiguous sequence, fence, and ordering metadata
- **AND** it SHALL NOT copy raw event payload, answer or feedback text, risk narrative, private memory, hidden evaluation details, email, student number, or display name
- **AND** source deletion SHALL leave only a non-reversible tombstone reference
- **AND** role-restricted access, encryption at rest, retention, archive, and destruction controls SHALL apply.

#### Scenario: Repair evidence is persisted
- **WHEN** the system stores a manifest or repair ledger
- **THEN** it SHALL use pseudonymous scope keys, record ids, classifications, versions, and checksums
- **AND** exclude raw event payloads, answer bodies, private memory, hidden evaluation details, emails, student numbers, and display names
- **AND** apply documented encryption, retention, and destruction controls.

#### Scenario: Rehearsal evidence is published
- **WHEN** validation output is attached to review or CI evidence
- **THEN** it SHALL contain aggregate counts or stable pseudonyms only
- **AND** it SHALL not permit reconstruction of learner identity.

#### Scenario: Journal data is observed operationally
- **WHEN** CI, an ordinary application log, a management dashboard, or public runtime emits operational data
- **THEN** it SHALL NOT expose per-student journal entries
- **AND** it SHALL use aggregate counts or authorized pseudonymous diagnostics only.

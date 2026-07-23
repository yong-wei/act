## MODIFIED Requirements

### Requirement: Cumulative attainment backfill is explicit and recoverable
The system SHALL provide the minimal Prisma schema/data migration required for
the cumulative cutover: append-only fact transitions, immutable learner current
or no-evidence state, growth-event invalidation, protected class publication, a
global cutover fence, and durable migration receipts. The versioned migration
SHALL default to dry run and require explicit apply, stable run identity, and
completion verification before it writes. It SHALL select only eligible
learners, SHALL not alter source LearningFacts, and SHALL produce durable
receipts for learner, portrait, growth, class, invalidated-job, skipped, and
failed outcomes.

#### Scenario: Dry run inventories the migration
- **WHEN** an operator runs the cumulative migration without apply
- **THEN** it SHALL report de-identified candidate, current-class, target-version, superseded-job, no-evidence, skipped, and failure counts
- **AND** it SHALL NOT create a rebuild request, snapshot, materialization, or queue job.

#### Scenario: Apply rebuilds eligible learner portraits
- **WHEN** an operator applies the migration with a stable run identity
- **THEN** it SHALL create or advance a fenced rebuild for every selected eligible learner using all governed historical facts
- **AND** it SHALL enqueue only tasks bound to the migration's active calculation version and generation.

#### Scenario: Historical facts have no portrait contribution
- **WHEN** a selected learner has facts but the complete fold yields governed no-evidence, such as context-only facts
- **THEN** the migration SHALL record the explicit no-evidence outcome without creating a zero-valued portrait
- **AND** the learner SHALL remain represented in current-class missing-coverage denominators.

#### Scenario: Migration is repeated
- **WHEN** the same migration run is retried after failure or interruption
- **THEN** durable run identity and generation fencing SHALL resume or verify the existing outcomes
- **AND** it SHALL NOT duplicate source facts, growth events, learner portraits, or class materializations.

#### Scenario: Schema migration preserves historical learner state
- **WHEN** the Prisma migration creates current pointers, no-evidence tombstones, or new calculation-version state
- **THEN** it SHALL preserve every existing `StudentPortraitV2Snapshot` and LearningFact
- **AND** rollback SHALL restore the pre-migration database rather than physically deleting selected historical rows.

### Requirement: Cumulative class aggregation follows validated personal portraits
The migration SHALL materialize a class only after every selected current
member has a verified canonical portrait or governed no-evidence outcome. It
SHALL derive the member set from current membership and SHALL bind every class
record to the active calculation version, source portrait versions, evidence
cutoff, member set, and generation identity.

#### Scenario: Current-member learner outcomes complete
- **WHEN** every selected current member has a verified portrait or governed no-evidence outcome for the active migration generation
- **THEN** the migration SHALL enqueue one version-bound class task per distinct current class
- **AND** no learner fact SHALL be copied into or owned by the class.

#### Scenario: Apply verifies this run's class materializations
- **WHEN** version-bound class tasks complete
- **THEN** the migration SHALL verify one immutable `class-competency.cumulative.v2` materialization per target class carrying this run's identity
- **AND** an older v1/v2 record or trimmed queue job SHALL NOT satisfy completion for the current run.

#### Scenario: A selected learner remains incomplete
- **WHEN** a selected learner outcome is pending, failed, stale, or has the wrong generation
- **THEN** the migration SHALL report the incomplete aggregate state
- **AND** it SHALL NOT publish a class materialization for that run.

### Requirement: Cumulative class materialization is complete and immutable
The class worker SHALL write immutable `class-competency.cumulative.v2`
materializations containing overall and per-dimension coverage, equal-weight
means with dimension-specific denominators, members' last trend distribution,
evidence-backed risk distribution, seven-dimensional diagnosis, evidence
cutoff, source-version lineage, generation, migration run, and input digest.

#### Scenario: Class materialization includes partially evidenced members
- **WHEN** current members have different valid dimension coverage
- **THEN** each dimension SHALL include only evidenced members with equal weight and SHALL report included and missing counts
- **AND** missing values SHALL NOT be converted to zero.

#### Scenario: Class materialization is published
- **WHEN** the active class task has complete verified learner outcomes
- **THEN** it SHALL revalidate generation, migration run, and input digest inside a protected transaction, append one immutable v2 record, and atomically advance the current pointer
- **AND** it SHALL NOT mutate `class-competency.cumulative.v1` or serve v1 as a fallback.

#### Scenario: Class publication input drifts
- **WHEN** membership, source portrait versions, generation, run identity, or input digest differs from the task's protected publication input
- **THEN** the class worker SHALL reject publication and record a durable non-current outcome
- **AND** the stale immutable record, if already appended, SHALL NOT become current.

#### Scenario: No governed evidence changes
- **WHEN** no governed learner evidence or current membership change affects the class
- **THEN** elapsed calendar time SHALL NOT create another class materialization or alter trend, risk, diagnosis, or availability
- **AND** newest-first activity MAY be displayed separately without becoming a class portrait scope.

### Requirement: Superseded migration queues cannot publish
The cumulative migration SHALL atomically advance a durable global cutover
fence and invalidate every BullMQ pending, retrying, delayed, or in-flight
learner and class migration task bound to an older calculation or
materialization version. Publication SHALL revalidate the active version,
generation, and cutover fence inside the guarded write.

#### Scenario: Old task starts after migration cutover
- **WHEN** a task for the superseded portrait calculation or `class-competency.cumulative.v1` reaches a worker after cutover
- **THEN** the guarded write SHALL reject its publication and record an invalidated outcome
- **AND** retrying the old task SHALL remain unable to change the current learner or class state.

#### Scenario: Migration verification checks queue invalidation
- **WHEN** the operator verifies the migration before reopening service
- **THEN** the receipts SHALL account for all superseded pending, retrying, delayed, and in-flight tasks
- **AND** a representative stale task SHALL be proven unable to publish.

### Requirement: Migration receipts are durable and cutover-scoped
Every migration stage SHALL persist receipts bound to the migration run,
calculation/materialization version, generation, input digest, global cutover
fence, outcome counts, and verification state. Process logs or BullMQ job
presence SHALL NOT substitute for these receipts.

#### Scenario: Cutover is approved
- **WHEN** the operator prepares to reopen app, worker, and scheduler
- **THEN** durable receipts SHALL prove schema/data migration, learner current/no-evidence outcomes, growth invalidations, class current publications, and old-queue invalidations for the same run and fence
- **AND** missing, mismatched, or non-terminal receipts SHALL keep the service stopped.

#### Scenario: Migration resumes after interruption
- **WHEN** an apply run resumes with the same stable run identity
- **THEN** it SHALL use durable receipts to resume or verify each idempotent stage
- **AND** it SHALL NOT infer completion from absent queue jobs, trimmed BullMQ history, or mutable logs.

### Requirement: Cumulative migration rehearsal and rollback are production-equivalent
The migration SHALL be rehearsed against a locally restored latest production
export before production execution. Production SHALL use the same schema/data
migration and matching app, worker, and scheduler version while all three
services remain stopped.

#### Scenario: Local production-copy rehearsal runs
- **WHEN** the latest production export is restored locally
- **THEN** the operator SHALL run dry-run and apply, verify incremental/rebuild equivalence, queue invalidation, counts, v2 materializations, and representative full/partial/no-evidence pages
- **AND** the local rehearsal SHALL NOT write to production.

#### Scenario: Production maintenance begins
- **WHEN** the rehearsal has passed
- **THEN** the operator SHALL stop app, worker, and scheduler and create a database backup whose readability, integrity, and restore steps are verified
- **AND** production SHALL run the same rehearsed migration with the matching deployed version.

#### Scenario: Migration or verification fails
- **WHEN** migration counts, queue invalidation, v2 materialization, or representative page verification fails
- **THEN** the operator SHALL restore the verified pre-migration database backup and previous app, worker, and scheduler version
- **AND** no partial migration or mixed-version portrait SHALL be served.

## REMOVED Requirements

### Requirement: Cumulative class snapshots preserve recent semantics
**Reason**: Issue #989 deletes the recent portrait model. `class-competency.cumulative.v1` also cannot express the required cumulative trend, risk, diagnosis, and lineage contract.

**Migration**: The single stop-the-world migration writes immutable `class-competency.cumulative.v2`, invalidates older queue work, and cuts all class portrait reads to v2 without online dual-version fallback.

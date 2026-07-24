# adaptive-learner-state-service Specification

## Purpose
Define the server-owned adaptive learner-state read model used by path planning, personalization, profile, and Konling consumers.
## Requirements
### Requirement: Learner state is server-owned
The system SHALL provide a server-owned Learner State Service for adaptive-learning consumers.

#### Scenario: Path planner requests learner state
- **WHEN** the path planner requests learner state for a student
- **THEN** the service SHALL return primary competency state, second-level competency state, knowledge mastery, resource preference, media absorption, risks, path context, evidence windows, and confidence markers
- **AND** missing, stale, partial, or low-confidence evidence SHALL be explicit.

#### Scenario: Client sends profile hints
- **WHEN** a client sends profile-like values to an AI or path endpoint
- **THEN** the server SHALL treat them as hints only
- **AND** authoritative adaptive state SHALL come from the Learner State Service.

### Requirement: Learner state retains and extends competency dimensions
The system SHALL expose portrait v2 as the primary learner portrait dimensions
while retaining legacy six-dimensional competency values only as
compatibility or migration metadata.

#### Scenario: Learner state is returned
- **WHEN** learner state is read after portrait v2 is available
- **THEN** it SHALL include the seven portrait v2 dimensions as the primary learner portrait
- **AND** any `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, or `selfDirectedLearning` values SHALL be marked as legacy compatibility or migration inputs rather than primary dimensions.
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence exists.

### Requirement: Learner-state fields are quantified and scoped
The system SHALL declare quantification and privacy metadata for learner-state field families.

#### Scenario: Field family is added
- **WHEN** a learner-state field family is introduced
- **THEN** it SHALL declare value range, source families, algorithm version, evidence threshold, confidence policy, fallback reason, and privacy scope
- **AND** consumers SHALL NOT treat undeclared or low-confidence fields as high-confidence personalization state.

### Requirement: Learner state exposes the control-correction goal slice
The system SHALL expose a governed `control-correction` learner-state slice that can be consumed by path planning, Konling coaching, student UI, and teacher reports.

#### Scenario: Goal slice is requested
- **WHEN** an authorized student, teacher, or service requests learner state for `goal=control-correction`
- **THEN** the response SHALL include stable dimensions for time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI-collaboration evidence
- **AND** each dimension SHALL include level, score or band, source coverage, evidence count, freshness, confidence, and privacy visibility metadata.

#### Scenario: Evidence is incomplete
- **WHEN** one or more control-correction dimensions lack sufficient governed evidence
- **THEN** the learner-state slice SHALL mark missing, stale, partial, or low-confidence dimensions explicitly
- **AND** it SHALL NOT present low-evidence dimensions as complete high-confidence mastery.

#### Scenario: Existing learner-state consumers read general state
- **WHEN** a consumer does not request the `control-correction` goal slice
- **THEN** existing learner-state payloads SHALL remain compatible
- **AND** the new goal slice SHALL NOT be required for unrelated adaptive-learning surfaces.

### Requirement: Learner state consumes registered goal slices
The Learner State Service SHALL resolve goal-specific read models through the adaptive goal-slice registry.

#### Scenario: Registered goal slice is read
- **WHEN** learner state is requested for a registered goal
- **THEN** the service SHALL return only dimensions and metadata declared by that goal contract
- **AND** it SHALL include confidence, source coverage, freshness, and privacy metadata for each visible field family.
- **AND** it SHALL preserve declared non-dimensional field families such as active path context, recent path rounds, terminal validation state, and no-active-path state when those families are part of the goal contract.

#### Scenario: Registered control-correction path context is read
- **WHEN** learner state is requested for `goal=control-correction`
- **THEN** the registered goal contract SHALL allow the active path id, status, current node, terminal validation state, and no-active-path state required by control-correction path consumers
- **AND** registry filtering SHALL NOT remove those fields merely because they are not competency dimensions.

#### Scenario: General learner state is read
- **WHEN** no goal is requested
- **THEN** existing general learner-state payloads SHALL remain compatible
- **AND** registered goal slices SHALL NOT be required for unrelated adaptive surfaces.

### Requirement: Learner state links to active control-correction path rounds
The system SHALL expose privacy-safe references from learner state to active or recent control-correction path rounds when authorized.

#### Scenario: Active path exists
- **WHEN** learner state is requested for `goal=control-correction` and an active path exists for the student
- **THEN** the learner-state payload SHALL include the active path id, status, current node, terminal validation state, and low-confidence markers needed by downstream consumers
- **AND** it SHALL NOT embed raw execution payloads or private Konling dialogue.

#### Scenario: No active path exists
- **WHEN** no active control-correction path exists
- **THEN** learner state SHALL expose an explicit no-active-path state
- **AND** path planning consumers SHALL be able to distinguish that state from a failed learner-state read.

### Requirement: Learner state is enabled in production runtime
The Learner State Service SHALL be enabled in production app and worker runtimes.

#### Scenario: Production app starts
- **WHEN** the production app container is created
- **THEN** `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED` SHALL be set to `true`
- **AND** learner-state API and Konling runtime reads SHALL treat the service as available.

#### Scenario: Production worker starts
- **WHEN** the production worker container is created
- **THEN** it SHALL receive the same learner-state service flag as the app container
- **AND** background evidence or feature-cache tasks SHALL not run with a contradictory disabled learner-state assumption.

#### Scenario: Deployment examples are inspected
- **WHEN** operators inspect local and production environment examples
- **THEN** the examples SHALL document `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` as the expected production value
- **AND** model-provider examples SHALL not imply that learner-state is optional for normal production Konling behavior.

### Requirement: Learner-state no-data states are explicit
The Learner State Service SHALL distinguish an unavailable service from an available service with sparse or missing learner data.

#### Scenario: New learner has no evidence
- **WHEN** learner-state is requested for a learner with no relevant evidence rows
- **THEN** the service SHALL return an explicit low-confidence or no-evidence state
- **AND** it SHALL NOT present missing evidence as a failed learner-state read.

#### Scenario: Learner has no active path
- **WHEN** learner-state is requested for a goal that has no active path for the learner
- **THEN** the service SHALL return an explicit no-active-path state
- **AND** consumers SHALL be able to distinguish it from path read failure.

### Requirement: Learner portrait state uses portrait v2 as primary model
The learner-state service SHALL expose a canonical seven-dimensional portrait
v2 payload as the primary learner portrait.

#### Scenario: Portrait v2 state is read
- **WHEN** the learner-state service returns current portrait data
- **THEN** it SHALL include all seven portrait v2 dimensions with score, confidence, freshness, evidence counts, source lineage, and calculation version
- **AND** it SHALL identify any migrated legacy values with limitation metadata.

#### Scenario: Legacy portrait state exists
- **WHEN** only legacy six-dimensional snapshot data exists for a learner
- **THEN** the service MAY derive portrait v2 compatibility values
- **AND** it SHALL mark the result as migrated or compatibility-derived rather than native portrait v2 evidence.

### Requirement: Portrait source lineage is privacy scoped
The learner-state service SHALL keep portrait source lineage auditable without
leaking raw or unauthorized evidence to learner-facing or AI-facing consumers.

#### Scenario: Learner-facing portrait is returned
- **WHEN** portrait v2 data is returned to a student-facing profile, Konling, or planner consumer
- **THEN** source lineage SHALL be redacted to allowed evidence-family, citation, aggregate, or hashed refs
- **AND** raw source payloads, teacher-scoped refs, private fixture refs, and migration-source snapshot ids SHALL NOT be exposed unless the caller is authorized for that evidence scope.

#### Scenario: Reviewer or administrator audits lineage
- **WHEN** an authorized reviewer or administrator requests audit details
- **THEN** the system MAY expose richer lineage metadata
- **AND** the response SHALL still respect role scope, privacy minimization, and export boundaries.

### Requirement: Learner portrait updates are stable and incremental
The learner portrait update engine SHALL treat portrait data as cumulative
long-term state that is changed only by governed evidence or an explicit
calculation-version migration. It SHALL process each learner's facts in stable
fact order through the same deterministic reducer for incremental updates,
retries, and rebuilds.

#### Scenario: No new evidence is available
- **WHEN** a learner has an existing portrait v2 state
- **AND** no new governed evidence affects that state
- **THEN** dimension scores, confidence, trend, risk, and portrait availability SHALL be preserved
- **AND** elapsed calendar time SHALL only change the displayed evidence age.

#### Scenario: Sparse evidence affects one dimension
- **WHEN** new governed evidence affects only one portrait dimension
- **THEN** only that dimension and its dependent aggregate state SHALL receive an update
- **AND** unrelated dimensions, trends, and risks SHALL NOT be reset.

#### Scenario: Negative evidence is processed
- **WHEN** governed evidence explicitly indicates failure, misconception, unsafe action, or low-quality work
- **THEN** affected dimensions MAY decrease through a bounded update
- **AND** the update SHALL include rationale and evidence lineage.

#### Scenario: Context-only evidence is processed
- **WHEN** a LearningFact or event is marked as context-only or has no profile contribution
- **THEN** it SHALL NOT overwrite any portrait score, trend, risk, or confidence
- **AND** it MAY appear in evidence context or activity history.

#### Scenario: Multiple facts for one learner are processed
- **WHEN** multiple facts for one learner enter one worker request or several retries
- **THEN** the engine SHALL order them by occurrence time and stable fact identity and fold them one at a time
- **AND** worker batch boundaries SHALL NOT change the resulting portrait.

#### Scenario: Historical fact changes the stable order
- **WHEN** a governed fact is corrected, revoked, or inserted before the learner's current state watermark
- **THEN** the engine SHALL rebuild only that learner from the complete eligible fact sequence
- **AND** the rebuilt result SHALL equal a fresh fold of that sequence.

### Requirement: Legacy learner portraits migrate to portrait v2 with lineage
The system SHALL provide an auditable migration path from legacy
six-dimensional learner portrait data to primary seven-dimensional portrait v2
records.

#### Scenario: Legacy snapshot is migrated
- **WHEN** a legacy six-dimensional snapshot is migrated
- **THEN** the resulting portrait v2 record SHALL include source snapshot refs, mapping version, mapping confidence, limitation metadata, original timestamp, and migration timestamp
- **AND** the migration SHALL NOT claim native portrait v2 evidence when values are compatibility-derived.

#### Scenario: Migration is rerun
- **WHEN** the migration apply path runs more than once
- **THEN** it SHALL be idempotent
- **AND** it SHALL NOT duplicate portrait rows or erase source lineage.

#### Scenario: Canonical fixture account is migrated
- **WHEN** Yang Fan diagnostic fixture data is generated or migrated
- **THEN** the canonical student number and canonical email SHALL identify the target account
- **AND** display-name-only duplicate accounts SHALL NOT receive fixture overwrite data.

### Requirement: Portrait materialization has a transaction-scoped concurrency guard

The learner portrait update engine SHALL serialize the complete per-learner
snapshot read/update/write unit and SHALL acquire the required database lock
before reading the previous snapshot.

#### Scenario: Concurrent materializations target one learner

- **WHEN** two portrait materialization jobs target the same learner
- **THEN** only one job at a time SHALL read and update that learner's
  incremental snapshot baseline
- **AND** the transaction-scoped lock SHALL be released when the transaction
  commits or rolls back.

#### Scenario: Transaction lock support is unavailable

- **WHEN** the production Prisma transaction client cannot acquire the required
  advisory lock
- **THEN** portrait materialization SHALL fail closed
- **AND** it SHALL NOT write a snapshot without the concurrency guard.

### Requirement: Learner portrait consumers use portrait v2
Learner-state consumers SHALL treat portrait v2 as the primary learner portrait
for student-facing and personalization-facing behavior.

#### Scenario: Student profile is rendered
- **WHEN** a student profile or growth surface displays learner portrait data
- **THEN** it SHALL render the seven portrait v2 dimensions
- **AND** it SHALL show migrated-data limitations when values are compatibility-derived.

#### Scenario: Learner context is produced
- **WHEN** learner-state context is prepared for adaptive planning, Konling, or diagnostics
- **THEN** weak dimensions, strengths, limitations, and evidence summaries SHALL use portrait v2 ids
- **AND** legacy six-dimensional ids SHALL appear only in compatibility metadata.

#### Scenario: Evidence feature cache is used as fallback
- **WHEN** learner-state service reads `StudentEvidenceFeatureCache` or approved aggregate fallback data
- **THEN** portrait v2 payloads SHALL be versioned or marked as native portrait v2
- **AND** legacy six-dimensional `competencyVector` values SHALL NOT re-enter learner-state as primary portrait dimensions.

#### Scenario: Recommendations are generated
- **WHEN** profile or learner-state code generates personalized recommendations or `LearningRecommendation` rationale
- **THEN** weak-dimension references SHALL use portrait v2 ids, confidence, freshness, and limitation metadata
- **AND** recommendation records SHALL NOT persist legacy six-dimensional ids as primary portrait rationale.

### Requirement: Learner portrait is cumulative and evidence-triggered
The learner-state service SHALL expose one canonical cumulative portrait v2
formed from all eligible learning facts for the learner. The portrait SHALL
remain usable until governed evidence or a calculation-version change produces
a replacement state. Elapsed calendar time and activity-window membership SHALL
NOT create, replace, expire, or suppress that state.

#### Scenario: Portrait is read without newer evidence
- **WHEN** a learner has a valid cumulative portrait and no newer eligible fact
- **THEN** student, teacher, diagnosis, and class consumers SHALL receive the same portrait values
- **AND** the response SHALL expose the evidence cutoff without marking the portrait unavailable because of age.

#### Scenario: New eligible evidence is accepted
- **WHEN** a new fact passes governance and has an explicit portrait contribution
- **THEN** the learner's cumulative portrait SHALL be incrementally updated
- **AND** the update SHALL preserve unaffected dimensions and evidence lineage.

#### Scenario: Fact has no portrait contribution
- **WHEN** a fact is valid for activity history but cannot map to a portrait dimension, trend, or risk
- **THEN** it SHALL NOT change the cumulative portrait
- **AND** it SHALL NOT be counted as portrait-supporting evidence.

### Requirement: Learner portrait reconciliation is idempotent and learner-scoped
The system SHALL allow a learner or an authorized teacher to request a portrait
reconciliation that processes only eligible fact changes not yet reflected in
the learner's current state. Every task SHALL carry the active calculation
version and generation fence.

#### Scenario: Learner requests reconciliation with pending facts
- **WHEN** an authenticated learner requests portrait reconciliation and eligible pending facts exist
- **THEN** the system SHALL enqueue one idempotent learner-scoped task
- **AND** that task SHALL process the pending facts through the canonical reducer.

#### Scenario: Teacher requests class reconciliation
- **WHEN** an authorized teacher requests reconciliation for a current class
- **THEN** the system SHALL enqueue independent learner-scoped tasks for current members
- **AND** it SHALL report queued, processing, completed, no-change, and failed learner counts without combining member facts.

#### Scenario: Reconciliation has no pending fact
- **WHEN** reconciliation finds no eligible fact change beyond the learner's current watermark
- **THEN** it SHALL complete without creating a new portrait snapshot
- **AND** it SHALL NOT change scores, timestamps, trend, risk, or confidence.

#### Scenario: Superseded reconciliation task executes
- **WHEN** a queued, retrying, or in-flight reconciliation task carries a calculation version or generation fence superseded by the cumulative migration
- **THEN** the task SHALL terminate without publishing a learner portrait, growth event, diagnosis, or class materialization
- **AND** its invalidation SHALL remain auditable and retry-safe.

### Requirement: Fact transitions are append-only and learner-sequenced
The learner-state service SHALL record every governed fact transition in a
durable append-only journal with a monotonic per-user sequence, stable fact
identity, source reference, and an operation of `UPSERT`, `CORRECT`, or
`REVOKE`. It SHALL NOT update or delete the source LearningFact to express a
correction or revocation.

#### Scenario: A fact is corrected or revoked
- **WHEN** governance accepts a correction or revocation for an existing LearningFact
- **THEN** the service SHALL append a sequenced `CORRECT` or `REVOKE` transition referencing that fact
- **AND** it SHALL preserve both the source fact and every prior transition.

#### Scenario: A late transition requires rebuild
- **WHEN** a transition changes the eligible sequence at or before the learner's current state watermark
- **THEN** the service SHALL rebuild only that learner from the complete ordered transition journal
- **AND** the rebuilt snapshot, current pointer, no-evidence outcome, risk, and growth visibility SHALL derive from that same sequence.

### Requirement: Cumulative portrait snapshots remain immutable history
`StudentPortraitV2Snapshot` SHALL remain an immutable cumulative snapshot
history. Calculation-version changes, state-watermark changes, current-pointer
advances, and governed no-evidence outcomes SHALL append durable state and SHALL
NOT physically delete or mutate an earlier snapshot.

#### Scenario: Revocation removes all eligible evidence
- **WHEN** the complete governed transition sequence yields no portrait-supporting evidence
- **THEN** the service SHALL append a durable `no-evidence-after-revocation` tombstone and make it current
- **AND** prior snapshots SHALL remain stored for audit but SHALL NOT be exposed as current attainment.

#### Scenario: A new calculation version rebuilds a learner
- **WHEN** a calculation-version migration creates a replacement result
- **THEN** the service SHALL append a new immutable snapshot or no-evidence tombstone and atomically advance the versioned current pointer
- **AND** it SHALL preserve the preceding snapshots, watermarks, pointers, and source lineage.

### Requirement: Risk evidence and human disposition are independent
The learner-state service SHALL persist evidence-derived risk state separately
from teacher attention, intervention, completion, or other human disposition.
Only governed fact transitions SHALL change evidence risk.

#### Scenario: Teacher completes an intervention
- **WHEN** a teacher marks an intervention completed while the supporting risk evidence remains current
- **THEN** the human disposition SHALL change without clearing, downgrading, or overwriting the evidence risk
- **AND** authorized views SHALL be able to distinguish the risk evidence state from its disposition.

#### Scenario: Legacy unsupported risk exists
- **WHEN** migration encounters a legacy `participation` or `ai_misuse` risk
- **THEN** it SHALL preserve the record only as historical audit
- **AND** it SHALL NOT publish that record into the new cumulative portrait, diagnosis, or class risk distribution.

#### Scenario: Constraint risk remains supported
- **WHEN** a `constraint` risk has supporting governed facts and no accepted correction or revocation changes them
- **THEN** the evidence risk SHALL remain current regardless of teacher disposition or unrelated later facts
- **AND** only a `CORRECT` or `REVOKE` transition affecting its support MAY clear or replace it.

#### Scenario: Derived cumulative risks are recomputed
- **WHEN** migration or learner rebuild evaluates `stagnation` or `cross_domain` risk
- **THEN** it SHALL use only registered deterministic fact and portrait conditions
- **AND** it SHALL NOT infer either risk from elapsed time, activity-window membership, participation volume, or AI output.

### Requirement: Growth events are idempotent and invalidatable
Meaningful growth events SHALL use a stable derived identity so retries and
rebuilds cannot duplicate them. A correction or revocation SHALL invalidate a
no-longer-supported event for public reads while preserving the event,
invalidation reason, transition sequence, and source lineage for audit.

#### Scenario: Growth derivation is retried
- **WHEN** the same governed state transition is processed more than once
- **THEN** at most one growth event with that derived identity SHALL exist
- **AND** the retry SHALL NOT duplicate the public timeline or audit record.

#### Scenario: Supporting evidence is revoked
- **WHEN** a `REVOKE` or `CORRECT` transition makes a previously derived growth event unsupported
- **THEN** the event SHALL be marked invalid and excluded from student and teacher growth summaries
- **AND** the event and its invalidation history SHALL NOT be physically deleted.

### Requirement: Cumulative portrait migration is deterministic and reversible
The system SHALL provide an idempotent migration that rebuilds existing learner
portraits and current-class aggregates with the canonical cumulative reducer
without rewriting source LearningFacts. The same migration SHALL advance the
calculation/materialization version through a durable global cutover fence and
invalidate every older BullMQ pending, retrying, delayed, or in-flight learner
and class migration task.

#### Scenario: Migration is rehearsed
- **WHEN** a latest production database export is restored to an isolated local environment
- **THEN** dry-run and apply modes SHALL report stable fact, learner, portrait, class, invalidated-job, skipped, and failed counts
- **AND** rerunning the migration against the same input SHALL produce the same final portraits and aggregates.

#### Scenario: Production migration is executed
- **WHEN** local rehearsal has passed and production app, worker, and scheduler writes are stopped
- **THEN** the same migration SHALL run after backup readability, integrity, and restore steps have been verified
- **AND** services SHALL remain stopped until portrait, aggregate, and representative page verification succeeds.

#### Scenario: Production migration verification fails
- **WHEN** migration or verification fails
- **THEN** the operator SHALL restore the pre-migration database backup and previous app, worker, and scheduler version
- **AND** a partially migrated state SHALL NOT be served.


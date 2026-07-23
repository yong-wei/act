## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Historical native portraits remain visible after recent activity ends
**Reason**: Issue #989 removes the recent-window portrait boundary entirely. Keeping this requirement would preserve the false premise that recent facts define a parallel portrait lifecycle.

**Migration**: Use `Learner portrait is cumulative and evidence-triggered`; activity may be displayed newest-first but does not create a separate portrait scope.

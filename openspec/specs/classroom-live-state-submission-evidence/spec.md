# classroom-live-state-submission-evidence Specification

## Purpose
TBD - created by archiving change separate-classroom-live-state-from-submission-evidence. Update Purpose after archive.
## Requirements
### Requirement: StudentState is a live projection only

`StudentState` and teacher sync SHALL represent the current classroom view and
MAY be overwritten under their existing session/user/state key. They MUST NOT be
the authoritative source for recovering a submitted answer or attempt.

#### Scenario: A student updates live state

- **WHEN** a student changes a draft answer, parameter, or interaction position
  during class
- **THEN** the live projection MAY replace its prior value
- **AND** the write MUST NOT be reported as a durable submission.

#### Scenario: A report needs a submitted answer

- **WHEN** post-class analysis or teacher review reads a submitted response
- **THEN** it MUST use durable evidence records
- **AND** it MUST NOT require `StudentState.data.responses` or another mutable
  state field to reconstruct the attempt.

### Requirement: Submission evidence is append-oriented and classified

`StudentStepResponse` and classified `InteractionLog` records SHALL preserve
submitted values, lesson/step/card context, attempt identity, source-log
lineage, and server timestamps. Passive view/focus/reveal events MUST remain
interaction evidence unless an explicit response contract classifies them.

#### Scenario: A response-producing activity submits

- **WHEN** a student submits an objective or subjective manifest activity
- **THEN** the system MUST append a durable `StudentStepResponse` and its source
  interaction evidence with canonical response metadata
- **AND** later live-state overwrites MUST NOT erase it.

#### Scenario: A passive event is recorded

- **WHEN** a student views, focuses, or reveals a module without submitting
- **THEN** the event MUST remain `InteractionLog` evidence
- **AND** it MUST NOT become a `StudentStepResponse` or LearningFact without a
  declared scoring/response rule.

### Requirement: Identical submissions are idempotent under concurrency

Classified submissions SHALL use one non-empty deterministic submission identity
and a database-enforced conflict-safe transaction. Retries of the same identity
MUST return one durable receipt; distinct attempt identities MUST remain
separate immutable attempts.

#### Scenario: A request is retried after timeout

- **WHEN** the same student/step/attempt/client submission is sent again
- **THEN** the application MUST return the existing durable response/source-log
  identity
- **AND** it MUST NOT create a duplicate attempt or overwrite the first answer.

#### Scenario: Two identical requests race

- **WHEN** concurrent requests use the same submission identity
- **THEN** the database/application boundary MUST commit at most one response
  and source event
- **AND** both callers MUST observe an idempotent result or a retriable
  conflict, never silent loss.

#### Scenario: A student submits a new attempt

- **WHEN** the same step is submitted with a distinct valid attempt identity
- **THEN** a new immutable response MUST be retained
- **AND** reports MUST be able to distinguish it from earlier attempts.

### Requirement: Active submissions and session end share an atomic watermark

The active submission writer and the session-end writer SHALL serialize on the
same `ClassSession` row or equivalent session-scoped database lock and SHALL
use a status/CAS guard. An accepted ACTIVE submission MUST allocate a monotonic
submission/evidence sequence and persist it with its evidence in one
transaction. Ending a session MUST lock/CAS that same session, write `status`,
`endedAt`, and `acceptedSubmissionWatermark`, and stage one closure/outbox
handoff bound to that watermark in the same transaction.

#### Scenario: An active submission receives a sequence

- **WHEN** a valid submission is accepted while the session is ACTIVE
- **THEN** its durable response and source evidence MUST receive the next
  monotonic submission/evidence sequence in the same transaction
- **AND** the sequence MUST be committed before the writer releases the session
  boundary.

#### Scenario: Session end captures the accepted watermark

- **WHEN** an authorized end request wins the session lock/CAS
- **THEN** it MUST write `status`, `endedAt`, and the greatest accepted sequence
  as `acceptedSubmissionWatermark`
- **AND** it MUST stage exactly one idempotent closure/outbox handoff bound to
  that watermark.

#### Scenario: Submit and end race on the same session

- **WHEN** a submission and end request execute concurrently
- **THEN** a submission that commits first MUST be at or below the captured
  watermark, while a request that observes the ended status MUST not receive an
  ACTIVE acceptance sequence
- **AND** neither outcome may silently lose evidence or ambiguously include a
  late event in the original closure.

### Requirement: Late events and watermark-bounded workers are explicit

Evidence arriving after `acceptedSubmissionWatermark` SHALL be retained only
with an explicit `POST_SESSION_REVIEW` status or equivalent classification. It
MUST NOT alter the original classroom closure or its default report. A later
report MAY include it only through an explicitly identified recompute revision
and input watermark. Closure workers SHALL consume only accepted evidence at
or below the staged watermark and SHALL be idempotent for repeated delivery.

#### Scenario: A submission arrives after session end

- **WHEN** a request arrives after the session has ended or its accepted
  watermark is fixed
- **THEN** any retained event MUST be marked `POST_SESSION_REVIEW` (or an
  equivalent explicit status)
- **AND** the original closure and default report MUST exclude it.

#### Scenario: A report explicitly recomputes after late review

- **WHEN** an authorized report operation requests a new recompute revision
- **THEN** it MUST name the revision and additional input watermark/event set
  that includes post-session review events
- **AND** the original closure revision MUST remain unchanged and separately
  reportable.

#### Scenario: A closure worker is redelivered

- **WHEN** the same watermark-bound closure outbox item is delivered more than
  once
- **THEN** the worker MUST process the bounded evidence and materialization
  idempotently
- **AND** it MUST not double-count evidence or widen the watermark.

### Requirement: Preview and read-only paths cannot write student evidence

Teacher preview and other read-only runtime paths SHALL be unable to create or
update `StudentState`, `InteractionLog`, `StudentStepResponse`, or
`LearningFact` records.

#### Scenario: A teacher previews an activity

- **WHEN** a teacher renders or interacts with a preview context
- **THEN** runtime content and role-safe projection MAY be read
- **AND** the database MUST contain no student state, submission, interaction,
  or learning-fact write caused by that preview.

#### Scenario: A preview attempts submission

- **WHEN** preview code invokes a submission-capable component
- **THEN** the write port MUST reject the operation with an explicit read-only
  reason
- **AND** no fallback path may write evidence directly.

### Requirement: Evidence lineage is preserved through materialization

Accepted evidence SHALL retain source event id/client event id, attempt key,
canonical lesson and step identity, and server ordering needed to materialize
the existing governed `LearningFact` contract. Materialization MUST be
idempotent and MUST NOT invent facts from mutable state.

#### Scenario: Evidence is materialized after class

- **WHEN** the outbox/worker consumes an accepted submission
- **THEN** it MUST link the fact to the durable source evidence and preserve the
  existing Learning Record identity rules
- **AND** a repeated worker delivery MUST not double-count the fact.

#### Scenario: Evidence lacks supported scoring inputs

- **WHEN** a response is subjective or has no reference answer
- **THEN** the materialized result MUST retain an explicit unsupported/subjective
  status
- **AND** it MUST NOT fabricate a zero score or mastery fact.

### Requirement: Session finalization and worker phases are observable

Ending a session SHALL be idempotent and SHALL hand off the
`acceptedSubmissionWatermark`-bounded bundle/session evidence to the existing
outbox/worker boundary. Reports MUST distinguish captured, materialized,
summarized, and cached phases, including partial failures, and MUST preserve
the original closure separately from later recompute revisions.

#### Scenario: A session ends successfully

- **WHEN** an authorized teacher ends an active classroom
- **THEN** lifecycle state MUST change once, `acceptedSubmissionWatermark` MUST
  be fixed, and one idempotent watermark-bound post-class handoff MUST be
  available
- **AND** subsequent delivery MUST preserve the same phase statuses.

#### Scenario: A worker phase fails

- **WHEN** materialization, summary, or cache refresh fails
- **THEN** the report MUST expose the failed/incomplete phase and reason
- **AND** it MUST NOT claim that missing evidence was generated from live state.

### Requirement: Live/evidence migration has a closed writer denominator

The implementation SHALL inventory every live-state writer/reader, teacher sync
path, response-producing page, event branch, evidence writer/materializer,
preview route, session-end path, worker, report, and cache consumer. Each entry
MUST have a classification, owner, transaction/dedupe key, replacement, and
deletion condition.

#### Scenario: A state-as-evidence reader remains

- **WHEN** a report or worker still recovers submitted answers only from mutable
  `StudentState`
- **THEN** the migration MUST remain unqualified
- **AND** the reader MUST be migrated before compatibility removal.

#### Scenario: A duplicate idempotency authority is removed

- **WHEN** all classified submissions use the durable identity and transaction
  boundary
- **THEN** the old check-then-insert or duplicate writer MUST be deleted
- **AND** its zero-consumer evidence MUST be recorded in the ledger.

### Requirement: Focused, domain, and browser verification is mandatory

The change SHALL pass reducer/classification tests, real-PostgreSQL concurrency
tests, preview zero-write tests, lineage/materialization/finalization tests,
affected Classroom/Interactive/Data-Governance tests, and browser acceptance.

#### Scenario: Durable attempts survive refresh and overwrite

- **WHEN** a student submits, resubmits, refreshes, and updates live state
- **THEN** every distinct durable attempt MUST remain visible to teacher/report
  consumers
- **AND** the mutable projection MAY show only the latest current view.

#### Scenario: Late evidence is not mixed into the original closure

- **WHEN** a submission arrives after end and a later report is requested
- **THEN** the default report MUST exclude the `POST_SESSION_REVIEW` event
- **AND** only an explicit recompute revision may include it without changing
  the original closure report.

#### Scenario: Strict validation is run

- **WHEN** `openspec validate separate-classroom-live-state-from-submission-
  evidence --type change --strict` and `git diff --check` are run
- **THEN** the live/evidence denominator, migration/deletion ledger, and test
  evidence MUST be complete.


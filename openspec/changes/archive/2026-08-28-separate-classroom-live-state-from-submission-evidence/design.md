## Context

`StudentState` is persisted per session/user/state key and is used by the
session state route and interactive session hooks as a current classroom view.
Its JSON currently accommodates answers, parameters, and operation data. The
interactive event route also writes `InteractionLog`, builds
`StudentStepResponse`, and materializes `LearningFact`; the latter two records
have different durability and analysis meanings. Existing evidence builders
already classify browsing, answer, feedback, and teacher events, but the
database/application boundary does not yet make concurrent submission identity
fully unique. It also needs one ordering boundary shared by active submission
and session end so that a closure report cannot race an accepted response.

The change consumes the extracted classroom session use cases. It closes the
live-state/evidence boundary and submission race without redesigning the whole
Learning Record domain, path planning, or recommendation state.

## Goals / Non-Goals

**Goals:**

- Treat `StudentState` and teacher sync as replaceable live projections.
- Treat `StudentStepResponse` and classified `InteractionLog` rows as durable,
  append-oriented evidence, with `LearningFact` as a governed derived fact.
- Make retries and concurrent identical submissions idempotent while preserving
  distinct attempts and complete source lineage.
- Ensure previews and read-only render paths produce no student state/evidence.
- Keep end/outbox/worker/report/cache phase boundaries observable and idempotent.
- Establish a database-transaction watermark that makes the submit-vs-end
  ordering explicit and bounds the original classroom closure.

**Non-Goals:**

- Replacing `LearningFact` as the evidence authority or rewriting its full
  domain.
- Treating every interaction/view as a submission or mastery fact.
- Changing the existing manifest response vocabulary, teacher role projection,
  or finalization quality metric names.
- Event-sourcing every internal state update or introducing a second event bus.

## Decisions

### 1. Use explicit write contracts for three classes of data

Define three application ports:

1. `LiveStateWriter` accepts a session/user/state key and a current projection;
   writes may replace a prior row under the existing unique key.
2. `SubmissionEvidenceWriter` accepts a canonical submission identity, step,
   attempt, response envelope, and source event metadata; writes append-only
   records and returns an existing receipt for an idempotent retry.
3. `LearningFactMaterializer` consumes accepted evidence and writes the existing
   governed fact under its current identity/lineage contract.

The ports make it impossible for a page to treat a successful state patch as a
successful submission. Draft answers may remain in live state for UX, but all
reports and post-class readers use `StudentStepResponse`/`InteractionLog` and
their explicit classification.

### 2. Persist one deterministic submission identity and active sequence

For a response-producing event, derive a non-empty identity from session,
student, lesson/step/card, attempt key, and client event identity according to
the existing submission contract. Persist it on the durable response/source
record and enforce uniqueness at the database boundary. The transaction locks
the session while it verifies `status=ACTIVE`, allocates the next monotonic
`submission/evidence sequence`, and inserts the source `InteractionLog`, the
`StudentStepResponse`, and an outbox/materialize handoff as one idempotent
operation. A conflict returns the original durable receipt rather than
overwriting it. The sequence is committed in the same transaction as the
accepted evidence; it is not assigned after the transaction or by a report
worker.

If a client retries after a network timeout, the same identity yields one
attempt. A new attempt key yields another immutable response, even when the
answer is identical. Passive views/focus/reveal events retain their existing
`InteractionLog` classification and do not become `StudentStepResponse` or
`LearningFact` without an explicit response rule.

An application-only “check then insert” was rejected because two requests can
pass the check concurrently. A global event rewrite was rejected because it
would exceed this change and duplicate Learning Record authority.

### 3. Make submission and session end one atomic watermark boundary

The active submission writer and session-end writer serialize on the same
`ClassSession` row (or an equivalent session-scoped lock) and use a
status/CAS guard. An ACTIVE submission transaction obtains the next monotonic
sequence and commits its evidence before releasing the lock. The end
transaction obtains the same lock, succeeds only for the expected active
version, writes `status`, `endedAt`, and `acceptedSubmissionWatermark` in that
transaction, and stages one closure/outbox record bound to that exact
watermark. An already-ended request returns the existing watermark and does
not stage a new closure.

If the submission commits first, its sequence is at or below the watermark. If
end commits first, a later submission cannot obtain an ACTIVE acceptance
sequence. The writer must make that decision atomically; a late request may
still be retained as evidence, but it is classified `POST_SESSION_REVIEW` (or
an equivalent explicit status), does not move the accepted watermark, and is
excluded from the original classroom closure by default.

The worker consumes the staged closure using `(sessionId, closureRevision,
acceptedSubmissionWatermark)` as an idempotency scope and selects only accepted
evidence at or below that watermark. A redelivery cannot double-count a row or
silently widen the closure. A later report may include post-session review
events only when an explicit recompute revision names that revision and its
additional watermark/input set; ordinary closure reads never mix them in.

An end implementation that updates status first and discovers the watermark
later was rejected because a concurrent submit could be ambiguously included.
An application-only timestamp cutoff was rejected because clock order is not a
database acceptance boundary.

### 4. Make preview isolation explicit

Preview routes/pages receive a read-only context recognized by the application
ports. A preview may load runtime content, project role-safe data, and render
components, but no code path in that context may call `LiveStateWriter`,
`SubmissionEvidenceWriter`, event ingestion, or LearningFact materialization.
Tests assert zero writes, not merely an empty response. A student/player
session context remains write-enabled only after authenticated session access
is authorized by the extracted Classroom use case.

### 5. Keep finalization and workers phase-oriented

Session end uses the atomic watermark boundary, then emits the idempotent
post-class handoff containing session, bundle identity, closure revision, and
accepted watermark. An outbox/worker materializes only accepted evidence in
that bounded set and refreshes existing report/snapshot/cache phases. The
report exposes captured/materialized/summarized/cached status and partial
failure; it never fills missing answers from mutable state. Internal operations
remain direct calls unless they cross the durable worker boundary.

### 6. Preserve evidence privacy and role projections

Evidence and reports retain canonical lesson/step/attempt lineage but follow the
existing privacy-safe payload and teacher/student projection rules. Raw answer
or event payloads are not added to public status output. The student projection
cannot see teacher-only state, and teacher preview cannot create student rows.

## Denominator and Characterization

Freeze every `StudentState` writer/reader, teacher sync writer, response-producing
manifest/course page, `/api/interactive/events` branch, submission controller,
evidence builder/materializer, preview route, session-end path, session lock/CAS
writer, sequence/watermark fields, closure staging/outbox/worker, report
recompute path, and cache consumer. Record field classification, dedupe key,
transaction boundary, sequence allocation, watermark decision, retry behavior,
sourceLog linkage, late-event classification, and current quality/readiness
metrics. Include both static call sites and browser-triggered submissions.

## Vertical Migration and Deletion

First add the explicit ports, sequence/watermark receipts, and transaction
boundary behind existing writers; then migrate live state, passive event, and
submission evidence paths separately. Once all readers stop using
`StudentState.data` to recover submitted answers, delete that fallback and any
duplicate idempotency helper. Retire compatibility payloads only after a
zero-consumer ledger check. A rollback may route new writes through the prior
adapter but must not delete accepted evidence, lower a watermark, or overwrite
attempts.

## Targeted and Domain Verification

Run reducer/contract tests for live projection and evidence classification,
duplicate/retry tests, real-PostgreSQL concurrent submission and submit-vs-end
tests, sequence monotonicity and watermark-boundary tests, source-log lineage
tests, outbox/materializer idempotency and worker-redelivery tests, finalization
phase and late-event classification tests, explicit report-recompute tests,
preview zero-write tests, privacy projection tests, and session report tests.
Then run affected Classroom/Interactive/Data-Governance domain suites,
typecheck, and `openspec validate
separate-classroom-live-state-from-submission-evidence --type change --strict`,
followed by `git diff --check`.

## Browser Acceptance

In a representative manifest activity, submit, resubmit with a new attempt,
refresh, and overwrite unrelated live state. Verify the teacher projection and
post-class report show both durable attempts and the expected quality state.
Open the same activity in teacher preview and confirm no `StudentState`,
`InteractionLog`, `StudentStepResponse`, or `LearningFact` row is created. Kill
or disconnect the submission request and retry to prove idempotent behavior.
Exercise a submit-vs-end race and verify the closure includes exactly the
accepted watermark, worker redelivery is idempotent, a report recompute is an
explicit new revision, and a late event is marked `POST_SESSION_REVIEW` and is
not mixed into the original closure.

## Ledger

Record every live/evidence writer, classification, identity formula, database
constraint, source-log lineage, preview entry, session lock/CAS path, sequence
allocation, accepted watermark, closure staging/outbox handoff, late-event
status, worker idempotency key, report phase/recompute revision, owner,
migration status, deletion condition, and test/browser evidence. Keep Learning
Record changes explicitly scoped so later consumers can distinguish this ledger
from a global LearningFact migration.

## Migration Plan

1. Verify the bundle and classroom application-service contracts and freeze the
   writer/reader denominator.
2. Add typed write ports, durable submission identity, conflict-safe transaction
   behavior, the active submission sequence, and preview context without
   changing current UI behavior.
3. Implement session lock/CAS end, `acceptedSubmissionWatermark`, closure
   staging, watermark-bounded worker consumption, explicit late-event status,
   and recompute revision semantics.
4. Migrate live state and evidence producers, then migrate reports and workers
   to durable evidence-only reads.
5. Run submit-vs-end, worker redelivery, report recompute, privacy,
   finalization, and browser gates; delete fallback state-as-evidence paths
   after zero-consumer evidence.
6. Hand the qualified submission/live boundary to the shared classroom-shell
   pilot.

Rollback is limited to an adapter-level switch before compatibility deletion;
all durable accepted rows remain immutable and reportable, and an accepted
watermark can never be lowered.

## Open Questions

None blocking. The implementation must choose the concrete unique key/column
shape compatible with PostgreSQL null semantics and the concrete closure staging
table, but classified submissions must be non-null, sequence allocation and
watermark decision must be enforced in the same session-scoped transaction
boundary, and worker/report recomputation must retain explicit revisions.

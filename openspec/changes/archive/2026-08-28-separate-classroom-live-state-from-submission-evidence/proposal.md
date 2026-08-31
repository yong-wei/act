## Why

`StudentState` is a mutable classroom projection, but it currently carries answer and interaction data that downstream code may mistake for durable submission evidence. Interactive event ingestion writes `InteractionLog`, `StudentStepResponse`, and `LearningFact` through related paths, while concurrent idempotency is not fully closed. A refresh, overwrite, or race must never erase a submitted answer or fabricate evidence.

## What Changes

- Define `StudentState` and teacher sync as overwriteable live projections for the current classroom view only.
- Define `StudentStepResponse` and `InteractionLog` as append-oriented evidence with explicit event classification; `LearningFact` remains the governed derived fact and is not redefined here.
- Make submission identity and database writes idempotent under retries and concurrent requests without overwriting earlier attempts; preserve answer, step, attempt, source-log, and server-time lineage.
- Define one database atomic boundary between active submission and session end: active submissions receive a monotonic submission/evidence sequence, while end locks/CASes the same session and stages `acceptedSubmissionWatermark` with its outbox handoff.
- Classify events arriving after the accepted watermark as `POST_SESSION_REVIEW` (or an equivalent explicit status); they are excluded from the original closure by default and enter later reports only through an explicit recompute revision.
- Make preview/read-only paths unable to create student state, submissions, interaction logs, or learning facts.
- Stabilize session end, watermark-bounded outbox/worker, materialization, reporting, and cache boundaries so partial closure is observable and never represented as complete evidence.

## Capabilities

### New Capabilities

- `classroom-live-state-submission-evidence`: Defines live-state versus evidence ownership, append/idempotency semantics, preview isolation, and finalization/outbox boundaries.

### Modified Capabilities

None. `manifest-submission-evidence`, `interactive-governance-evidence`, `session-finalization-quality`, `session-governance-readiness`, `submission-evidence-quality`, and `trusted-learning-fact-filter` remain authoritative and are tightened only through their existing contracts.

## Impact

- Affects the session state route and hooks, teacher sync, `/api/interactive/events`, submission controller/evidence builders, `StudentState`/`StudentStepResponse`/`InteractionLog` persistence, LearningFact materialization adapters, finalization/outbox workers, and session reports.
- Denominator: all live-state read/write producers, all response-producing manifest and course pages, every evidence writer/materializer, the active-submit and session-end transaction writers, watermark/outbox/worker/report recompute consumers, all preview routes, and every retry/concurrency path. The implementation inventory must close both static writers and database race paths.
- Depends on `extract-classroom-session-application-service`; it must use the extracted session lifecycle/access use cases and preserve the course-bundle binding.

## Scope and Evidence

- **Characterization:** capture which fields are currently written to mutable state, all event classifications, dedupe keys, retry behavior, preview calls, session-end ordering, existing evidence-quality/readiness metrics, and the submit-vs-end race behavior.
- **Migration and deletion:** introduce explicit write ports and the sequence/watermark boundary, migrate producers by evidence class, remove state-as-evidence reads and duplicate idempotency authorities, and retire compatibility payloads only after the ledger denominator is zero. Do not rewrite the Learning Record domain globally.
- **Verification:** add deterministic reducer tests, concurrent real-PostgreSQL submission and submit-vs-end tests, duplicate/retry tests, preview non-write tests, lineage/materialization tests, watermark-bounded finalization/outbox/worker redelivery tests, explicit report-recompute and late-event exclusion tests, affected domain tests, typecheck, and strict OpenSpec validation.
- **Browser acceptance:** submit and resubmit from a representative manifest activity, refresh/overwrite live state, inspect teacher projection and post-class report, and verify every attempt remains durable while preview creates no student evidence. Pair this with database submit-vs-end, worker re-delivery, report recompute, and late-event negative cases.
- **Ledger:** record each state/evidence writer, classification, dedupe key, transaction boundary, worker handoff, preview entry, migration state, and deletion proof. No claim or production activation is part of this change.

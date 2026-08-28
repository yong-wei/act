## 1. Freeze And Classify The Denominator

- [x] 1.1 Freeze the source revision/tree and enumerate assignment-bound and
  unbound historical/demo data, including every
  `LearningEvidenceDraft(sourceType=document_rubric_grading)` row and every
  associated `LearningFact` materialized by the old approval path.
- [x] 1.2 Enumerate related `GradingRun`, approval snapshot, derivative,
  release, `GradingJob`, teacher-review outbox, and evidence-outbox records,
  plus associated `LearningFact` ids, `sourceEventId`, `sourceLogId`, source
  locators, and competency-contribution digests, with run ids,
  revision/content/source hashes, states, and retention class.
- [x] 1.3 Inventory every legacy route, alias/deep link, flag, component,
  script, capture fixture, spec, test, worker registration, and observed usage
  caller; distinguish governance migration/repair scripts that must remain.
- [x] 1.4 Define the usage/data/log observation window, privacy-safe queries,
  route-inventory hash, fact/source-event query hash, per-row disposition
  schema, and rollback rehearsal inputs before deletion.

## 2. Assignment-Bound Migration And Historical Boundary

- [x] 2.1 Resolve each valid assignment-bound record to Assignment, published
  revision, question, submission, answer, attempt, grading run, rubric,
  student ownership, teacher authorization, and source checksum.
- [x] 2.2 Migrate assignment-bound review/feedback callers and records through
  the Assignment public API and existing approval snapshot/outbox contract.
- [x] 2.3 Block or migrate unapproved/unverifiable rows with explicit reasons;
  do not infer approval from a draft, route response, or `reviewerState` alone.
- [x] 2.4 Retain approved unbound history only with an immutable approval
  snapshot or explicit read-only proof and register a non-writing historical
  adapter with owner, privacy scope, and deletion condition.
- [x] 2.5 Fence legacy producers and drain, cancel, or account for all legacy
  worker/outbox jobs and retries without deleting governed audit history.
- [x] 2.6 Create a reviewable one-to-one mapping from each legacy draft to an
  existing approval snapshot or named historical authority, including every
  associated fact id, unique `sourceEventId`, source checksum, criterion
  locator, and data-completeness-audit parse path.
- [x] 2.7 Preserve existing non-null `sourceEventId` values and use only a
  reviewed, deterministic, idempotent identity-enrichment step for nullable
  historical values; block collisions or unparseable sources and never create
  a replacement fact to resolve them.
- [x] 2.8 Classify materialized versus unmaterialized criterion evidence and
  suppress criterion writeback/`EvidenceOutbox` replay for materialized facts;
  route any missing evidence to a separately governed repair disposition.

## 3. Route And Reference Retirement

- [x] 3.1 Remove the legacy approve and writeback-preview fallback only after
  all valid callers use the Assignment public API and the closed usage window
  proves zero legacy writes.
- [x] 3.2 Remove the teacher grading-workbench/demo and student
  `/assessment/document-feedback` old shells, calls, aliases, flags, and
  capture references after their dispositions are closed.
- [x] 3.3 Update route inventory, deep-link redirects, scripts, tests, and
  specs to the replacement or controlled historical boundary; remove only
  obsolete references.
- [x] 3.4 Preserve migration/repair scripts, generic `LearningEvidenceDraft`,
  approved feedback, original submission checksums, immutable lineage, audit,
  governed outbox records, and associated `LearningFact` rows whose owners
  still require them.
- [x] 3.5 Add a source-level no-facade/no-hidden-fallback proof covering
  imports, routes, flags, scripts, workers, dynamic links, and test fixtures.

## 4. Closure Evidence And Verification

- [x] 4.1 Re-run data, route, caller, worker, script, capture, and spec
  inventories and emit a deletion/retention receipt with source/tree,
  run/revision/hash, draft/fact counts, unique source-event hashes,
  source-parse results, contribution/profile digests, and disposition
  identities.
- [x] 4.2 Verify the closed usage/data/log window has zero fallback reads/writes
  or only explicitly counted historical-adapter reads and no new legacy run
  ids.
- [x] 4.3 Exercise rollback rehearsal: disable cleanup, read retained history,
  preserve Assignment snapshots/checksums/audits/outboxes, and prove no second
  grading authority is restored.
- [x] 4.4 Add regression tests for associated-fact counts, globally unique
  `sourceEventId`, source-to-draft/authority parseability, and before/after
  fact-set and learner-profile contribution parity.
- [x] 4.5 Add privacy, authorization, idempotency, no-replay, worker fencing,
  migration, route-410, historical-adapter, and data-preservation tests,
  including a duplicate/replayed criterion-evidence counterexample.
- [x] 4.6 Run focused data-governance/assignment tests, typecheck, strict
  OpenSpec validation, and `git diff --check`; externalize run-specific QA
  output and retain only revision/hash/conclusion receipts.

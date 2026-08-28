## Context

The native pipeline now uses `GradingRun`/`AnswerEvidence`, while legacy
document routes still read or write generic `LearningEvidenceDraft` rows with
`sourceType` and `factType` `document_rubric_grading`.  The remaining surfaces
include:

- `/api/teacher/document-grading/approve`,
  `/api/teacher/document-grading/writeback-preview`, and the old
  `/api/teacher/document-grading/submissions` fallback;
- the teacher `/teacher/grading-workbench` page and demo components; and
- the student `/assessment/document-feedback` page and document-rubric UI.

The Assignment public review API and its approval snapshots are the target for
assignment-bound records.  Existing historical documents, source checksums,
approved feedback, LearningFact/evidence lineage, worker/outbox records, and
governance repair scripts may have value after the route is gone.  The old
approval path may already have materialized criterion evidence as
`LearningFact` rows; those facts are part of the retirement denominator and
must not be treated as new writeback work.

## Goals / Non-Goals

**Goals:**

- Close a frozen, evidence-backed denominator before any code or data deletion.
- Migrate assignment-bound callers and records to the Assignment review
  authority and isolate unbound history behind a controlled read-only boundary.
- Delete obsolete production bridges only when usage, data, logs, identity,
  worker, and rollback gates are closed.
- Preserve approved history, original submission checksums, immutable lineage,
  audits, governed outbox evidence, and every associated `LearningFact` with a
  parseable source identity and unchanged portrait contribution.
- Prove that already materialized criterion evidence is mapped exactly once
  and is not replayed into a second fact or learner-profile contribution.
- Leave no unowned fallback that can silently treat a draft as approval or
  final feedback.

**Non-Goals:**

- Recomputing historical LearningFact, changing scores, changing the review
  formula, or deleting valid approved feedback/submissions.
- Replaying already materialized criterion evidence or silently changing a
  retained fact's `competencyContribution` is out of scope.
- Dropping the generic `LearningEvidenceDraft` model or all
  `document_rubric_grading` historical rows.
- Deleting migration/repair scripts that still serve data-governance purposes.
- Replacing the Assignment review state machine or creating a new archive
  schema, worker, provider, or publication path.
- Treating the existing `410` response, a route rename, or a passing unit test
  as sufficient retirement proof.

## Decisions

### 1. Freeze the full denominator and classify every record

The first artifact records source revision/tree, query definitions, counts and
hashes for:

1. assignment-bound rows with valid assignment/revision/question/submission/
   attempt identity;
2. unbound or historically migrated rows, including demo/synthetic records;
3. `LearningEvidenceDraft` rows with `sourceType=document_rubric_grading`,
   their reviewer state, source/fact refs, approval/feedback lineage, and
   every associated `LearningFact`, including its fact id, `sourceEventId`,
   `sourceLogId`, fact type, source/context locator, contribution digest, and
   portrait-relevant user scope;
4. native `GradingRun`, `TeacherAssignmentApprovalSnapshot`, derivative,
   release, `GradingJob`, `TeacherAssignmentReviewOutbox`, and `EvidenceOutbox`
   records related to those rows; and
5. every route, API, component, import, alias, flag, script, capture fixture,
   spec, and test reference.

Each entry has an owner, run/revision/hash identity, disposition, retention
class, and evidence reference.  The data receipt records query definitions,
row counts, canonical hashes, and per-row dispositions for both drafts and
associated facts.  A fact disposition distinguishes `preserve-materialized`,
`map-to-snapshot`, `map-to-historical-authority`, `blocked-unparseable`, and
`retained-governance`.  Counts cannot be inferred from the `410` route or from
a source-name grep alone.

### 2. Migrate assignment-bound data through the new authority

For a valid assignment-bound legacy record, resolve Assignment, published
revision, question, submission, answer, attempt, grading run, rubric/content
hash, student ownership, and teacher authorization.  Reuse the Assignment
review API to create or reconcile the existing review/approval snapshot and
outbox lineage.  Preserve the original source checksum and record the
old-to-new identity mapping; never rewrite a published revision or score.

Rows that cannot prove this identity are blocked from production mutation or
student release.  Unapproved rows may be migrated into a blocked state with a
reason, but cannot be silently approved.

For each legacy draft, the migration writes a reviewable mapping from the old
draft identity to exactly one existing `TeacherAssignmentApprovalSnapshot` or
one explicitly named read-only historical authority.  The mapping includes
the old draft id, target authority id/kind, associated fact ids,
`sourceEventId` values, source checksum, criterion/evidence locator, and
disposition.  It is sufficient for the data-completeness audit to resolve an
old `LearningFact` back to its draft and target authority without parsing a
deleted route or a provider payload.

Every retained or migrated fact must have one unique, deterministic,
parseable `sourceEventId`.  Existing non-null values are preserved.  A
nullable historical value may be filled only by a reviewed, idempotent
identity-enrichment step derived from the immutable draft/source checksum and
criterion locator; a collision or missing locator blocks the row and never
creates a replacement fact.  The database uniqueness constraint is a final
guard, not a substitute for the mapping receipt.

If criterion evidence is already materialized in `LearningFact`, the
migration records the one-to-one mapping and preserves its payload,
`competencyContribution`, timestamps, source references, and audit lineage.
It does not invoke criterion writeback, replay an `EvidenceOutbox` event, or
create another fact.  A missing, unparseable, or unmaterialized criterion is
blocked for a separately governed repair; this retirement change does not
backfill it by replay.

### 3. Keep unbound history read-only and explicit

An unbound historical/demo row may remain only behind a separately named,
read-only historical adapter with owner, reason, retention, and deletion
condition.  It cannot be reached through current assignment routes, cannot
write `LearningFact`, cannot produce a new approval, and must not be presented
as a live assignment review.  Approved history requires an approval snapshot
or a documented read-only proof of reviewer, score, source checksum, and
immutable lineage, plus a parseable one-to-one mapping for any associated
`LearningFact`; otherwise it remains blocked.

### 4. Gate deletion on actual use, identity, and recovery evidence

Actual source/route/UI deletion requires all of the following in one
retirement receipt:

- every valid production caller is migrated or explicitly retained as the
  controlled historical adapter;
- the agreed usage/data/log observation window is closed, with zero fallback
  reads/writes or only counted adapter reads and no new legacy run ids;
- source revision/tree, route inventory hash, data query hash, run ids,
  snapshot/revision hashes, `LearningFact` counts/source-event hashes,
  competency-contribution/profile digests, and retained/deleted counts match;
- all active legacy worker/outbox jobs are drained, cancelled, or fenced and
  their outcomes are auditable, with no criterion-evidence replay; and
- a rollback rehearsal proves the new Assignment path can be disabled and
  preserved records can still be read without restoring the deleted bridge.

If any gate is missing, code remains present but blocked from new writes.

### 5. Separate hard, contract, soft, and removable boundaries

- **Hard:** student ownership/privacy, approved-snapshot/score authority,
  source checksum and immutable lineage, one-to-one `LearningFact` source
  identity, unchanged materialized contributions, audit/outbox retention, and
  no unapproved writeback or evidence replay.
- **Contract:** explicit replacement routes, adapter disposition, route
  inventory, usage receipt, draft-to-authority/fact mapping, data-completeness
  parseability, and worker fencing.
- **Soft:** explanatory copy, demo labels, and non-authoritative display
  affordances after their callers are classified.
- **Removable:** old route files, aliases, flags, demo shells, wrappers, and
  tests/capture references with no governed purpose after the gates close.

The generic model and a migration/repair script are not removable merely
because their names contain `document` or `legacy`; their current consumer
and governance purpose must be proven first.

### 6. Prove no facade and no hidden fallback

The structural test scans production imports, route inventory, package scripts,
feature flags, dynamic route links, worker registrations, and tests.  It must
show that assignment-bound calls use the Assignment public API, no deleted
route remains registered, and any retained adapter is read-only, historical,
explicitly named, and unable to invoke approve/writeback or a LearningFact
writer.  It also checks that every retained fact maps to one authority and
that no replayable criterion-evidence outbox path remains.  A redirect or a
thin wrapper to the old workbench is not a retirement proof.

### 7. Preserve privacy and external QA boundaries

Logs and receipts expose only pseudonymous counts, hashes, state codes, route
identities, and retention decisions.  They exclude answer bodies, document
bytes, provider payloads, user identifiers, credentials, and local absolute
paths.  Run-specific QA outputs remain external and cannot serve as score,
approval, or LearningFact evidence.

## Risks / Trade-offs

- [Risk] A valid historical record is deleted with an obsolete shell. →
  Require snapshot/checksum/lineage proof and immutable retention before code
  deletion; retain an adapter when proof is incomplete.
- [Risk] Old worker retries recreate fallback rows during migration. → Fence
  legacy producers, drain queues, and test duplicate/replayed jobs after the
  cutover; reject any retry that would rematerialize a criterion fact.
- [Risk] A materialized `LearningFact` is omitted from the denominator or
  replayed through the new authority. → Hash associated fact ids,
  `sourceEventId`, source locators, and competency contributions before and
  after migration; require exact one-to-one mapping and profile parity.
- [Risk] A hidden deep link keeps production usage non-zero. → Search route
  inventory, source, scripts, capture manifests, logs, and observed request
  ids during the closed window.
- [Risk] A migration script is removed despite an active governance role. →
  Record current consumers and purpose; classify it retained unless an owner
  signs a separate deletion receipt.
- [Trade-off] Some unbound demo history remains accessible to operators. →
  Make it explicit read-only, non-production, privacy-scoped, and subject to a
  separate retention decision.

## Migration Plan

1. Freeze denominator queries, route/import inventory, source revision/tree,
   data/run/hash identities, associated `LearningFact` count/source-event/
   contribution digests, worker/outbox set, and usage/data/log window.
2. Publish the replacement Assignment API contract and migrate valid
   assignment-bound routes, UI callers, data records, and tests vertically.
3. Build and validate the one-to-one legacy draft → approval snapshot or
   historical-authority mapping, including every associated fact and the
   source locators required by the data-completeness audit.
4. Block unapproved, unverifiable, colliding, or unparseable rows; preserve
   materialized facts without replay and register the controlled read-only
   adapter for approved unbound history.
5. Fence/drain legacy producers and outboxes, close the observation window,
   compare before/after fact-set and learner-profile contribution digests,
   and run the route/import/flag/script/capture/spec inventory again.
6. Perform rollback rehearsal and record retention/deletion receipt.  Only
   then remove obsolete production routes, shells, aliases, flags, wrappers,
   and references; retain governed migration/repair scripts and data.
7. Run privacy, authorization, idempotency, data-preservation, no-replay,
   worker, route-inventory, source-boundary, focused tests, typecheck, and
   strict OpenSpec validation.

Rollback stops new retirement deletions and disables legacy cleanup while the
Assignment public API remains the only write path.  Deleted source files are
restored only from the reviewed commit/artifact, never by recreating a second
grading authority; retained data, snapshots, checksums, audits, outbox
records, `LearningFact` rows, source-event mappings, and learner-profile
contribution history are not rolled back destructively.  A failed mapping or
parity check leaves the row blocked rather than replaying evidence.

## Open Questions

The observation-window duration and exact historical adapter storage location
must be recorded by the implementation owner before deletion.  The gates,
identity fields, retention rules, and no-facade requirement are fixed; an
unresolved window keeps retirement blocked.

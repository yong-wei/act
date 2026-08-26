## 1. Freeze The Cross-Domain Denominator

- [ ] 1.1 Freeze the source revision/tree and enumerate Assessment,
  Assignment-rubric, Smart Lesson, and Smart Courseware owners, routes, APIs,
  models, workers, scripts, tests, UI surfaces, and cross-domain callers.
- [ ] 1.2 Record each domain's local draft/candidate identity, validation
  receipt, human action, immutable revision/snapshot, publication receipt,
  privacy class, idempotency boundary, and rollback owner.
- [ ] 1.3 Record all prohibited authority sinks and direct imports/writes to
  catalog, score, student feedback, LearningFact, and production selectors.
- [ ] 1.4 Bind the matrix and receipts to one source/tree revision and mark
  missing, mixed, or stale evidence as BLOCKED/NOT_QUALIFIED.

## 2. Invariant Contract And Matrix

- [ ] 2.1 Define the domain-neutral invariant vocabulary for editable draft,
  deterministic validation, human acceptance, immutable revision, publication
  receipt, no direct authority write, and domain ownership.
- [ ] 2.2 Define the single domain-to-invariant matrix schema and privacy-safe
  receipt fields; do not add a persisted global candidate or state model.
- [ ] 2.3 Map Assignment rubric generation to the Assignment public API and
  immutable question/rubric revision without coupling this change to the
  Assignment migration chain.
- [ ] 2.4 Map Smart Lesson and Smart Courseware to their existing services,
  states, revisions, workers, and publication contracts without state
  translation or cross-domain ownership.
- [ ] 2.5 Map Assessment to #1564 and keep the row blocked until its concrete
  draft/precheck/human-review/catalog-publication evidence qualifies; do not
  implement Assessment here.

## 3. Read-Only Architecture Fitness Checks

- [ ] 3.1 Implement source/import checks for cross-domain deep imports,
  provider-to-authority writes, route/UI bypasses, shared candidate/state
  attempts, and unowned callers.
- [ ] 3.2 Implement matrix/receipt checks for exact draft hashes, source
  identity, human decision, immutable revision/snapshot, publication identity,
  authorization, privacy, and idempotency evidence.
- [ ] 3.3 Ensure checks report domain-local owners and follow-up changes,
  preserve blocked rows, and never call generation/publication or mutate
  product records.
- [ ] 3.4 Add no-superdomain/no-shared-persistence tests and verify existing
  domain state machines remain the only runtime authority.

## 4. Verification And Handoff

- [ ] 4.1 Add per-domain fixture tests for draft editing, deterministic
  validation, human approval, immutable revision, publication receipt, and
  forbidden authority sinks.
- [ ] 4.2 Add privacy tests proving prompts, model responses, answers,
  feedback bodies, credentials, user ids, and absolute paths do not enter
  matrix/QA receipts.
- [ ] 4.3 Add authorization, idempotency, stale-revision, rollback, and
  mixed-source/tree fail-closed tests for the matrix and fitness checks.
- [ ] 4.4 Reconcile route/API/model/worker/script/test/caller counts and
  preserve run-specific QA externally with revision/hash/conclusion receipts.
- [ ] 4.5 Run the focused architecture/domain tests, typecheck, strict
  OpenSpec validation, and diff check; report Assessment as blocked if #1564
  is not qualified.

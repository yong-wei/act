## 1. Freeze the ownership boundary

- [x] 1.1 Enumerate every function in Data Governance's assignment grading
  orchestration and classify it as Assignment command coordination,
  Assessment-owned attempt logic, or governance evidence/derivative work.
- [x] 1.2 Record all route, UI, worker, script, document-grading, test, and
  dynamic callers plus lineage, authorization, error, CAS, idempotency,
  approval, outbox, and AI-draft behavior.
- [x] 1.3 Confirm Assessment and Learning Record owner/port boundaries before
  moving any function.

## 2. Move orchestration into Assignment

- [x] 2.1 Relocate real review/grading command coordination and lineage checks
  under the existing Assignment application implementation.
- [x] 2.2 Expose the moved operations only through C15's existing Assignment
  public API; do not create a second API or a forwarding facade.
- [x] 2.3 Define the narrow approved-snapshot handoff for Data Governance,
  excluding raw answers, teacher-only payloads, and direct LearningFact writes.
- [x] 2.4 Preserve revision/question/submission/attempt identity, teacher
  approval, AI advisory drafts, CAS, idempotency, retries, audit, and outbox.

## 3. Migrate and retire callers

- [x] 3.1 Migrate routes, features, workers, scripts, document grading, and
  tests to Assignment use cases or the explicit governance port.
- [x] 3.2 Prove Data Governance retains only evidence policy, approved-snapshot
  validation, Learning Record writeback, derivative, and outbox consumers.
- [x] 3.3 Re-run all caller inventories and delete the old orchestration module
  and compatibility exports only at zero required callers.

## 4. Verification and handoff

- [x] 4.1 Run focused review/grading, snapshot, approval, score, idempotency,
  CAS, outbox, derivative, privacy, and authorization tests.
- [x] 4.2 Run Assessment-attempt, Learning Record boundary, affected routes,
  typecheck, lint, build, strict validation, and `git diff --check`.
- [x] 4.3 Record the ownership map, approved-snapshot evidence, deletion proof,
  rollback boundary, and residual non-blocking risks.

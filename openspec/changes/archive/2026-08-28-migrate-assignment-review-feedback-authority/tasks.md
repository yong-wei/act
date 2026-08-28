## 1. Review Authority Characterization

- [x] 1.1 Freeze the source revision and inventory the Assignment review
  owner, public/legacy routes, API/error adapters, Prisma review/run/snapshot/
  outbox models, derivative/release workers, scripts, tests, UI callers, and
  data-governance writeback callers.
- [x] 1.2 Characterize the existing `teacher-assignment-review.ts` behavior:
  authorization, lineage, version CAS, criterion edits, approval, return,
  release, resubmission, outbox, audit, and idempotency.
- [x] 1.3 Capture current final-total blockers and partial-feedback behavior,
  including never-submitted, returned, processing, stale, unapproved, and
  explicit-exemption cases.

## 2. Assignment Public Review Contract

- [x] 2.1 Add Assignment-owned role-safe review/feedback DTOs and application
  use cases to the public API introduced by the predecessor change.
- [x] 2.2 Extract or relocate Assignment orchestration from
  `teacher-assignment-review.ts` into the public application boundary; retain
  only data-governance policy/writer adapters there and prove this is not a
  forwarding facade.
- [x] 2.3 Reuse the existing `TeacherAssignmentReview`, `GradingRun`,
  `TeacherAssignmentApprovalSnapshot`, review outbox, derivative/release,
  resubmission, and audit identities without adding schema or states.
- [x] 2.4 Define the approved-snapshot port for Data Governance and prohibit
  Assignment routes or UI from writing LearningFact/evidence directly.

## 3. Vertical Caller Migration

- [x] 3.1 Migrate assignment teacher queue, open, save, approve, return, and
  release routes and the teacher review queue/workspace to the public API.
- [x] 3.2 Migrate student approved feedback, reviewed-asset, resubmission,
  and assignment-detail callers to role-safe public DTOs.
- [x] 3.3 Migrate assignment-bound document-grading pipeline and report
  callers while recording unbound legacy callers for the retirement change.
- [x] 3.4 Re-run the caller inventory and remove direct production imports of
  Assignment review orchestration from routes, features, and unrelated data
  modules.

## 4. Score, Release, And Governance Invariants

- [x] 4.1 Ensure question totals are derived from current teacher-approved
  criterion values and snapshots; AI draft totals never become final totals.
- [x] 4.2 Enforce completeness from every required question's current attempt
  and approved snapshot or audited exemption; keep partial feedback separate
  from assignment final totals.
- [x] 4.3 Preserve Data Governance authorization, evidence mapping,
  LearningFact writeback, privacy scope, and independent outbox consumer
  states.
- [x] 4.4 Preserve correlation/causation, deterministic idempotency keys,
  optimistic CAS, retries, leases, and duplicate delivery behavior.

## 5. Verification And Handoff

- [x] 5.1 Add route/import fitness tests proving the public API owns
  Assignment orchestration and only the approved-snapshot adapter reaches
  governed evidence writers.
- [x] 5.2 Add authorization/privacy tests for author, class, grant, frozen
  student ownership, cross-lineage, student-safe DTO, and teacher-only fields.
- [x] 5.3 Add concurrency/idempotency/outbox fault-injection tests for edits,
  approval, release, derivative, return, resubmission, and retries.
- [x] 5.4 Add final-total/partial-feedback regression tests with conflicting
  AI totals and all completeness blockers.
- [x] 5.5 Verify rollback preserves reviews, snapshots, submissions,
  derivatives, releases, audits, and outbox records; run focused tests,
  typecheck, and strict validation.  Externalize run-specific QA artifacts
  and retain only revision/hash/conclusion receipts.

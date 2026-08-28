## Context

The repository already contains the completed review loop in
`src/lib/data-governance/teacher-assignment-review.ts`: it derives criterion
totals, evaluates required-question completeness, resolves author/class/grant
authorization, saves versioned teacher edits, approves with a CAS transaction,
creates `TeacherAssignmentApprovalSnapshot` and
`TeacherAssignmentReviewOutbox` rows, releases feedback, and activates
question-scoped resubmission.  The assignment review routes and
`src/features/assignments/teacher-review-{queue,workspace}.tsx` consume these
functions directly.  The document-grading pipeline and legacy workbench also
have assignment-bound paths.

The existing Prisma records are already sufficient: `TeacherAssignmentReview`
stores working criterion/annotation values and version; `GradingRun` stores
machine output and `draftTotalScore`; `TeacherAssignmentApprovalSnapshot`
stores approved criterion/annotation snapshots and `questionTotal`; the
review outbox drives derivative, student-release, and governed-writeback
consumers.  This change changes ownership and entrypoints, not those records.

## Goals / Non-Goals

**Goals:**

- Make Assignment's public application boundary the only Assignment-facing
  review and feedback entrypoint.
- Preserve every existing review state, immutable snapshot, outbox command,
  release, derivative, resubmission, authorization, and audit invariant.
- Enforce teacher human approval and completeness-gated final totals.
- Keep data-governance evidence writeback separate and explicitly authorized.
- Produce a closed caller inventory and a structural no-facade proof.

**Non-Goals:**

- Adding tables, enums, review states, workers, scoring formulas, or a second
  grading/feedback state machine.
- Replacing `TeacherAssignmentReview` or `GradingRun` with a new Assignment
  grading model.
- Letting AI approve, publish feedback, set final totals, or write
  LearningFact directly.
- Retiring legacy document-grading routes; that is the next change.
- Changing the Assessment catalog, Smart Lesson/Courseware generation, AI
  provider, deployment, or production selector.

## Decisions

### 1. Move Assignment orchestration, not review semantics

The Assignment public API gains concrete review use cases and role-safe DTOs:
list submissions, open/create a review, save criterion/annotation edits,
approve, return a question, request/retry feedback release, read approved
feedback, and read queue state.  The application layer owns assignment,
revision, submission, question, attempt, and authorization context checks.

The implementation must extract the Assignment orchestration from
`teacher-assignment-review.ts` into that boundary or move it there with
equivalent tests.  A module that only forwards every call to the old module is
not an accepted migration.  Data Governance retains the policy and writer
functions required for LearningFact/evidence eligibility, candidate creation,
and durable writeback; it receives an explicit approved-snapshot context.

### 2. Reuse the existing review aggregate and outbox

`TeacherAssignmentReview` remains the mutable working record and its `version`
is the optimistic-concurrency fence.  Approval remains the one transaction
that CASes the working review and `GradingRun`, updates teacher criterion
values, writes an immutable `TeacherAssignmentApprovalSnapshot`, and enqueues
the existing review outbox commands.  `TeacherAssignmentReviewOutbox` remains
the durable handoff for derivative, student feedback, and governed evidence.
No route writes a LearningFact inline.

### 3. Make human criterion approval the score authority

The question total is derived from the current teacher-approved criterion
values and persisted as `questionTotal` in the approval snapshot.  The AI
`draftTotalScore`, machine criterion score, confidence, and overall text are
visible as provenance/advisory inputs only.  Assignment final totals use the
latest approved snapshot for every required question's current attempt, plus
only explicit audited question exemptions.  Never-submitted, returned-awaiting
resubmission, missing, processing, stale, or unapproved current attempts block
the final total.

### 4. Keep partial feedback separate from final grade

An approved question may publish feedback through its release/derivative
outbox while other questions remain under review.  The student projection
labels this as partial feedback and omits the assignment total.  A successful
feedback release is not evidence that grading completeness has passed.  Only
the existing completeness evaluator may mark `AssignmentSubmission` as
approved-pending-release/complete and expose `approvedTotal`.

### 5. Preserve authorization, snapshots, and privacy at the new boundary

Teacher access uses assignment author, active class ownership, or a current
explicit review grant.  Student access uses the frozen student/revision
ownership and approved release.  Every review command validates assignment,
revision, submission, answer, attempt, question, and grading-run lineage.
Student DTOs exclude reference answers, teacher-only rubric guidance, machine
diagnostics, actor identifiers, and internal outbox payloads.  Mutations retain
strict Origin/CSRF, bounded schemas, idempotency, and rate/quota checks.

### 6. Migrate callers vertically and prove no competing entrypoint

The migration order is characterization; public review contract; teacher
queue/open/save/approve/return vertical slice; student feedback/release slice;
pipeline and document assignment-bound callers; remaining tests/scripts/route
inventory; then removal of direct imports from the old Assignment path.  A
source-level fitness test checks that routes/features import the public API,
that the API owns orchestration, and that only the governed writeback adapter
can reach LearningFact/evidence writers.  There is no second facade.

### 7. Keep QA evidence external and non-authoritative

Run-specific screenshots, traces, HARs, logs, and raw review payloads are
external artifacts.  Repository receipts contain only source/revision hashes,
output hash/reference, and conclusion.  Such receipts cannot satisfy review
approval, score completeness, or LearningFact eligibility.

## Boundary Classes

- **Hard:** approved criterion/snapshot score authority, current-attempt
  completeness, student/teacher authorization, immutable review lineage,
  evidence privacy, CAS, and idempotency.
- **Contract:** Assignment review DTOs/use cases, approved-snapshot port,
  route-only delivery, outbox commands, and caller/fitness inventory.
- **Soft:** queue labels, advisory AI presentation, and partial-feedback copy;
  none can change score or approval authority.
- **Delete:** only superseded direct imports or forwarding adapters after the
  migration denominator is closed. Existing review tables, workers, evidence
  writers, and governance scripts remain.

## Risks / Trade-offs

- [Risk] Extracting review orchestration changes a lineage or authorization
  check. → Replay the current route fixtures before and after extraction and
  require exact frozen identity/error behavior.
- [Risk] AI draft totals leak into the final score. → Assert final totals are
  derived only from approval snapshots and current attempts, including a
  counterexample with a conflicting `draftTotalScore`.
- [Risk] Partial feedback is mistaken for a grade. → Keep release state and
  assignment completeness state separate and test the UI/API projections.
- [Risk] Data-governance writeback becomes reachable from Assignment routes. →
  expose a narrow approved-snapshot port and test that no route imports the
  LearningFact writer.
- [Risk] Duplicate approve/release requests create duplicate work. → Preserve
  idempotency keys, unique snapshot/outbox identities, CAS, and duplicate
  delivery tests.

## Migration Plan

1. Freeze and inventory the current review owner, routes, APIs, models,
   outbox/derivative workers, scripts, tests, and all direct callers.
2. Define the Assignment review DTO/use-case/port contract against the
   existing snapshot and outbox identities; add characterization tests first.
3. Migrate teacher queue/open/save/approve/return and then student feedback/
   release callers through the public API, preserving response semantics.
4. Migrate assignment-bound document pipeline and report callers; leave
   unbound legacy history explicitly for the retirement change.
5. Re-run the caller inventory, remove direct Assignment orchestration imports
   from `teacher-assignment-review.ts`, and retain only governed data-evidence
   adapters where justified by the matrix.
6. Run review, score, partial-release, privacy, authorization, CAS,
   idempotency, outbox fault-injection, rollback, and strict validation tests.

Rollback disables new Assignment review mutations and routes them to the last
verified implementation while preserving working reviews, approved snapshots,
outbox rows, derivatives, releases, submissions, and evidence audit history.
Already approved feedback is not deleted or rewritten; evidence corrections
continue through Data Governance.

## Open Questions

None block the contract.  The implementation may choose whether the extracted
public API lives in a single module or a small `application`/`ports` split,
provided the dependency graph and no-facade proof remain unchanged.

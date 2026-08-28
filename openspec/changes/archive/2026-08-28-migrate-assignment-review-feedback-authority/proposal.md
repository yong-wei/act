# Proposal: Migrate assignment review and feedback authority

## Why

The completed teacher-review/student-feedback loop already provides the
durable review records, criterion edits, approval snapshot, outbox, partial
feedback, and final-total gate required for production.  Its Assignment
orchestration is still reached through `src/lib/data-governance/teacher-
assignment-review.ts`, so Assignment callers have no single public owner and
the old document-grading path can continue to compete with it.

## What Changes

- Move the Assignment-facing review use cases, DTOs, authorization context,
  and route callers behind the public Assignment API from
  `introduce-assignment-lifecycle-public-api`.
- Reuse the existing `TeacherAssignmentReview`, `GradingRun`, criterion-edit,
  `TeacherAssignmentApprovalSnapshot`, `TeacherAssignmentReviewOutbox`,
  derivative, release, and resubmission contracts without adding a table,
  state, or parallel grading machine.
- Preserve human approval as the only source of criterion/question totals;
  `GradingRun.draftTotalScore` and other AI output remain non-authoritative.
- Preserve independently observable partial feedback and withhold an
  assignment final total until every required current attempt has an approved
  criterion snapshot or an explicit audited exemption.
- Keep `LearningFact` and evidence writeback in the data-governance authority;
  Assignment invokes a governed writeback port rather than writing facts.
- Characterize and migrate every review/feedback route, feature, worker,
  script, test, and caller, then prove that the former Assignment orchestration
  module is no longer a competing public entrypoint.
- Keep run-specific QA externalized; retain only revision/hash/conclusion
  receipts and never mix QA evidence with score, approval, or LearningFact
  authority.

## Capabilities

### New Capabilities

- `assignment-review-feedback-authority`: Defines Assignment-owned review and
  feedback entrypoints while preserving the completed governed review loop.

### Modified Capabilities

None.  The existing `assignment-review-and-feedback` behavior and
`document-rubric-grading-workbench` contracts are reused; this change moves
their Assignment authority and callers without redefining their states.

## Impact

- **Owner:** Assignment application/public API owns assignment-scoped review,
  approval, return, release, and feedback orchestration.  Data Governance
  remains the owner of LearningFact/evidence authorization and writeback.
- **Routes/API:** `/api/teacher/assignments/[assignmentId]/submissions/**/review`
  and its queue/release/return/approve routes become public-API callers;
  legacy document-grading routes remain a later retirement input.
- **Models:** existing `TeacherAssignmentReview`, `GradingRun`,
  `TeacherAssignmentApprovalSnapshot`, review outbox, derivative/release,
  `AssignmentSubmission`, and `LearningEvidenceDraft` records are not
  replaced or extended with a second state machine.
- **Workers/scripts:** existing review outbox/derivative/evidence workers and
  retention/repair scripts continue under their current owners; no new worker
  or scoring formula is introduced.
- **Tests/callers:** the denominator includes `teacher-assignment-review.ts`,
  review API/error adapters, assignment feature workspaces/queues, all review
  routes, document-grading pipeline callers, data-governance writeback callers,
  worker tests, route tests, and route inventory entries.
- **Dependencies:** blocked by `introduce-assignment-lifecycle-public-api`,
  which is itself blocked by the modular charter and dependency contracts.
  The completed `close-teacher-review-student-feedback-loop` contract is the
  behavioral input, not a new implementation target.

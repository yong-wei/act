# Proposal: Retire assignment legacy document-grading bridges

## Why

The production document-submission route can already return `410`, but that
does not retire the remaining `approve`, `writeback-preview`,
`LearningEvidenceDraft` fallback, teacher workbench/demo, and student
`/assessment/document-feedback` shells.  Those paths still expose a second
assignment/grading entrypoint and can mislead operators into treating legacy
drafts as current authority.

## What Changes

- Freeze and classify the complete legacy denominator: assignment-bound and
  unbound historical/demo data, `LearningEvidenceDraft` rows with
  `sourceType=document_rubric_grading`, native grading runs, workers/outboxes,
  routes, aliases/deep links, feature flags, scripts, capture plans, specs,
  and tests.
- Migrate every valid assignment-bound caller and record to the Assignment
  review/feedback public API from the preceding change.
- Block or migrate unapproved legacy data and retain approved history only
  when a `TeacherAssignmentApprovalSnapshot` or explicit read-only proof binds
  its immutable lineage.
- Remove the legacy approve/writeback-preview fallback, teacher
  grading-workbench/demo, student document-feedback shell, and obsolete
  document-rubric-grading-workbench callers only after the measured deletion
  gates pass.
- Drain or explicitly fence legacy worker/outbox work, preserve audit and
  immutable source/feedback artifacts, and keep governance migration/repair
  scripts that still have an active purpose.
- Close usage/data/log windows, run-id/hash/revision identity, rollback
  rehearsal, and deletion/retention receipts.  A `410` response alone is not
  retirement evidence.
- Keep run-specific QA artifacts external; receipts retain only revision/hash
  and conclusion, never raw answers, approval payloads, or LearningFact data.

## Capabilities

### New Capabilities

- `assignment-legacy-document-grading-retirement`: Defines the denominator,
  migration, retention, deletion gates, and controlled historical boundary for
  assignment legacy document-grading bridges.

### Modified Capabilities

None.  Existing document-grading, assignment review, lifecycle, and data
governance contracts remain authoritative; this change retires only obsolete
entrypoints and fallbacks after proof.

## Impact

- **Owner:** Assignment owns migrated assignment-bound review/feedback;
  Data Governance owns retained evidence, historical proof, and migration
  records.  Legacy UI is not an owner.
- **Routes/API:** targets `/api/teacher/document-grading/approve`,
  `/writeback-preview`, `/submissions` fallback behavior,
  `/teacher/grading-workbench`, `/assessment/document-feedback`, and all
  assignment-bound aliases/deep links.
- **Models/data:** preserve `Assignment*`, `GradingRun`, approved snapshots,
  releases, derivatives, original submissions/checksums, audit and outbox
  lineage.  Do not drop `LearningEvidenceDraft` or its generic governance
  use solely because this legacy source type is retired.
- **Workers/scripts:** inventory `GradingJob`, review/evidence outbox, worker
  and retention paths; retain migration/repair scripts with current governance
  use and delete only obsolete wrappers/capture references.
- **Tests/callers:** all route, UI, API, data-governance, worker, script,
  capture, fixture, and specification references are denominator members;
  each must be migrated, retained as controlled history, or removed with a
  receipt.
- **Dependencies:** blocked by `migrate-assignment-review-feedback-authority`,
  which is blocked by the public Assignment API.  No dependency is created on
  the generated-content invariant change.

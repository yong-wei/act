## Why

Teacher review is spread across queue, review workspace, grading console, and
assignment-grade views with repeated loading, criterion, annotation, save,
approval, return, release, and error branches.  The duplication makes the
canonical Assignment approval and partial-feedback boundaries difficult to
read and risks presenting AI drafts or incomplete totals as final grading.

## What Changes

- Apply the `code-simplification` workflow after C16 to the existing teacher
  review/grading workspace surfaces.
- Simplify queue-to-review transitions, criterion/annotation editing, save/CAS
  handling, approval/return/release actions, and projection branches by
  removing concrete duplication and unclear control flow.
- Preserve Assignment revision/submission/attempt lineage, teacher
  authorization, immutable approval snapshots, current-attempt completeness,
  idempotency/CAS, outbox/derivative behavior, and partial feedback semantics.
- Keep AI grading drafts advisory, Assessment-owned attempt semantics intact,
  and Learning Record/evidence writeback separately authorized.
- Record actual before/after complexity, behavior, privacy, and accessibility
  evidence; file splitting alone is not completion.

## Capabilities

### New Capabilities

- `teacher-review-grading-workspace-simplification`: Defines the behavior-
  preserving simplification and evidence contract for teacher review.

### Modified Capabilities

None.  Existing Assignment review/grading, Assessment, Learning Record, and
commercial workspace contracts remain authoritative.

## Impact

- Affects `src/features/assignments/teacher-review-queue.tsx`,
  `teacher-review-workspace.tsx`, `teacher-assignment-grade-workspace.tsx`,
  `teacher-assignment-grading-console.tsx`, related review contracts/UI tests,
  and only measured adjacent helpers.
- Depends on C15 and C16, the existing Assessment owner, and the Learning
  Record/evidence boundary.
- No new review state machine, scoring rule, API, database schema, approval
  authority, evidence writer, route, or AI provider is introduced.

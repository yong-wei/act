## Why

`student-assignment-workspace.tsx` combines assignment loading, local draft
preservation, attachment upload, ordering/removal, question submission,
resubmission, history, and released-result rendering in one branch-heavy
client.  This obscures the existing Assignment lifecycle and makes it easy to
conflate a live draft with durable submission evidence.

## What Changes

- Apply the `code-simplification` workflow after C16 to reduce duplicated
  request/state transitions and unclear rendering branches in the student
  workspace.
- Simplify load/retry/conflict handling, question updates, asset operations,
  submit/resubmit actions, history, and result projections without changing
  behavior or public DTOs.
- Preserve frozen student/revision ownership, attachment integrity and order,
  attempt identity, idempotency, submission lifecycle, approved feedback and
  result-release privacy.
- Keep Learning Record and Assessment reads/writes on their existing ports and
  record before/after complexity plus behavior/accessibility evidence.
- Reject pure file splitting or cosmetic refactoring as completion.

## Capabilities

### New Capabilities

- `student-assignment-workspace-simplification`: Defines the behavior-preserving
  simplification and evidence contract for student assignment delivery.

### Modified Capabilities

None.  `student-assignment-mission-center`, `assignment-lifecycle-public-api`,
Assessment, and Learning Record contracts remain unchanged.

## Impact

- Primarily affects `src/features/assignments/student-assignment-workspace.tsx`,
  `student-response-editor-contracts.ts`, student workspace tests, and only
  measured adjacent helpers.
- Depends on C15 and C16 plus the existing Assessment attempt and Learning
  Record consumer boundaries.
- No assignment schema, revision/snapshot, submission API, result-release
  policy, evidence writer, route, or student-visible answer authority changes.

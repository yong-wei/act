## Why

Assignment behavior is nominally exposed by `src/lib/assignments`, but review,
grading, evidence, Assessment, and Learning Record consumers still cross into
multiple implementation owners.  This leaves lifecycle authority ambiguous and
encourages routes or data-governance code to reconstruct assignment state.

## What Changes

- Close the Assignment ownership boundary around the existing public API for
  authoring, publication, student delivery, submission, review, grading,
  feedback release, and resubmission.
- Migrate remaining Assignment callers to that API and explicit Assessment and
  Learning Record ports, preserving current DTOs and state semantics.
- Keep assignment revision/question/submission/attempt lineage, immutable
  snapshots, idempotency, optimistic concurrency, teacher approval, and
  AI-draft advisory rules unchanged.
- Remove direct route/feature/data-module access to Assignment persistence or
  internal orchestration after zero-caller proof.
- Record the owner map, replacement matrix, and deletion conditions; do not
  create another lifecycle API or state machine.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assignment-lifecycle-public-api`: Preserve every existing requirement while
  closing the single-owner consumer migration and legacy-deletion boundary.
  `assignment-authoring-and-publication`, `assignment-review-feedback-authority`,
  Assessment, and Learning Record remain authoritative for their existing
  scopes.

## Impact

- Affects `src/lib/assignments/public-api.ts`, assignment service/review/
  submission/grading modules, assignment App Router routes and features,
  data-governance adapters, Assessment callers, Learning Record consumers,
  workers, scripts, and boundary tests.
- Requires the existing Assessment owner and Learning Record consumer/current-
  projection boundaries to remain independent and explicitly authorized.
- Precedes `move-assignment-orchestration-out-of-data-governance` and
  `simplify-assignment-editor-workspace`; the latter is UI-only after ownership
  is closed.  It is also the prerequisite for student/teacher workspace
  simplification changes.
- No new table, enum, worker, public API, score authority, evidence writer,
  route, or production behavior is introduced.

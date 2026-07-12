## Why

The current branch contains three narrowly scoped post-merge repairs identified from the real diff against `origin/integration`: administrator publication could include inactive classes, concurrent portrait materialization could race on one student's snapshot, and submission asset reads trusted byte length without verifying content. These gaps affect authorization, durable learner state, and uploaded-document integrity, so they need one independently reviewable repair change.

## What Changes

- Restrict assignment publication audience resolution to active classes for administrators as well as teachers, rejecting the publication before audience rows are created when a class is inactive.
- Execute incremental portrait v2 materialization inside a transaction with a transaction-scoped per-student PostgreSQL advisory lock, preserving the existing evidence cursor and incremental update semantics.
- Carry the persisted submission asset checksum through the read path and verify both byte size and SHA-256 digest before returning object bytes; report an integrity mismatch when either check fails.

## Capabilities

### Modified Capabilities

- `assignment-authoring-and-publication`: inactive classes cannot receive a
  newly published assignment audience.
- `adaptive-learner-state-service`: same-learner portrait snapshot updates are
  transactionally serialized and fail closed without the lock capability.
- `student-assignment-mission-center`: authorized asset reads verify persisted size
  and SHA-256 metadata before returning bytes.

## Impact

- Assignment publication service and its inactive-class authorization regression coverage.
- Portrait v2 materialization worker path and its transaction/concurrency regression coverage.
- Student submission asset read/domain path and its same-size tampering regression coverage.
- No database schema, data migration, production configuration, Buddy
  automation, skill, GitHub, or other-worktree changes are part of this
  proposal.

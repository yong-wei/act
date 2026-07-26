## 1. Publication identity and baseline

- [x] 1.1 Add or confirm stable assignment, mutable draft, immutable revision, and publication-operation identities in the persistence contract.
- [x] 1.2 Define the publication request schema around assignment identity, saved draft revision/version, content digest, and idempotency key, rejecting unsaved content fields.
- [x] 1.3 Enforce saved, current, conflict-free baseline checks in the publication transaction before freezing a revision or creating audiences.

## 2. Idempotency and completion flow

- [x] 2.1 Add database uniqueness and transactional replay handling so equivalent double-click, retry, and concurrent requests return the first successful result.
- [x] 2.2 Update the editor to disable publication outside `已保存` and map saving, failure, and conflict states to recovery guidance.
- [x] 2.3 Return stable list-location data from publication and navigate immediately to the teacher assignment list after success.
- [x] 2.4 Make the list resolve and highlight the new publication with teacher-visible class names.

## 3. Historical duplicate repair

- [x] 3.1 Implement a dry-run repair that groups only provably identical assignment histories and reports dependent submissions, reviews, audiences, and ambiguous groups.
- [x] 3.2 Delete only duplicate versions with no retained dependencies and convert dependent duplicates to read-only history.
- [x] 3.3 Enforce and verify one current published version per stable assignment in student-list projections.
- [x] 3.4 Make the repair idempotent and emit an auditable result manifest suitable for rollback analysis.

## 4. Verification

- [x] 4.1 Add concurrency and replay tests for double-click, network retry, and simultaneous publication.
- [x] 4.2 Add negative tests for saving, save-failed, conflicted, stale-version, and content-digest mismatch baselines.
- [x] 4.3 Add repair fixtures covering deletable duplicates, submission-bound history, ambiguous lineage, and idempotent reruns.
- [x] 4.4 Run affected unit/integration tests, typecheck, and browser acceptance for success navigation and list location.

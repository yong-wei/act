## 1. Server projections and lifecycle

- [x] 1.1 Add the five-stage task projection with persisted validity, confirmation, blocking reason, Chinese status, and next action.
- [x] 1.2 Add task summary queries for active and archived lists without loading every task detail.
- [x] 1.3 Implement transactional task deletion checks and atomic cleanup of attempts, outlines, drafts, unpublished approved revisions, and unpublished courseware, plus archive and restore actions.
- [x] 1.4 Add the existing-task adapter for valid outputs, resumable failures, and unsupported payload states.

## 2. Teacher workspace

- [x] 2.1 Build the `备课任务` and `课程依据` top-level navigation.
- [x] 2.2 Build the desktop task index and one-task accordion with automatic completion checks.
- [x] 2.3 Add narrow-screen task navigation and preserve every stage action without horizontal page scrolling.
- [x] 2.4 Replace English and raw enum labels in the affected workspace with the shared Chinese presentation map.
- [x] 2.5 Synchronize course-basis mutations into task selection and preview without a full page refresh while preserving the current accordion position.

## 3. Verification

- [x] 3.1 Add unit tests for stage completion invalidation, delete-versus-archive boundaries, and existing-task projection.
- [x] 3.2 Add browser tests for task search, accordion progress, narrow-screen navigation, deletion feedback, and archive filtering.
- [x] 3.3 Verify representative existing generated, failed, and approved tasks render without raw JSON.
- [x] 3.4 Run typecheck and the affected smart-preparation test suites.

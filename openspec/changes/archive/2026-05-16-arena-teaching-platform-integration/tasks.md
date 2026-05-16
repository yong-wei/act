## 1. Data Model and Stores

- [x] 1.1 Add a persisted Arena publication model with teacher, class, task, visibility, deadline, leaderboard policy, homework binding, grading policy, status, and timestamps.
- [x] 1.2 Add `publicationId` to `ArenaSubmission` and keep existing `classId` and `seasonId` indexes useful for class and season filtering.
- [x] 1.3 Add a migration and Prisma client updates for publication and submission context fields.
- [x] 1.4 Implement an Arena publication store with create, list, update status, and permission-aware read helpers.

## 2. Teacher Publication Workflow

- [x] 2.1 Keep `/api/teacher/arena/preview` as validation-only and ensure it does not insert publication rows.
- [x] 2.2 Add teacher/admin APIs for creating and listing Arena publications.
- [x] 2.3 Add teacher/admin APIs for pausing, reopening, or archiving publications.
- [x] 2.4 Update `TeacherArenaConfig` to support preview plus actual publish/manage states.
- [x] 2.5 Add permission tests for own class, other teacher class, and admin access.

## 3. Student Access and Submission Context

- [x] 3.1 Add student publication resolution by class/course/public visibility.
- [x] 3.2 Update Arena challenge entry links to carry `publicationId` when launched from class or homework context.
- [x] 3.3 Validate `publicationId` in `/api/arena/evaluate` before accepting a contextual submission.
- [x] 3.4 Persist `publicationId`, `classId`, and optional `seasonId` on contextual submissions.
- [x] 3.5 Define and implement late-submission behavior according to the chosen policy.

## 4. Publication Leaderboards and Homework Assessment

- [x] 4.1 Add publication-scoped leaderboard queries.
- [x] 4.2 Enforce pre-deadline hidden leaderboard behavior where publication policy requires it.
- [x] 4.3 Expose personal status separately from full class ranking.
- [x] 4.4 Use official Arena score, validity, metrics, and diagnostics as homework grading inputs.
- [x] 4.5 Add tests for class filtering, deadline behavior, and homework-bound assessment.

## 5. Arena Learning Evidence

- [x] 5.1 Extend LearningFact storage or linked evidence storage so Arena facts retain task, object, method, score, valid, artifact hash, metric profile, leaderboard policy, publication, and class context.
- [x] 5.2 Update Arena event materialization to populate the added context for high-value events.
- [x] 5.3 Add class insight aggregation helpers for valid rate, score distribution, weak metrics, and method distribution.
- [x] 5.4 Add data-governance tests for valid evaluation, constraint failure, and low-value view event exclusion.

## 6. Control Odyssey Bridge

- [x] 6.1 Define eligible Odyssey levels and their target Arena task mapping.
- [x] 6.2 Build a deterministic Arena artifact from Odyssey run id, level id, tier, controller configuration, and measured metrics.
- [x] 6.3 Submit eligible Odyssey artifacts through the official Arena evaluation path without replacing existing Odyssey score persistence.
- [x] 6.4 Prevent duplicate Arena bridge submissions for the same Odyssey run and publication/task context.
- [x] 6.5 Add tests proving Odyssey game score success remains intact when Arena bridge submission fails.

## 7. Verification

- [x] 7.1 Run Arena teacher configuration and publication API tests.
- [x] 7.2 Run Arena evaluate route tests with publication context.
- [x] 7.3 Run Arena leaderboard and Prisma store tests.
- [x] 7.4 Run data-governance LearningFact materialization and class insight tests.
- [x] 7.5 Run Control Odyssey action tests and any bridge-specific tests.
- [x] 7.6 Run `npm run lint`.
- [x] 7.7 Record any unrelated baseline failures separately.

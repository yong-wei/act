## 1. OpenSpec and projection contract

- [x] 1.1 Add the student-safe AI Workshop evidence projection type and pure projection helper.
- [x] 1.2 Add unit tests for available, empty, stale/partial, and unavailable states, including restricted-field omission.
- [x] 1.3 Validate the change artifacts with strict OpenSpec validation.

## 2. Server integration

- [x] 2.1 Read the authenticated learner state in `src/app/ai/page.tsx` using the existing service and Prisma client.
- [x] 2.2 Pass the projection and authenticated display name into `PersonalLearningCenter`.
- [x] 2.3 Fail closed to an unavailable projection when the service is disabled or cannot be read.

## 3. UI behavior

- [x] 3.1 Remove sample profile, task, achievement, experiment, journal, and milestone defaults from production rendering.
- [x] 3.2 Render evidence count, confidence, portrait status, and limitations from the projection.
- [x] 3.3 Render explicit no-record/unavailable states for empty child panels without synthetic zeros or sample records.
- [x] 3.4 Preserve report-feedback task context and its existing candidate lifecycle.

## 4. Verification and delivery evidence

- [x] 4.1 Run focused projection and AI Workshop tests.
- [x] 4.2 Run related adaptive-learning center tests and `npm run typecheck`.
- [x] 4.3 Run strict OpenSpec validation and `git diff --check`.
- [x] 4.4 Run browser smoke at 1440px and 320px and attach revision-bound evidence before PR creation.

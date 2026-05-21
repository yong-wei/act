## 1. Implementation

- [x] 1.1 Add Arena capability aggregation from submission history.
- [x] 1.2 Add next-challenge recommendation helpers using training metadata.
- [x] 1.3 Extend profile API response with Arena growth and recommendation data.
- [x] 1.4 Update student profile UI to show Arena growth summary and next challenges.
- [x] 1.5 Use persistent `LearningRecommendation` only if lifecycle tracking is required.

## 2. Tests

- [x] 2.1 Add profile aggregation tests for sparse, failing, improving, and strong submission histories.
- [x] 2.2 Add recommendation tests for prerequisite gaps and next-stage tasks.
- [x] 2.3 Add API response tests.

## 3. Verification

- [x] 3.1 Run targeted profile and Arena portfolio tests.
- [x] 3.2 Run `npm run lint`.
- [x] 3.3 Run `npm run build` if profile routes change.

## 4. Coordination

- [x] 4.1 Depends on `arena-training-map`, `arena-result-feedback-explainer`, and `arena-leaderboard-honors-showcase`.
- [x] 4.2 Do not implement teacher management or showcase publication in this change.

## 1. Implementation

- [x] 1.1 Extend feedback model with score composition, protocol version, official-only metric notes, and preview/official boundaries.
- [x] 1.2 Improve hard-constraint and weakest-metric guidance.
- [x] 1.3 Update submission panel UI with a result explainer section.
- [x] 1.4 Preserve existing submission and leaderboard preview behavior.

## 2. Tests

- [x] 2.1 Add feedback-rule tests for valid, invalid, improved, regressed, and unchanged submissions.
- [x] 2.2 Add black-box privacy tests for hidden metric explanations.
- [x] 2.3 Add UI tests for result explainer rendering.

## 3. Verification

- [x] 3.1 Run targeted Arena submission and feedback tests.
- [x] 3.2 Run `npm run lint`.
- [x] 3.3 Run `npm run build` if route rendering changes.

## 4. Coordination

- [x] 4.1 Depends on `arena-training-map`.
- [x] 4.2 Do not implement badges, showcase walls, teacher reports, or growth recommendations in this change.

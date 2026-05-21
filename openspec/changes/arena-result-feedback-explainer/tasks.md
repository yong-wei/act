## 1. Implementation

- [ ] 1.1 Extend feedback model with score composition, protocol version, official-only metric notes, and preview/official boundaries.
- [ ] 1.2 Improve hard-constraint and weakest-metric guidance.
- [ ] 1.3 Update submission panel UI with a result explainer section.
- [ ] 1.4 Preserve existing submission and leaderboard preview behavior.

## 2. Tests

- [ ] 2.1 Add feedback-rule tests for valid, invalid, improved, regressed, and unchanged submissions.
- [ ] 2.2 Add black-box privacy tests for hidden metric explanations.
- [ ] 2.3 Add UI tests for result explainer rendering.

## 3. Verification

- [ ] 3.1 Run targeted Arena submission and feedback tests.
- [ ] 3.2 Run `npm run lint`.
- [ ] 3.3 Run `npm run build` if route rendering changes.

## 4. Coordination

- [ ] 4.1 Depends on `arena-training-map`.
- [ ] 4.2 Do not implement badges, showcase walls, teacher reports, or growth recommendations in this change.

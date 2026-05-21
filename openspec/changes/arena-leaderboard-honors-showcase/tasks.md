## 1. Implementation

- [x] 1.1 Expand leaderboard browser view models for all supported leaderboard types.
- [x] 1.2 Add honor criteria and derivation from official submissions.
- [x] 1.3 Add persistence only if runtime derivation is insufficient.
- [x] 1.4 Add excellent-solution showcase summaries with privacy controls.
- [x] 1.5 Update challenge detail and relevant Arena surfaces.

## 2. Tests

- [x] 2.1 Add leaderboard tests for Pareto, method, metric, class, and season views.
- [x] 2.2 Add honor derivation tests.
- [x] 2.3 Add showcase privacy tests.

## 3. Verification

- [x] 3.1 Run targeted Arena leaderboard tests.
- [x] 3.2 Run Prisma validation if schema changes.
- [x] 3.3 Run `npm run lint`.
- [x] 3.4 Run `npm run build` if route rendering or schema codegen changes.

## 4. Coordination

- [x] 4.1 Depends on `arena-result-feedback-explainer`.
- [x] 4.2 Do not implement teacher lecture mode or growth recommendations in this change.

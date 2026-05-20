## 1. Leaderboard Data Contract

- [x] 1.1 Add or extend a challenge-detail leaderboard view model with main, method, and metric leaderboard groups.
- [x] 1.2 Include student name, student number, normalized method label, score, selected metric values, rank, and submitted time in detail rows.
- [x] 1.3 Preserve existing official validity, legacy-protocol exclusion, and tie-break rules.

## 2. Challenge Detail UI

- [x] 2.1 Add `主榜`, `方法榜`, and `指标榜` switching in the leaderboard summary area.
- [x] 2.2 Add method and metric sub-leaderboard selectors when those categories are active.
- [x] 2.3 Render the dynamic detail table with Chinese labels, loading state, empty state, and missing-student-number fallback.
- [x] 2.4 Confirm the challenge detail page remains read-only and has no official submission form.

## 3. Verification

- [x] 3.1 Add focused tests for tab switching, sub-leaderboard switching, and row field rendering.
- [x] 3.2 Add a data-level test or fixture check for student number assembly when a profile exists.
- [x] 3.3 Run `npm run lint`.
- [x] 3.4 Run the relevant Arena or component test target.

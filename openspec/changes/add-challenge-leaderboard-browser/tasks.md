## 1. Leaderboard Data Contract

- [ ] 1.1 Add or extend a challenge-detail leaderboard view model with main, method, and metric leaderboard groups.
- [ ] 1.2 Include student name, student number, normalized method label, score, selected metric values, rank, and submitted time in detail rows.
- [ ] 1.3 Preserve existing official validity, legacy-protocol exclusion, and tie-break rules.

## 2. Challenge Detail UI

- [ ] 2.1 Add `主榜`, `方法榜`, and `指标榜` switching in the leaderboard summary area.
- [ ] 2.2 Add method and metric sub-leaderboard selectors when those categories are active.
- [ ] 2.3 Render the dynamic detail table with Chinese labels, loading state, empty state, and missing-student-number fallback.
- [ ] 2.4 Confirm the challenge detail page remains read-only and has no official submission form.

## 3. Verification

- [ ] 3.1 Add focused tests for tab switching, sub-leaderboard switching, and row field rendering.
- [ ] 3.2 Add a data-level test or fixture check for student number assembly when a profile exists.
- [ ] 3.3 Run `npm run lint`.
- [ ] 3.4 Run the relevant Arena or component test target.

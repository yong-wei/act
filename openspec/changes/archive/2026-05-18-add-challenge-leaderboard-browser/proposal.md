## Why

Challenge detail pages currently show leaderboard summary statistics, but they do not let students inspect the actual rankings for a challenge. The submission panel has partial leaderboard switching, but challenge detail is the correct read-only place for browsing official results before entering the workbench.

## What Changes

- Add a challenge detail leaderboard browser with `主榜`, `方法榜`, and `指标榜` switching.
- Add second-level selection for method leaderboards and metric leaderboards.
- Render a dynamic leaderboard detail table under the summary module.
- Include rank, student name, student number, method, score, selected metric values, and submission time in leaderboard rows.
- Keep official submission and simulation execution inside the comprehensive simulation workbench, not on the challenge detail page.

## Capabilities

### New Capabilities

- `arena-challenge-leaderboard-browser`: Defines the student-facing challenge detail leaderboard browser, tab behavior, sub-leaderboard selection, row identity fields, and eligibility rules.

### Modified Capabilities

- None.

## Impact

- Expected frontend impact in `src/features/arena/challenge-detail.tsx`.
- Expected leaderboard data impact in `src/features/arena/leaderboards/leaderboard.ts` and the server-side assembly that provides student profile fields.
- May require a display-layer row model that joins `StudentProfile.studentNumber`; schema changes are not expected unless existing query boundaries make the field unavailable.
- Requires focused tests for leaderboard tab state, sub-leaderboard selection, empty states, and row fields.

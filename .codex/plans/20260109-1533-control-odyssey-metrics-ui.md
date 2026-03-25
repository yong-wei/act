# Control Odyssey Metrics & UI Update

## Goal
- Update telemetry legend and scoring/metrics logic, adjust leaderboard display, and reset existing leaderboard data.

## Scope
- In-scope items
  - Telemetry legend visuals (remove "色块" text, use short line segments)
  - Metrics computation (max overshoot, steady-state error, average relative error)
  - Scoring formula and credits conversion
  - Victory summary layout and tooltips
  - Leaderboard tier star + metrics display
  - Clear Control Odyssey leaderboard data
- Out-of-scope items
  - New gameplay mechanics beyond requested metrics/UI

## Steps
1) Update level reference configs to ensure last 500m is flat, and adjust metrics computation in GameCanvas.
2) Update store metrics types, victory summary UI, telemetry legend, and scoring formula.
3) Update leaderboard data shape and UI display (tier star + metrics), then clear existing leaderboard data.
4) Run lint/test/build/integration tests and report results.

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- Telemetry legend uses line segments without "色块" text.
- Overshoot/steady error/avg relative error computed per new definitions and shown with tooltips.
- Score/credits use new formula (tier base, no tier bonus, credits = score/100).
- Leaderboard shows tier star colors and three metrics (1 decimal).
- Control Odyssey leaderboard data cleared.

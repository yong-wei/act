## Why

Arena already supports multiple leaderboard types in code, but the product experience still emphasizes a small score list. Arena Pro needs visible competition styles: Pareto front, method and metric boards, honors, and excellent-solution showcase.

## What Changes

- Improve student-facing leaderboard browsing for main, method, metric, Pareto, class, and season boards.
- Add honors or badges derived from official submission evidence.
- Add a showcase model for excellent solutions without exposing private controller payloads by default.

## Capabilities

### New Capabilities

- `arena-leaderboard-honors-showcase`

### Modified Capabilities

- None.

## Impact

- `src/features/arena/leaderboards/leaderboard.ts`
- `src/features/arena/leaderboards/leaderboard-service.ts`
- `src/features/arena/challenge-leaderboard-browser.tsx`
- `prisma/schema.prisma`
- Arena leaderboard tests

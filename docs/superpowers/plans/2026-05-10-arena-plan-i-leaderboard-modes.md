# Arena Plan I: Leaderboard Modes

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for ranking behavior and one independent subagent review before commit.

**Goal:** Implement complete Arena leaderboard semantics for main, method, metric, Pareto, class, and season rankings using real submission records.

**Architecture:** Keep leaderboard computation separate from evaluation. Ranking modes consume persisted `ArenaSubmissionRecord` data and never read hardcoded scores from challenge seeds. Scope-specific rankings use submission metadata such as `classId` and `seasonId`; empty scope data should yield empty rankings rather than fabricated entries.

**Tech Stack:** TypeScript ranking engine, Prisma nullable scope columns, Vitest leaderboard tests, detail-page ranking preview.

---

## Files

- Modify: `src/features/arena/leaderboards/leaderboard.ts`
- Modify: `src/features/arena/submissions/submission-service.ts`
- Modify: `src/features/arena/submissions/persistence.ts`
- Modify: `src/features/arena/submissions/prisma-store.ts`
- Modify: `src/features/arena/submissions/arena-submission-panel.tsx`
- Modify: `src/app/api/arena/evaluate/route.ts`
- Modify: `prisma/schema.prisma`
- Add migration under `prisma/migrations/`
- Modify: `src/features/arena/__tests__/arena-leaderboard.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for metric leaderboard ordering by metric direction.
- [x] Add failing tests for Pareto front classification and dominance evidence.
- [x] Add failing tests for class and season scope filtering from real submissions.
- [x] Persist optional class and season scope on Arena submissions.
- [x] Implement main, method, metric, Pareto, class, and season leaderboard modes.
- [x] Update the challenge detail submission panel to preview supported ranking modes without fake data.
- [x] Run targeted tests, Prisma validation, lint, smoke, and build.
- [x] Request one independent subagent review; fix confirmed issues.
- [x] Commit and push only Plan I files.

## Verification Record

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts` first failed on missing metric, Pareto, class, and season semantics.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts` -> 1 file, 11 tests passed after implementation.
- Review follow-up added hard-constraint priority for metric leaderboards, empty results for missing class/season/method scope, explicit method selection in detail preview, and untrusted request-scope rejection in `/api/arena/evaluate`.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts` -> 2 files, 19 tests passed after review fixes.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts` -> 3 files, 21 tests passed.
- `rtk npx prisma validate` -> schema valid.
- `rtk npx prisma generate` -> Prisma Client generated.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> smoke, home entry, and arena routes passed.
- `rtk npm run build` -> passed.

## Review Record

- Independent subagent review by `019e125a-1a50-7df0-9979-6ec7d2810418` initially found three issues: missing class/season scope fell back to all submissions, client-provided scope was untrusted, and method leaderboard preview lacked method selection.
- Fixes were applied and the same subagent re-reviewed current worktree. Result: no blocker/high/medium residual issues.

## Commit Record

- Commit subject: `feat: add arena leaderboard modes`
- Push: completed.

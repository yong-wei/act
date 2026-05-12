# Arena Plan C: Challenge Detail And Filters

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Let students browse challenge tasks by meaningful filters and open a challenge detail page.

**Architecture:** The hall filters task cards by chapter, object source, allowed method, difficulty, white-box or black-box status, homework binding, and leaderboard visibility. Challenge details show the object, task, rules, related knowledge, current leaderboard summary, and the selected workspace mode.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind.

---

## Files

- Modify: `src/features/arena/arena-hall.tsx`
- Create: `src/app/arena/challenges/[taskId]/page.tsx`
- Create: `src/features/arena/challenge-detail.tsx`
- Test: `src/features/arena/__tests__/arena-filtering.test.ts`
- Test: `scripts/tests/test-arena-routes.mjs`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for task filtering and invalid challenge route handling.
- [x] Run tests and confirm expected failure.
- [x] Implement filter state and empty states in the hall.
- [x] Implement the challenge detail route from seed data.
- [x] Add task-first workspace entry labels without implementing the workspaces yet.
- [x] Run targeted tests.
- [x] Run `npm run lint`.
- [x] Browser-check `/arena` and one detail route.
- [x] Update this plan with verification results.
- [x] Commit and push only Plan C files.

## Verification Record

- Targeted tests: `rtk npm run test:unit -- src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-domain.test.ts` -> 2 files, 6 tests passed; `rtk node scripts/tests/test-arena-routes.mjs` -> passed; `rtk node scripts/tests/test-arena-home-entry.mjs` -> passed.
- Red test evidence: filtering test first failed with missing `../filtering`; route test first failed because `src/app/arena/challenges/[taskId]/page.tsx` did not exist.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Browser check: Playwright verified `/arena` filter controls, search for `横摇 舒适度`, and detail route `task-second-order-lead-pid` showing `对象说明`, `评价规则`, and `进入工作台`.
- Commit: `14ee3e60 feat: add arena challenge filters`
- Push: `rtk git push` -> pushed to `codex/interactive-course-production`.

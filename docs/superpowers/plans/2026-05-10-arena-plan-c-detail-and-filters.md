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

- [ ] Add failing tests for task filtering and invalid challenge route handling.
- [ ] Run tests and confirm expected failure.
- [ ] Implement filter state and empty states in the hall.
- [ ] Implement the challenge detail route from seed data.
- [ ] Add task-first workspace entry labels without implementing the workspaces yet.
- [ ] Run targeted tests.
- [ ] Run `npm run lint`.
- [ ] Browser-check `/arena` and one detail route.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan C files.

## Verification Record

- Targeted tests: Pending
- Lint: Pending
- Browser check: Pending
- Commit: Pending
- Push: Pending

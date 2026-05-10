# Arena Plan E: Submissions, Leaderboards, And Telemetry

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Create the first closed loop from controller submission to evaluation result, leaderboard display, and core learning event tracking.

**Architecture:** Start with an API-backed or local deterministic submission adapter, then introduce persistence only if the existing schema path is clear. Telemetry should record L0 events from `docs/arena.md`: open challenge, start workspace, run simulation, submit, view leaderboard.

**Tech Stack:** Next.js route handlers, TypeScript, existing interactive event API where compatible.

---

## Files

- Create: `src/features/arena/submissions/*`
- Create: `src/features/arena/leaderboards/*`
- Create or modify: `src/app/api/arena/*`
- Test: `src/features/arena/__tests__/arena-leaderboard.test.ts`
- Test: `src/app/api/arena/__tests__/*` if API routes are added.
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [ ] Add failing tests for submission hashing, duplicate reuse, leaderboard ordering, and score visibility.
- [ ] Run targeted tests and confirm expected failure.
- [ ] Implement controller artifact hashing and duplicate evaluation reuse.
- [ ] Implement per-task main leaderboard and method leaderboard.
- [ ] Add core Arena event names and route them through existing event infrastructure if compatible.
- [ ] Run targeted tests.
- [ ] Run `npm run lint`.
- [ ] Browser-check submission and leaderboard surfaces.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan E files.

## Verification Record

- Targeted tests: Pending
- Lint: Pending
- Browser check: Pending
- Commit: Pending
- Push: Pending

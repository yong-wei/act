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

- [x] Add failing tests for submission hashing, duplicate reuse, leaderboard ordering, and score visibility.
- [x] Run targeted tests and confirm expected failure.
- [x] Implement controller artifact hashing and duplicate evaluation reuse.
- [x] Implement per-task main leaderboard and method leaderboard.
- [x] Add core Arena event names and route them through existing event infrastructure if compatible.
- [x] Run targeted tests.
- [x] Run `npm run lint`.
- [x] Browser-check submission and leaderboard surfaces.
- [x] Update this plan with verification results.
- [ ] Commit and push only Plan E files.

## Verification Record

- Targeted tests: `rtk npm run test:unit -- src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts` -> 2 files, 7 tests passed; `rtk node scripts/tests/test-arena-routes.mjs` -> passed.
- Red test evidence: first targeted run failed with missing `../submissions/artifact-hash`.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Browser check: Playwright verified challenge detail page shows `提交与排行榜预览`, clicking `提交示例 PID` displays `最近得分` and a `#1` leaderboard row.
- API check: after restarting `next dev`, `POST /api/arena/evaluate` returned HTTP 200 JSON with a submission and artifact hash.
- Commit: Pending
- Push: Pending

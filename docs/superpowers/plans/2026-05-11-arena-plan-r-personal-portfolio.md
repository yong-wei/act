# Arena Personal Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Arena evidence to the student personal center from real `ArenaSubmission` records only.

**Architecture:** Keep the computation in a pure Arena feature module, then call it from `/api/user/profile`. The profile page renders a compact Arena card from that API payload; no page invents leaderboard rows or preview records.

**Tech Stack:** Next.js App Router, TypeScript, Prisma-backed Arena submissions, Vitest.

---

### Task 1: Arena Portfolio Aggregation

**Files:**
- Create: `src/features/arena/profile.ts`
- Test: `src/features/arena/__tests__/arena-profile.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- Count unique submitted controllers for a student.
- Extract black-box identification model references from submitted artifacts.
- Compute per-task personal leaderboard rank with `buildArenaLeaderboard`.
- Group frequent failures by real challenge object.
- Detect metrics whose satisfaction improved from earliest to latest submission.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-profile.test.ts`

Result: failed because `../profile` did not exist.

- [x] **Step 2: Implement the pure function**

Create `buildArenaStudentPortfolio(submissions, userId)` in `src/features/arena/profile.ts`.

Constraints:
- Input is existing `ArenaSubmissionRecord[]`.
- Ranking uses `buildArenaLeaderboard` over those records.
- Identification models are only read from `black-box-control` artifact params.
- Failure groups use invalid submissions or low scores from the target student.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-profile.test.ts`

Result: `2` tests passed after adding the API/page connection guard.

### Task 2: Profile API and Page Integration

**Files:**
- Modify: `src/app/api/user/profile/route.ts`
- Modify: `src/app/(main)/profile/page.tsx`
- Test: `src/features/arena/__tests__/arena-profile.test.ts`

- [x] **Step 1: Add API payload field**

Load real submissions through `prismaArenaSubmissionStore.listSubmissions()` and return `arenaPortfolio` from the profile API.

- [x] **Step 2: Render the personal center card**

Add an Arena card to `/profile` showing controller count, identification model count, submission count, best task/rank, frequent failures, and improving metrics.

- [x] **Step 3: Verify focused and full gates**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-profile.test.ts`
`rtk npm run lint`
`rtk npm run test`
`rtk npm run build`

Result before review fix:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts` -> `11` files, `81` tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> passed.
- `rtk npm run build` -> passed.

Result after scoped-query fix:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts` -> `11` files, `82` tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> passed.
- `rtk npm run build` -> passed.

### Task 3: Review, Documentation, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-r-personal-portfolio.md`

- [x] **Step 1: Ask Hegel to review**

Review implementation with the existing `Hegel` subagent. Fix any blocker/high/medium issues and re-review if required.

Result: first review found one medium issue: `/api/user/profile` loaded all Arena submissions. Fixed by adding scoped `userId/taskIds` submission queries and re-reviewing. Hegel re-review found no blocker, high, medium, or low issues.

- [x] **Step 2: Commit implementation**

Stage only implementation and tests. Do not stage `AGENTS.md`.

Result: implementation commit `c408b56b feat: add arena personal portfolio`.

- [x] **Step 3: Commit docs**

Stage only plan/progress docs.

Result: docs are committed separately from implementation in the Plan R documentation commit.

- [x] **Step 4: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Expected: `0 0`.

Result: `rtk git rev-list --left-right --count HEAD...@{u}` returned `0 0` after pushing the implementation and documentation commits.

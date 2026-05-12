# Arena Unstable Object Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, and use superpowers:verification-before-completion before marking it complete.

**Goal:** Close the common-object coverage gap from `docs/arena.md` by adding an unstable white-box plant and a stabilization challenge with official evaluation coverage.

**Gap Evidence:** `docs/arena.md` lists unstable systems under typical objects, while the current Arena catalogue covers first-order, second-order, higher-order, integrator, non-minimum-phase, and delay objects but has no unstable typical plant.

**Architecture:** Reuse the existing white-box evaluator and time-domain metric profile. Add one unstable transfer-function object and one stabilization task that accepts PID and serial-compensator submissions, then guard the positive and negative stability behavior with focused tests.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Unstable Plant Domain and Evaluation RED/GREEN

**Files:**
- Modify: `src/features/arena/data/seed-challenges.ts`
- Modify: `src/features/arena/submissions/prisma-store.ts`
- Test: `src/features/arena/__tests__/arena-domain.test.ts`
- Test: `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- Test: `src/features/arena/__tests__/arena-prisma-store.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- A typical unstable plant exists in `ARENA_CHALLENGE_OBJECTS`.
- A stabilization task points to that object.
- The task supports PID and serial-compensator submissions.
- Official white-box evaluation accepts a stabilizing controller and rejects a weak controller that leaves the loop unstable.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

- [x] **Step 2: Implement unstable object and task**

Add `plant-unstable-first-order` with model `G(s)=2/(s-1)` and `task-unstable-first-order-stabilization` using the existing white-box time-domain balanced profile.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

Result: 2 files / 27 tests passed after adding the stabilization scoring invariant.

Runtime bug fix: `/arena` crashed in local databases where the Arena submission tables have not been migrated yet. `prismaArenaSubmissionStore.listSubmissions()` now returns an empty list for Prisma `P2021` missing-table errors on the read path only; submission writes still fail normally instead of fabricating leaderboard data.

### Task 2: Verification, Review, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-w-unstable-object-coverage.md`

- [x] **Step 1: Run verification**

Run:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/features/arena/__tests__/arena-prisma-store.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Results:
- Focused Plan W and Prisma-store tests: 3 files / 29 tests passed.
- Arena targeted regression: 14 files / 106 tests passed.
- Real local reproduction: `prismaArenaSubmissionStore.listSubmissions()` returned `rows 0` against a database missing `public.ArenaSubmission`.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`: exit 0.
- `rtk npm run lint`: no ESLint warnings or errors.
- `rtk npm run test`: smoke test, Arena home entry, and Arena routes passed.
- `rtk npm run build`: production build passed after clearing stale `.next` output from an interrupted build.

- [x] **Step 2: Ask Hegel to review**

Use the existing Hegel subagent to review the Plan W implementation. Fix any blocker, high, or medium issues and re-review.

Review result: Hegel first found one high issue: the stabilization task used a profile that did not rank all `primaryMetrics`, which could produce valid zero-score submissions. The fix added `metric-whitebox-stabilization-balanced`, a domain invariant for task/profile metric alignment, and a `score > 0` evaluation assertion. Hegel re-review found no blocker, high, or medium issues. The same re-review covered the missing-table runtime fix and found no blocker, high, or medium issues.

- [x] **Step 3: Commit implementation**

Stage only Arena implementation and tests. Do not stage `AGENTS.md`.

Implementation commit: `14a543d8`.

- [x] **Step 4: Commit docs**

Stage only plan/progress docs.

- [x] **Step 5: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Result: `0 0`.

# Arena Robust Disturbance Challenge Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, and use superpowers:verification-before-completion before marking it complete.

**Goal:** Close the `docs/arena.md` advanced-method gap for a dedicated robust-control challenge by adding a white-box robust disturbance task with hidden-scenario scoring.

**Gap Evidence:** The current catalogue has MPC and optimization-assisted PID tasks with hidden scenarios, but no standalone robust-control challenge. `docs/arena.md` 第十八节第四阶段 explicitly lists `鲁棒控制挑战`.

**Architecture:** Reuse the existing deterministic white-box evaluator and hidden-scenario metric. Add a robust metric profile and task over an existing difficult white-box plant, without creating hardcoded leaderboard rows.

**Tech Stack:** TypeScript, Vitest.

---

### Task 1: Domain and Evaluation RED/GREEN

**Files:**
- Modify: `src/features/arena/data/seed-challenges.ts`
- Test: `src/features/arena/__tests__/arena-domain.test.ts`
- Test: `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- A dedicated robust disturbance task exists.
- The task uses a metric profile with `hiddenScenarioWorst`, `controlEnergy`, and `hidden_scenarios_passed`.
- The task supports current white-box controller classes and has Pareto/method/metric leaderboard types.
- Official white-box evaluation returns hidden-scenario metrics and rejects weak robust designs.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

- [x] **Step 2: Implement robust profile and task**

Add a robust disturbance metric profile and a task using an existing difficult white-box object.

Implementation note: the initial RED expected a delay-plant task, but the existing simplified white-box stability model rejects reasonable positive examples on `plant-delay-approximated`. The GREEN implementation therefore binds the robust disturbance task to `plant-ship-roll-whitebox`, where the evaluator already supports stable robust positive and hidden-scenario negative cases without changing the scoring model.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

Result: 2 files / 24 tests passed.

### Task 2: Verification, Review, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-v-robust-disturbance-challenge.md`

- [x] **Step 1: Run verification**

Run:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Results:
- Focused domain/evaluation tests: 2 files / 24 tests passed.
- Arena targeted regression: 13 files / 101 tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`: exit 0.
- `rtk npm run lint`: no ESLint warnings or errors.
- `rtk npm run test`: smoke test, Arena home entry, and Arena routes passed.
- `rtk npm run build`: production build passed.

- [x] **Step 2: Ask Hegel to review**

Use the existing Hegel subagent to review the Plan V implementation. Fix any blocker, high, or medium issues and re-review.

Review result: Hegel found one medium issue: the new robust profile did not declare `control_not_saturated` even though the selected ship-roll object causes the evaluator to enforce it. The profile and domain test were updated, and Hegel re-review found no blocker, high, or medium issues.

- [x] **Step 3: Commit implementation**

Stage only Arena implementation and tests. Do not stage `AGENTS.md`.

Implementation commit: `f31a7484`.

- [x] **Step 4: Commit docs**

Stage only plan/progress docs.

- [x] **Step 5: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Result: `0 0`.

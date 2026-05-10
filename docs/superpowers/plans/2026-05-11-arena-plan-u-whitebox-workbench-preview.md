# Arena White-Box Workbench Preview Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, and use superpowers:verification-before-completion before marking it complete.

**Goal:** Close the student-workbench gap found in the `docs/arena.md` audit by adding local white-box simulation preview and scheme comparison before official submission.

**Gap Evidence:** `docs/arena.md` requires the student workbench to include object information, controller design, simulation comparison, and submission areas. Current `challenge-detail.tsx` still says the page only establishes a task entry and reuses existing pages, while `ArenaSubmissionPanel` jumps from parameter editing to official submission without a local preview/comparison loop.

**Architecture:** Keep official rankings sourced only from persisted `ArenaSubmission`. Add a pure client-safe preview helper that builds a controller artifact, runs deterministic white-box evaluation locally, and compares the candidate against the latest persisted submission without writing evaluation/artifact/submission records.

**Tech Stack:** TypeScript, Next.js App Router, Vitest.

---

### Task 1: Preview Helper

**Files:**
- Add: `src/features/arena/submissions/workbench-preview.ts`
- Test: `src/features/arena/__tests__/arena-controller-artifact.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- A white-box workbench preview builds the same controller artifact shape used for official submission.
- Preview evaluation returns score, validity, metrics, and satisfaction without creating an `ArenaSubmission`.
- Preview comparison reports score delta and primary metric deltas against the latest real submission.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: failed as expected because `../submissions/workbench-preview` did not exist.

- [x] **Step 2: Implement preview helper**

Add a pure helper that composes `buildControllerArtifactFromParams` and `evaluateWhiteBoxSubmission`.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: `16` tests passed.

### Task 2: Student Workbench UI

**Files:**
- Modify: `src/features/arena/challenge-detail.tsx`
- Modify: `src/features/arena/submissions/arena-submission-panel.tsx`
- Test: `src/features/arena/__tests__/arena-controller-artifact.test.ts`

- [x] **Step 1: Write failing UI wiring guard**

Cover these behaviors:
- The challenge detail no longer claims that the current phase only establishes task entry.
- The submission panel exposes a local workbench preview action before official submission.
- The preview UI shows score, validity, metric values, and comparison with the latest real submission.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: failed as part of the focused RED run because the preview helper and UI wiring were absent.

- [x] **Step 2: Wire preview into the panel**

Add a "运行工作台仿真" action that updates preview state, sends `arena_simulation_run`, and renders preview/comparison cards. Keep official submission unchanged and keep leaderboards sourced from real persisted submissions.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: `16` tests passed.

### Task 3: Verification, Review, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-u-whitebox-workbench-preview.md`

- [x] **Step 1: Run verification**

Run:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Result:
- Focused workbench preview tests: `1` file, `16` tests passed.
- Arena targeted regression: `13` files, `99` tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> passed.
- `rtk npm run build` -> passed.

- [x] **Step 2: Ask Hegel to review**

Use the existing Hegel subagent to review the Plan U implementation. Fix any blocker, high, or medium issues and re-review.

Result: Hegel found one medium issue: the preview helper computed metric-level deltas, but the UI only displayed current metric values and total score delta. The fix renders `preview.comparison.metricDeltas` for every primary metric. Hegel re-review found no blocker, high, or medium issues.

- [x] **Step 3: Commit implementation**

Stage only Arena implementation and tests. Do not stage `AGENTS.md`.

Result: implementation commit `8a8a5b2d feat: add arena whitebox workbench preview`.

- [x] **Step 4: Commit docs**

Stage only plan/progress docs.

Result: docs are committed separately from implementation in the Plan U documentation commit.

- [x] **Step 5: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Expected: `0 0`.

Result: pushed to `codex/interactive-course-production`; `rtk git rev-list --left-right --count HEAD...@{u}` returned `0 0`.

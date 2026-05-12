# Arena Code Controller Safety Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, and use superpowers:verification-before-completion before marking it complete.

**Goal:** Add the safe pre-sandbox layer for code-type controller artifacts required by `docs/arena.md` without executing arbitrary student code inside the Next.js process.

**Architecture:** Treat code controllers as a separate controller artifact class. The artifact can be normalized and stored, but official Arena evaluation must fail closed unless an external sandbox capability explicitly validates execution. This phase does not create hardcoded leaderboard rows and does not add code-controller submissions to official rankings.

**Tech Stack:** TypeScript, Next.js App Router, Vitest.

---

### Task 1: Code Controller Artifact Contract

**Files:**
- Modify: `src/features/arena/types.ts`
- Modify: `src/features/arena/submissions/controller-artifact-builder.ts`
- Test: `src/features/arena/__tests__/arena-controller-artifact.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- `code-controller` is a known controller method but is not exposed by `getEvaluableControllerMethods`.
- Code controller artifacts require a fixed language, source hash, entry point, deterministic seed, dependency lock hash, time limit, and memory limit.
- Code controller artifacts reject inline source code and missing sandbox metadata.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: failed as expected because `buildCodeControllerArtifactFromManifest` did not exist.

- [x] **Step 2: Implement artifact normalization**

Add the `code-controller` method, a dedicated builder for safe metadata-only artifacts, and validation that keeps source code out of official payloads.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: `15` tests passed.

### Task 2: Official Evaluation Fail-Closed Path

**Files:**
- Modify: `src/features/arena/evaluation/evaluator.ts`
- Modify: `src/features/arena/evaluation/types.ts`
- Test: `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- `evaluateArenaSubmission` returns an invalid result for `code-controller` artifacts when no external sandbox result is attached.
- The rejection explains that network, model access, runtime, memory, deterministic seed, and dependency lock checks must be handled by the sandbox.
- Rejected code-controller artifacts do not receive a positive score.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`

Result: failed as expected because `code-controller` reached the white-box evaluator and threw an allowed-method error instead of returning a controlled invalid evaluation.

- [x] **Step 2: Implement fail-closed evaluator guard**

Add a shared invalid evaluation helper for unsupported code-controller execution and route code-controller submissions to that helper before white-box or black-box evaluation.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts`

Result: focused runs passed: `arena-controller-artifact.test.ts` -> `15` tests passed; `arena-whitebox-evaluation.test.ts` -> `15` tests passed.

### Task 3: Verification, Review, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-t-code-controller-safety.md`

- [x] **Step 1: Run verification**

Run:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Result:
- Focused code-controller and evaluate API tests: `3` files, `36` tests passed.
- Arena targeted regression: `13` files, `98` tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> passed.
- `rtk npm run build` -> passed.

- [x] **Step 2: Ask Hegel to review**

Use the existing Hegel subagent to review the Plan T implementation. Fix any blocker, high, or medium issues and re-review.

Result: Hegel found one medium issue: direct `/api/arena/evaluate` submissions could bypass the metadata-only builder and persist invalid `code-controller` artifacts. The fix moved task and method validation before hash/store calls in `createPersistedArenaSubmission`, reused the code-controller sanitizer, and tightened language/hash validation. Hegel re-review found no blocker, high, or medium issues.

- [x] **Step 3: Commit implementation**

Stage only Arena implementation and tests. Do not stage `AGENTS.md`.

Result: implementation commit `6d1a92ad feat: add arena code controller safety gate`.

- [x] **Step 4: Commit docs**

Stage only plan/progress docs.

Result: docs are committed separately from implementation in the Plan T documentation commit.

- [x] **Step 5: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Expected: `0 0`.

Result: pushed to `codex/interactive-course-production`; `rtk git rev-list --left-right --count HEAD...@{u}` returned `0 0`.

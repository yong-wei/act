# Arena Teacher Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add template-based Arena challenge configuration for teachers, covering the fields and template examples required by `docs/arena.md`.

**Architecture:** Keep template definitions and validation in `src/features/arena/teacher/configuration.ts`, expose template IDs through the existing teacher preview API, and render template controls in the teacher Arena page. This remains a configuration/preview layer; it does not create hardcoded leaderboard data or official submissions.

**Tech Stack:** TypeScript, Next.js App Router, Vitest.

---

### Task 1: Template Domain Model

**Files:**
- Modify: `src/features/arena/teacher/configuration.ts`
- Test: `src/features/arena/__tests__/arena-teacher-config.test.ts`

- [x] **Step 1: Write failing tests**

Cover these behaviors:
- Six templates exist: serial compensation, PID tuning, composite compensation, black-box identification control, virtual simulation closed-loop, and MPC constrained control.
- Each template carries target signal, disturbance, initial condition, allowed controller methods, hard constraints, metric weights, Pareto flag, hidden-test flag, grade-binding flag, public-leaderboard flag, and telemetry level.
- Publication preview can be created from a template and rejects template/task mismatches.

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts`

Result: failed because template APIs and API/UI wiring did not exist.

- [x] **Step 2: Implement template definitions and validation**

Add:
- `ArenaTelemetryLevel`
- `ArenaChallengeTemplate`
- `ARENA_CHALLENGE_TEMPLATES`
- `getArenaChallengeTemplate`

Extend `CreateArenaChallengePublicationInput` and `ArenaChallengePublication` with optional `templateId` and resolved configuration fields.

- [x] **Step 3: Verify focused tests**

Run:
`rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts`

Result: `rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts` passed.

### Task 2: API and Teacher UI Wiring

**Files:**
- Modify: `src/app/api/teacher/arena/preview/route.ts`
- Modify: `src/features/arena/teacher/teacher-arena-config.tsx`
- Test: `src/features/arena/__tests__/arena-teacher-config.test.ts`

- [x] **Step 1: Add API template payload**

Accept `templateId` in `/api/teacher/arena/preview` and return the resolved template configuration in the publication preview.

- [x] **Step 2: Add teacher UI template controls**

Add a template selector and preview rows for target signal, disturbance, initial condition, allowed methods, hard constraints, metric weights, Pareto, hidden tests, grade binding, leaderboard visibility, and telemetry level.

- [x] **Step 3: Verify integration guard**

Use a source-level guard in the teacher config test to confirm the API and UI consume `ARENA_CHALLENGE_TEMPLATES` and `templateId`.

Result: API test verifies template overrides; teacher config test verifies template/API/UI wiring and policy invariant guards.

### Task 3: Verification, Review, and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`
- Modify: `docs/superpowers/plans/2026-05-11-arena-plan-s-teacher-templates.md`

- [x] **Step 1: Run verification**

Run:
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-teacher-config.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/features/arena/__tests__/arena-profile.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts`
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
- `rtk npm run lint`
- `rtk npm run test`
- `rtk npm run build`

Result:
- Focused teacher tests: `2` files, `11` tests passed.
- Arena targeted regression: `13` files, `93` tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.
- `rtk npm run lint` -> passed.
- `rtk npm run test` -> passed.
- `rtk npm run build` -> passed.

- [x] **Step 2: Ask Hegel to review**

Review the Plan S implementation with the existing Hegel subagent. Fix any blocker/high/medium issues and re-review.

Result: Hegel first found two medium issues, then one medium issue after the first fix. Fixes added grade-binding consistency, editable teacher override fields, API override parsing, Pareto policy validation, and public leaderboard policy validation. Final Hegel re-review found no blocker, high, or medium issues; one low future hardening suggestion remains for invalid override rejection.

- [x] **Step 3: Commit implementation**

Stage only implementation and tests. Do not stage `AGENTS.md`.

Result: implementation commit `47498fca feat: add arena teacher challenge templates`.

- [x] **Step 4: Commit docs**

Stage only plan/progress docs.

Result: docs are committed separately from implementation in the Plan S documentation commit.

- [x] **Step 5: Push and verify sync**

Run:
`rtk git rev-list --left-right --count HEAD...@{u}`

Expected: `0 0`.

Result: pushed to `codex/interactive-course-production`; `rtk git rev-list --left-right --count HEAD...@{u}` returned `0 0`.

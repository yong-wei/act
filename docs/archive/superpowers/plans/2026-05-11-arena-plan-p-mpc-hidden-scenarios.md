# Plan P: MPC Template and Hidden Scenario Evaluation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for this child plan, and use `superpowers:verification-before-completion` before marking the phase complete.

**Goal:** Add the first bounded advanced-method path for Arena: parameterized MPC artifacts and a deterministic hidden-scenario evaluation signal.

**Architecture:** Keep MPC as a fixed template, not arbitrary code. The student submits horizon, weights, input limit, and sample time; the white-box evaluator maps that template to conservative closed-loop behavior and evaluates visible metrics plus a hidden-scenario worst-case metric. Leaderboards still consume only real `ArenaSubmission` records.

**Tech Stack:** TypeScript domain seeds, controller artifact builder, white-box evaluator, React submission panel, Vitest.

---

## Scope

- Add one MPC challenge task to the Arena catalogue.
- Expose `mpc` through `getEvaluableControllerMethods` only when the task allows it.
- Build a parameterized MPC `ControllerArtifact` from finite string inputs.
- Validate MPC ranges in official white-box evaluation before ranking.
- Add hidden-scenario worst-case performance to the advanced task metric profile.
- Extend the submission panel with MPC template fields.
- Update project progress documentation after implementation.

Out of scope for this phase:

- Running a real QP solver or model predictive optimizer.
- Allowing arbitrary controller code upload.
- Replacing black-box official evaluation with Rust virtual simulation backend batches.
- Teacher UI for editing hidden scenario sets.

## Success Criteria

- Domain tests confirm an MPC task exists, routes to predictive-control workspace, and exposes hidden-scenario ranking.
- Controller artifact tests confirm valid MPC templates are built and malformed values are rejected before official evaluation.
- White-box evaluator tests confirm valid MPC artifacts rank, invalid ranges fail hard constraints, and hidden-scenario metrics are present.
- Submission panel source test confirms MPC fields are mounted through the existing artifact builder.
- Standard verification, single-subagent review, implementation commit, documentation commit, and push complete with `HEAD...@{u}` at `0 0`.

## Implemented Files

- `src/features/arena/data/seed-challenges.ts`
- `src/features/arena/submissions/controller-artifact-builder.ts`
- `src/features/arena/evaluation/whitebox-evaluator.ts`
- `src/features/arena/submissions/arena-submission-panel.tsx`
- `src/features/arena/__tests__/arena-domain.test.ts`
- `src/features/arena/__tests__/arena-filtering.test.ts`
- `src/features/arena/__tests__/arena-controller-artifact.test.ts`
- `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- `docs/ProjectDescription.md`
- `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Verification Plan

- Red/green targeted tests:
  - `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- Extended Arena regression:
  - `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts`
- Standard phase checks:
  - `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - `rtk npm run lint`
  - `rtk npm run test`
  - `rtk npm run build`

## Review Gate

- Use the existing single subagent `Hegel` for implementation review.
- Fix any blocker, high, or medium finding.
- Re-review with `Hegel` before committing.

## Red Test

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
  - Initial result: failed as expected.
  - Failure covered missing MPC task, missing MPC artifact construction, missing evaluator support, and missing submission-panel MPC fields.

## Green Verification

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
  - Result: 3 files, 27 tests passed.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts`
  - Result: 10 files, 73 tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npm run test`
  - Result: smoke test, Arena home entry test, and Arena route test passed.
- `rtk npm run build`
  - Result: passed.

## Review Result

- Single subagent: `Hegel`.
- Findings: no blocker, high, medium, or low issues.
- Review confirmed the MPC path uses a fixed `bounded-linear-mpc` template, validates ranges server-side, keeps hidden-scenario pass/fail in hard constraints, submits through `/api/arena/evaluate`, and keeps leaderboards sourced from valid real `ArenaSubmission` records.

## Commit

- Implementation commit: `ce4900f3 feat: add arena mpc hidden scenario evaluation`.
- Push result: recorded after branch push.

# Plan Q: Optimization-Assisted PID Tuning

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for this child plan, and use `superpowers:verification-before-completion` before marking the phase complete.

**Goal:** Add a bounded optimization-tuning method to Arena without opening arbitrary controller code.

**Architecture:** Represent optimization tuning as a fixed `optimized-pid` controller artifact. The student chooses objective weights, search budget, and robustness weight; the official evaluator derives a deterministic PID-equivalent controller and evaluates it through the same white-box scoring path plus robust hidden-scenario diagnostics. Leaderboards still read only real `ArenaSubmission` rows.

**Tech Stack:** TypeScript domain seeds, controller artifact builder, white-box evaluator, React submission panel, Vitest.

---

## Scope

- Add `optimized-pid` as an Arena controller method.
- Add one robust optimization challenge task for the ship-roll white-box object.
- Build finite `optimized-pid` artifacts from objective weights and search budget.
- Validate optimization bounds server-side before ranking.
- Reuse real official evaluation and leaderboard infrastructure.
- Add hall/detail labels and method filtering support.

Out of scope for this phase:

- Arbitrary code controller upload.
- Real numerical optimizer workers or QP solvers.
- Teacher editing UI for optimization templates.
- Replacing the existing deterministic white-box evaluator with a plant simulator.

## Success Criteria

- Domain tests confirm `optimized-pid` is visible in the task catalogue and points to the predictive-control workspace.
- Filtering tests confirm the hall can filter by `optimized-pid`.
- Controller artifact tests confirm valid optimized PID templates are built and malformed inputs are rejected.
- White-box evaluator tests confirm valid optimized PID artifacts rank and adversarial optimization templates fail hard constraints.
- Submission panel and hall/detail source tests confirm labels and fields are wired.
- Standard verification, single-subagent review, implementation commit, documentation commit, and push complete with `HEAD...@{u}` at `0 0`.

## Implemented Files

- `src/features/arena/types.ts`
- `src/features/arena/arena-hall.tsx`
- `src/features/arena/challenge-detail.tsx`
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

## Red Test

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
  - Initial result: failed as expected.
  - Failure covered missing `optimized-pid` method, missing task, missing filter support, missing artifact construction, missing evaluator support, and missing panel fields.

## Green Verification

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
  - Result: 4 files, 38 tests passed.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts`
  - Result: 10 files, 79 tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npm run test`
  - Result: smoke test, Arena home entry test, and Arena route test passed.
- `rtk npm run build`
  - Result: passed.

## Verification Plan

- Red/green targeted tests:
  - `rtk npm run test:unit -- src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
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

## Review Result

- Single subagent: `Hegel`.
- Findings: no blocker, high, medium, or low issues.
- Review confirmed `optimized-pid` is a fixed `bounded-optimized-pid` artifact with objective weights and search budget only, server-side validation rejects invalid ranges before ranking, `hidden_scenarios_passed` remains a hard constraint, and leaderboard preview still only consumes valid real `ArenaSubmissionRecord` values returned from `/api/arena/evaluate`.

## Commit

- Implementation commit: `4edb52ff feat: add arena optimization tuning challenge`.
- Push result: recorded after branch push.

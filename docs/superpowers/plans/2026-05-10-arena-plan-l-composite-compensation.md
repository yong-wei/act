# Plan L: Composite Compensation Submission and Evaluation

## Scope

Implement the second-stage `docs/arena.md` gap for composite compensation:

- Make `composite-compensation` an officially evaluable white-box method for current LTI tasks.
- Represent a composite controller artifact with block-diagram-style parameters.
- Allow the existing student submission panel to build and submit the composite artifact.
- Keep leaderboard data sourced from real `ArenaSubmission` records.

Out of scope for this phase:

- A full graphical block-diagram editor.
- Black-box virtual simulation official evaluation.
- MPC or arbitrary code controller submission.

## Success Criteria

- `getEvaluableControllerMethods` includes `composite-compensation` only when the task allows it.
- `buildControllerArtifactFromParams` builds finite composite artifacts and rejects malformed inputs before official evaluation.
- `evaluateWhiteBoxSubmission` accepts a valid composite artifact for `task-third-order-block-diagram`.
- The submission panel exposes composite parameters for tasks that allow composite compensation.
- Method leaderboard entries can include real composite submissions.

## Implemented Files

- `src/features/arena/submissions/controller-artifact-builder.ts`
- `src/features/arena/evaluation/whitebox-evaluator.ts`
- `src/features/arena/submissions/arena-submission-panel.tsx`
- `src/features/arena/__tests__/arena-controller-artifact.test.ts`
- `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- `src/features/arena/__tests__/arena-leaderboard.test.ts`
- `docs/ProjectDescription.md`

## Red Test

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts`
  - Initial result: failed as expected.
  - Failure covered missing composite artifact construction, missing evaluator support, and missing submission-panel composite fields.

## Green Verification

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts`
  - Result: 3 files, 30 tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npm run test`
  - Result: smoke test, Arena home entry test, and Arena route test passed.
- `rtk npm run build`
  - Result: passed.

## Review

- Single subagent: `Copernicus`.
- Initial finding: blocker in composite scoring because `disturbanceCompensation` improved metrics without participating in stability or hard constraints.
- Fix: added explicit composite parameter bounds, included disturbance compensation in conservative equivalent loop gain, repaired `control_not_saturated` reason handling, and added an adversarial regression test.
- Re-review result: previous blocker closed; no blocker, high, or medium findings remained.

## Commit

Pending final commit hash.

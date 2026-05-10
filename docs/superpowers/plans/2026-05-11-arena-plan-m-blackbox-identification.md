# Plan M: Black-box Identification Submission and Evaluation

## Scope

Implement the next `docs/arena.md` gap for black-box virtual simulation tasks:

- Add an official black-box evaluation protocol for `task-cruise-roll-blackbox-identification`.
- Represent a black-box control artifact with identification quality, experiment count, and controller parameters.
- Add a student-facing black-box submission panel on Arena challenge detail pages.
- Emit the reserved `arena_identification_model_save` event from a production UI path.
- Keep leaderboard entries sourced from real `ArenaSubmission` records.

Out of scope for this phase:

- Full virtual-simulation backend execution.
- MPC or arbitrary code controller submission.
- Complete experiment-budget enforcement.
- A general black-box dataset manager.

## Success Criteria

- `buildBlackBoxControlArtifactFromParams` builds finite `black-box-control` artifacts and rejects malformed inputs before official evaluation.
- Official evaluation accepts a valid black-box artifact for `task-cruise-roll-blackbox-identification`.
- Official evaluation rejects missing, out-of-range, or unauthorized black-box parameters.
- Persisted Arena submissions route white-box and black-box tasks to distinct protocol versions.
- The challenge detail page mounts a black-box panel for black-box tasks without exposing white-box submission controls.
- The black-box panel sends `arena_identification_model_save`, `arena_controller_save`, `arena_submit`, and `arena_evaluation_complete`.

## Implemented Files

- `src/features/arena/submissions/blackbox-artifact-builder.ts`
- `src/features/arena/evaluation/blackbox-evaluator.ts`
- `src/features/arena/evaluation/evaluator.ts`
- `src/features/arena/submissions/arena-blackbox-submission-panel.tsx`
- `src/features/arena/submissions/persistence.ts`
- `src/features/arena/submissions/submission-service.ts`
- `src/features/arena/submissions/prisma-store.ts`
- `src/features/arena/challenge-detail.tsx`
- `src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`

## Red Test

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`
  - Initial result: failed as expected because `../evaluation/evaluator` did not exist.
  - Failure covered missing black-box official evaluation dispatch and black-box artifact builder.

## Green Verification

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`
  - Result: 1 file, 6 tests passed after first implementation.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts`
  - Result: 6 files, 46 tests passed after protocol filtering repair.
  - Result after review fixes: 6 files, 48 tests passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npm run test`
  - Result: smoke test, Arena home entry test, and Arena route test passed.
- `rtk npm run build`
  - Result: passed.

## Review

- Single subagent: `Hegel`.
- Initial findings: two medium issues and one low issue. The evaluator trusted client-claimed identification quality, invalid submissions still appeared in official leaderboards, and black-box panel mounting was wider than the server-side evaluator condition.
- Fixes: derive `identificationFit` from official parameter checks instead of the client claim, filter official leaderboard entries to valid submissions, and require `adapterType === 'virtual-simulation'` before mounting the black-box panel.
- Re-review: previous medium and low findings closed; no blocker, high, or medium findings remained.

## Commit

- Implementation commit: `9f1ad1ca feat: add arena blackbox evaluation`.
- Push result: recorded after branch push.

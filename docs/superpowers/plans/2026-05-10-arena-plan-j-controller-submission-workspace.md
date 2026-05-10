# Arena Plan J: Controller Submission Workspace

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for controller artifact behavior and one independent subagent review before commit.

**Goal:** Expand the student-side Arena submission workspace beyond PID so evaluable tasks can submit real PID and serial compensator controller artifacts without fake leaderboard or sample data.

**Architecture:** Keep controller artifact construction in a pure helper and let the UI call it. The white-box evaluator currently supports `pid` and `serial-compensator`; other methods remain visible in task metadata but are not submitted through this panel until their official evaluator exists.

---

## Files

- Add: `src/features/arena/submissions/controller-artifact-builder.ts`
- Modify: `src/features/arena/submissions/arena-submission-panel.tsx`
- Modify: `src/features/arena/challenge-detail.tsx`
- Add/Modify: `src/features/arena/__tests__/arena-controller-artifact.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for PID and serial compensator artifact construction.
- [x] Add failing tests that non-evaluable methods are excluded from this submission panel.
- [x] Replace PID-only submission UI with method-aware PID/serial parameter inputs.
- [x] Make challenge detail show the panel when any currently evaluable method is allowed.
- [x] Run targeted tests, lint, smoke, and build.
- [x] Request one independent subagent review; fix confirmed issues.
- [x] Commit and push only Plan J files.

## Verification Record

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts` first failed because `controller-artifact-builder` did not exist.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts` -> 1 file, 4 tests passed after implementation.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts` -> 3 files, 23 tests passed.
- Review follow-up added static component wiring guards for the submission panel and challenge detail.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-controller-artifact.test.ts` -> 1 file, 6 tests passed after review follow-up.
- `rtk npm run lint` -> passed.
- `rtk npm run build` first failed on a strict `ControllerArtifact['params']` typing issue in `controller-artifact-builder.ts`; fixed with explicit `ControllerArtifact['params']` annotation.
- `rtk npm run build` -> passed.
- `rtk npm run test` -> smoke, home entry, and arena routes passed.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'` -> passed.

## Review Record

- Independent subagent review by `019e1271-a696-7fb3-b1f5-f684cea73e2c` found no blocker. It noted a low-risk gap in component wiring coverage.
- Follow-up added static wiring guards for submission payload and challenge-detail panel mounting. Same subagent re-reviewed and passed the low-risk item.

## Commit Record

- Commit subject: `feat: expand arena controller submissions`
- Push: completed.

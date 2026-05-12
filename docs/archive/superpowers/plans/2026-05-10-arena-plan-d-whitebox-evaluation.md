# Arena Plan D: White-Box Evaluation MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add a deterministic first version of official white-box evaluation for PID and serial compensator artifacts.

**Architecture:** Evaluation is separate from the workspace. It accepts a task, a controller artifact, and an evaluation protocol, then returns validity, metrics, normalized satisfaction scores, penalties, and score explanation.

**Tech Stack:** TypeScript, existing control-system analysis helpers where suitable, Vitest.

---

## Files

- Create: `src/features/arena/evaluation/types.ts`
- Create: `src/features/arena/evaluation/whitebox-evaluator.ts`
- Create: `src/features/arena/evaluation/scoring.ts`
- Test: `src/features/arena/__tests__/arena-whitebox-evaluation.test.ts`
- Update: `docs/superpowers/plans/2026-05-10-arena-master-progress.md`

## Tasks

- [x] Add failing tests for valid PID evaluation, invalid unstable submission, metric normalization, and score explanation.
- [x] Run targeted tests and confirm expected failure.
- [x] Implement minimal deterministic evaluation for seed white-box tasks.
- [x] Implement hard constraints before ranking scores.
- [x] Implement weighted geometric scoring and penalties described in `docs/arena.md`.
- [x] Run targeted tests.
- [x] Run `npm run lint`.
- [x] Update this plan with verification results.
- [x] Commit and push only Plan D files.

## Verification Record

- Targeted tests: `rtk npm run test:unit -- src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-domain.test.ts` -> 2 files, 6 tests passed; `rtk node scripts/tests/test-arena-routes.mjs` -> passed.
- Red test evidence: first targeted run failed with missing `../evaluation/whitebox-evaluator`.
- Lint: `rtk npm run lint` -> passed with no ESLint warnings or errors.
- Commit: `a3b74599 feat: add arena whitebox evaluation`
- Push: `rtk git push` -> pushed to `codex/interactive-course-production`.

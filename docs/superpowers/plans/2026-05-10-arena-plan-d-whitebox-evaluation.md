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

- [ ] Add failing tests for valid PID evaluation, invalid unstable submission, metric normalization, and score explanation.
- [ ] Run targeted tests and confirm expected failure.
- [ ] Implement minimal deterministic evaluation for seed white-box tasks.
- [ ] Implement hard constraints before ranking scores.
- [ ] Implement weighted geometric scoring and penalties described in `docs/arena.md`.
- [ ] Run targeted tests.
- [ ] Run `npm run lint`.
- [ ] Update this plan with verification results.
- [ ] Commit and push only Plan D files.

## Verification Record

- Targeted tests: Pending
- Lint: Pending
- Commit: Pending
- Push: Pending

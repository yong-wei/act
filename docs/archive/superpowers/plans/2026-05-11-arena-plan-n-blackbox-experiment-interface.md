# Plan N: Black-box Experiment Interface and Dataset Flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for this child plan, and use `superpowers:verification-before-completion` before marking the phase complete.

**Goal:** Add the minimum official black-box experiment interface so virtual-simulation Arena tasks produce real experiment datasets before black-box controller submission.

**Architecture:** Keep the virtual-simulation backend hidden behind an Arena experiment service. The student UI can request bounded input-output datasets and save an identification artifact reference, but official evaluation still recomputes ranking metrics from the controller artifact and does not expose a transfer function. Experiments are persisted with a per-student daily budget so black-box tasks do not become unlimited server calls.

**Tech Stack:** TypeScript service layer, Next.js API route, Prisma persistence, Vitest route and unit tests.

---

## Scope

- Add a deterministic black-box experiment dataset generator for `task-cruise-roll-blackbox-identification`.
- Persist experiment metadata and dataset payloads as real student-owned records.
- Enforce a per-student daily experiment budget before creating a dataset.
- Add `/api/arena/blackbox-experiments` for authenticated student experiment runs.
- Update the black-box submission panel so students run an experiment, save the resulting identification model reference, and submit a controller artifact tied to a dataset hash.
- Keep official leaderboards sourced only from persisted `ArenaSubmission`; experiment records are not leaderboard rows.

Out of scope for this phase:

- Full Rust/WASM cruise backend execution for the official hidden scenario batch.
- General dataset manager UI outside the Arena black-box panel.
- MPC or arbitrary code controller submission.
- Teacher-facing budget configuration.

## Success Criteria

- Black-box experiments return sampled input-output data, scenario metadata, a dataset hash, budget usage, and no public transfer-function model.
- Non-student users cannot create Arena black-box experiment datasets.
- White-box or non-virtual tasks cannot call the black-box experiment interface.
- Daily experiment budget is enforced before persistence.
- Black-box controller artifacts must include an experiment dataset hash and identification model id before official evaluation.
- The black-box panel sends `arena_simulation_run`, `arena_virtual_simulation_import`, `arena_identification_model_save`, `arena_controller_save`, `arena_submit`, and `arena_evaluation_complete` from the production path.

## Implemented Files

- `src/features/arena/blackbox/experiment.ts`
- `src/features/arena/blackbox/experiment-service.ts`
- `src/app/api/arena/blackbox-experiments/route.ts`
- `src/app/api/arena/blackbox-experiments/__tests__/route.test.ts`
- `src/features/arena/__tests__/arena-blackbox-experiment.test.ts`
- `src/features/arena/submissions/blackbox-artifact-builder.ts`
- `src/features/arena/evaluation/blackbox-evaluator.ts`
- `src/features/arena/submissions/arena-blackbox-submission-panel.tsx`
- `src/features/arena/submissions/persistence.ts`
- `src/app/api/arena/evaluate/route.ts`
- `src/app/api/arena/evaluate/__tests__/route.test.ts`
- `src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260511102000_add_arena_blackbox_experiments/migration.sql`

## Verification Plan

- Red/green unit tests for black-box experiment generation, hidden model protection, task validation, budget enforcement, and artifact dataset binding.
- Route tests for authentication, student-only access, request validation, and service invocation.
- Targeted Arena tests:
  - `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/app/api/arena/blackbox-experiments/__tests__/route.test.ts`
- Schema checks:
  - `rtk npx prisma validate`
  - `rtk npx prisma generate`
- Standard phase checks:
  - `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - `rtk npm run lint`
  - `rtk npm run test`
  - `rtk npm run build`

## Verification Results

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/arena/blackbox-experiments/__tests__/route.test.ts`
  - Result after review fix: 4 files, 26 tests passed.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/arena/blackbox-experiments/__tests__/route.test.ts`
  - Result: 8 files, 58 tests passed.
- `rtk npx prisma validate`
  - Result: schema valid.
- `rtk npx prisma generate`
  - Result: Prisma Client generated.
- `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npm run test`
  - Result: smoke test, Arena home entry test, and Arena route test passed.
- `rtk npm run build`
  - Result: passed.

## Review Gate

- Use the single subagent for Plan N implementation review after local verification.
- Fix any blocker, high, or medium finding.
- Re-review with the same subagent before committing.

## Review Result

- Single subagent: `Hegel`.
- Initial finding: one high issue. Black-box official submissions could forge `experimentDatasetHash` and `identificationModelId`, bypassing the experiment API and daily budget.
- Fix: `createPersistedArenaSubmission` now verifies black-box experiment ownership before official evaluation lookup or creation. The submitted dataset hash must belong to the current `userId/taskId`, and `identificationModelId` must be derived from that dataset hash. `/api/arena/evaluate` passes the Prisma-backed experiment store into the persistence layer.
- Re-review: original high closed; no blocker, high, or medium findings remained.

## Commit

- Implementation commit: `a9b9edde feat: add arena blackbox experiment interface`.
- Push result: recorded after branch push.

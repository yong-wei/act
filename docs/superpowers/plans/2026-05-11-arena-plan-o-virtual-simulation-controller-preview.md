# Plan O: Virtual Simulation Controller Preview

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for this child plan, and use `superpowers:verification-before-completion` before marking the phase complete.

**Goal:** Add the minimum “apply controller to virtual simulation object” path for black-box Arena tasks before official leaderboard submission.

**Architecture:** Keep official ranking separate from exploratory preview. A student may run a controller preview only when the black-box controller artifact references one of their persisted experiment datasets; the preview run is persisted as a virtual-simulation run record and never becomes leaderboard data. The preview returns trace and summary feedback so the black-box workspace has the full experiment -> identify -> controller preview -> official submit loop.

**Tech Stack:** TypeScript service layer, Next.js API route, Prisma persistence, Vitest route and unit tests.

---

## Scope

- Add a deterministic virtual-simulation controller preview for `task-cruise-roll-blackbox-identification`.
- Persist preview run payloads as real student-owned records.
- Require the same student-owned experiment dataset binding used by official black-box submissions.
- Add `/api/arena/virtual-simulation-runs` for authenticated student preview runs.
- Update the black-box submission panel with an “apply controller to virtual simulation” preview action and summary display.
- Keep preview runs out of official leaderboards; only `/api/arena/evaluate` creates `ArenaSubmission` rows.

Out of scope for this phase:

- Replacing the deterministic preview with the full Rust cruise backend.
- Teacher-facing preview analytics.
- Hidden official scenario execution beyond the existing `blackbox-v1` evaluator.
- MPC or arbitrary code controller execution.

## Success Criteria

- Controller preview rejects unauthenticated and non-student requests.
- Controller preview rejects forged or cross-user `experimentDatasetHash` before simulation.
- Preview output includes closed-loop trace, tracking summary, safety summary, and controller effort.
- Preview output does not enter official leaderboards or create `ArenaSubmission`.
- The black-box panel can run experiment, save identification model, apply controller preview, then submit official evaluation.
- The panel sends `arena_simulation_run` for preview and keeps `arena_submit` reserved for official evaluation.

## Implemented Files

- `src/features/arena/blackbox/controller-preview.ts`
- `src/app/api/arena/virtual-simulation-runs/route.ts`
- `src/app/api/arena/virtual-simulation-runs/__tests__/route.test.ts`
- `src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts`
- `src/features/arena/submissions/arena-blackbox-submission-panel.tsx`
- `prisma/schema.prisma`
- `prisma/migrations/20260511113000_add_arena_virtual_simulation_runs/migration.sql`

## Verification Plan

- Targeted tests:
  - `rtk npm run test:unit -- src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/virtual-simulation-runs/__tests__/route.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`
- Schema checks:
  - `rtk npx prisma validate`
  - `rtk npx prisma generate`
- Standard phase checks:
  - `rtk git diff --check -- . ':(exclude)AGENTS.md'`
  - `rtk npm run lint`
  - `rtk npm run test`
  - `rtk npm run build`

## Verification Results

- `rtk npm run test:unit -- src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/virtual-simulation-runs/__tests__/route.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts`
  - Result: 4 files, 24 tests passed.
- `rtk npm run test:unit -- src/features/arena/__tests__/arena-virtual-simulation-preview.test.ts src/app/api/arena/virtual-simulation-runs/__tests__/route.test.ts src/features/arena/__tests__/arena-blackbox-experiment.test.ts src/features/arena/__tests__/arena-blackbox-evaluation.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/features/arena/__tests__/arena-telemetry-analytics.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/arena/blackbox-experiments/__tests__/route.test.ts`
  - Result: 10 files, 66 tests passed.
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

- Use the single subagent for Plan O implementation review after local verification.
- Fix any blocker, high, or medium finding.
- Re-review with the same subagent before committing.

## Review Result

- Single subagent: `Hegel`.
- Findings: no blocker, high, or medium issues.
- Review confirmed the preview API uses session identity, validates student-owned experiment datasets, keeps preview records out of `ArenaSubmission` and leaderboards, persists `ArenaVirtualSimulationRun`, keeps `arena_submit` reserved for official evaluation, and avoids client value imports of Prisma/crypto paths.

## Commit

- Implementation commit: `fa636729 feat: add arena virtual simulation previews`.
- Push result: recorded after branch push.

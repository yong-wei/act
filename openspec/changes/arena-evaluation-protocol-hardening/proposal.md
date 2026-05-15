## Why

Arena V2 has a working first-stage submission path, but the evaluation protocol boundary is still misleading: white-box submissions are labeled as protocol-managed while the official metrics still come from the heuristic `estimateMetrics` path, and legacy `whitebox-v1` submissions can still enter current leaderboards by default. This change hardens the current template-based evaluation layer before deeper analysis-based evaluation is introduced.

## What Changes

- Route all white-box template evaluation through an explicit synchronous metric provider instead of leaving an unused provider beside direct `estimateMetrics` calls.
- Keep `analysis-whitebox-v1` as a reserved protocol name only; keep current PID, serial compensator, composite compensation, optimized PID, and MPC submissions on `template-whitebox-v1`.
- Make protocol selection use one provider selector source so protocol version and evaluation provider cannot drift.
- Remove the default `whitebox-v1` leaderboard compatibility path; expose legacy protocol inclusion only through an explicit query/list option.
- Rename or isolate the random cruise-roll black-box adapter as a test-only mock, and keep production black-box experiment creation on the persisted budgeted service path.
- Collapse Arena event constants to a single source of truth for telemetry and event dictionary consumers without changing the current LearningFact materialization scope.
- Add import boundary entrypoints for Arena `domain`, `client`, and `server` and start moving current imports away from the broad root barrel.
- Update Arena execution/review docs to state the current truth: template white-box evaluation is active; analysis white-box evaluation is not active yet.

## Capabilities

### New Capabilities

- `arena-template-evaluation-protocol`: Current Arena template evaluation must use a single provider/protocol selector and must keep template white-box, black-box, and disabled code-controller protocols isolated.
- `arena-legacy-leaderboard-policy`: Arena submission listing must exclude legacy protocol submissions by default and include them only when the caller explicitly requests legacy protocol visibility.
- `arena-blackbox-adapter-boundary`: Production black-box experiment paths must not create random public datasets outside the persisted budgeted experiment service.
- `arena-module-boundary`: Arena imports must use explicit `domain`, `client`, and `server` entrypoints instead of treating the root barrel as the default cross-boundary import.

### Modified Capabilities

- None. This repository currently has no active baseline specs under `openspec/specs/`.

## Impact

- `src/features/arena/evaluation/whitebox-evaluator.ts`
- `src/features/arena/evaluation/whitebox-metric-provider.ts`
- `src/features/arena/evaluation/protocol.ts`
- `src/features/arena/submissions/prisma-store.ts`
- `src/features/arena/adapters/plant-adapter.ts`
- `src/features/arena/telemetry.ts`
- `src/features/arena/arena-event-dictionary.ts`
- `src/features/arena/index.ts`, plus new Arena entrypoint files
- Existing Arena unit tests under `src/features/arena/__tests__/`
- Arena docs and execution notes under `docs/arena/`

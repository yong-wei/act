## Why

Arena black-box tasks already have persisted experiments, virtual previews, official submissions, and leaderboard insertion, but the production path still lacks a real PlantAdapter registry and the black-box official evaluator still uses parameter estimates rather than hidden scenario execution. The first backend change should make object access and black-box official scoring production-grade before teacher reports, student feedback, or unified workbench routing depend on those results.

## What Changes

- Replace ad hoc black-box API wiring with a production PlantAdapter registry that selects adapters by Arena object and task.
- Keep the existing random cruise-roll adapter as test-only and prevent production APIs from using it.
- Route `/api/arena/blackbox-experiments` and `/api/arena/virtual-simulation-runs` through the registry while preserving budget, persistence, dataset ownership, and student-only access checks.
- Add a hidden black-box official scenario set and evaluator for cruise-roll black-box control submissions.
- Upgrade the black-box official protocol to `blackbox-official-v1` and keep legacy `blackbox-v1` behavior out of default official leaderboard scoring.
- Persist enough official evaluation metadata to recover the scenario set used for a black-box evaluation without exposing hidden scenario details to students.

## Capabilities

### New Capabilities

- `arena-blackbox-official-evaluation`: Hidden-scenario black-box official evaluation, metrics, protocol versioning, and result metadata for official submissions.

### Modified Capabilities

- `arena-blackbox-adapter-boundary`: Production black-box APIs use a registry-backed PlantAdapter path instead of direct service calls or test-only mock adapters.

## Impact

- `src/features/arena/adapters/**`
- `src/features/arena/blackbox/**`
- `src/features/arena/evaluation/**`
- `src/features/arena/submissions/persistence.ts`
- `src/app/api/arena/blackbox-experiments/route.ts`
- `src/app/api/arena/virtual-simulation-runs/route.ts`
- `src/app/api/arena/evaluate/route.ts`
- `prisma/schema.prisma` only if scenario-set metadata cannot be safely carried in the existing evaluation result payload
- Targeted Arena black-box, adapter, API route, evaluator, and persistence tests

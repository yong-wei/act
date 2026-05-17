## Why

Black-box Arena tasks already have budgeted experiments, persisted datasets, virtual simulation preview, and official submission checks, but the student experience lives in a special cruise simulation page. A unified black-box preset should make experiment, nominal model, controller draft, preview, and submission part of one workbench flow.

## What Changes

- Add a `BlackBoxIdentificationPreset` for black-box virtual simulation tasks.
- Use `/api/arena/blackbox-experiments` for all challenge-mode experiment data.
- Represent the student's model as a nominal working model, never as the official target.
- Add views for experiment data, identification model, nominal/black-box response comparison, controller draft, virtual preview, and submission.
- Continue validating dataset ownership before official submission.

## Capabilities

### New Capabilities
- `control-workbench-blackbox-identification`: Defines black-box experiment, nominal-model, virtual-preview, and official-submission behavior inside the unified workbench.

### Modified Capabilities

## Impact

- Adds black-box preset files under `src/features/control-workbench/`.
- Reuses `createArenaBlackBoxExperiment`, `/api/arena/blackbox-experiments`, `/api/arena/virtual-simulation-runs`, `buildBlackBoxControlArtifactFromParams`, and `/api/arena/evaluate`.
- Does not expose hidden transfer functions.
- No new persistence model for nominal models in the first version; client/session artifacts are enough unless implementation chooses an existing store.

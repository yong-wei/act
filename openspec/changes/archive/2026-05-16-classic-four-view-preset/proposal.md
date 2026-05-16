## Why

The existing multi-representation workbench is the most mature white-box SISO LTI design surface. It should become the first unified workbench preset instead of being replaced or duplicated.

## What Changes

- Introduce a classic four-view preset for PID and serial-compensator Arena tasks.
- Host the existing time-domain, Bode, root-locus, and Nyquist panels inside the unified workbench shell.
- Reuse current correction controls, Arena preview summary, and official artifact mapping.
- Keep `/interactive-learning/multi-representation-linkage` available as a legacy route during migration.

## Capabilities

### New Capabilities
- `control-workbench-classic-preset`: Defines the classic white-box SISO LTI preset inside the unified control workbench.

### Modified Capabilities

## Impact

- Touches `src/features/interactive/multi-representation-linkage/**` only to extract reusable pieces.
- Adds preset files under `src/features/control-workbench/presets/`.
- Reuses `ControlAnalysisRequest`, `ControlAnalysisResult`, `buildArenaArtifactFromMultiRepresentationState`, and `/api/arena/evaluate`.
- No official evaluation protocol change.

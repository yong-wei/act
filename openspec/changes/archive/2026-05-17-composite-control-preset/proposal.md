## Why

Composite compensation tasks currently route to a lesson page rather than a real Arena design workbench. They need a unified preset that exposes structure parameters, preview metrics, and official submission without depending on lesson-05 as the workspace.

## What Changes

- Add a `CompositeControlPreset` for `block-diagram-workbench` tasks.
- Provide a composite method panel for prefilter, feedforward, local feedback, disturbance compensation, and control limits.
- Generate `composite-compensation` controller artifacts from the preset.
- Submit official evaluations through `/api/arena/evaluate`.
- Keep lesson-05 as a learning page, not the Arena workbench for composite control.

## Capabilities

### New Capabilities
- `control-workbench-composite-preset`: Defines composite-control workbench behavior, parameters, views, and official artifact submission.

### Modified Capabilities

## Impact

- Adds `src/features/control-workbench/presets/composite-control-preset.tsx` and method-panel files.
- Reuses `buildControllerArtifactFromParams` support for `composite-compensation`.
- May use existing heuristic white-box evaluator for first official scoring.
- Later routing migration will move `block-diagram-workbench` tasks to this preset.

## Why

The report identifies Arena to challenge detail to Control Workbench as the platform's strongest product loop, while simulation scenes still live in separate shells. The active virtual-simulation series will add SceneSpec, trace, replay, evidence governance, model registry, course-resource launch, SceneShell decomposition, and feature materialization. The UI must present those as one continuous engineering workflow.

## What Changes

- Unify Simulation Hub, simulation scene pages, Arena hall/detail pages, and Control Workbench under a consistent experience shell.
- Add UI spaces for launch context, SceneSpec identity, trace/replay status, official/preview evaluation boundary, model registry status, course/standalone provenance, and evidence summary.
- Preserve physics, scoring, adapter, and trace contracts owned by active upstream changes.

## Capabilities

### New Capabilities
- `simulation-arena-workbench-experience-ui`: Defines the shared shell and workflow UI for simulations, Arena, and Control Workbench.

## Impact

- Affects simulation routes, Arena shells, challenge detail, Control Workbench shell, and shared status primitives.
- Depends on `unify-platform-design-system-and-shell` and `standardize-platform-status-and-evidence-ui`.
- Consumes the seven active virtual-simulation-platform-refactor changes.

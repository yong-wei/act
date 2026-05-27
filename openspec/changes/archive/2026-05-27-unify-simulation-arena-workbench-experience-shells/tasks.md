## 1. Experience Shell

- [x] 1.1 Define a shared simulation/Arena/Workbench shell layout with context header, workflow navigation, main stage, side panels, and status rail.
- [x] 1.2 Define launch-context display for standalone, course-launched, Arena preview, and official evaluation workflows.
- [x] 1.3 Define model relation and registry status display for Arena-bound workflows.

## 2. Module Migration Contracts

- [x] 2.1 Specify Simulation Hub and scene page migration through SceneShell-compatible adapters.
- [x] 2.2 Specify Arena hall/detail migration while preserving challenge detail read-only and Workbench launch behavior.
- [x] 2.3 Specify Control Workbench shell slots for submission, metrics, replay, evidence, and return navigation.
- [x] 2.4 Specify course-launched behavior that preserves `ResourceRenderer`, `InteractiveProvider`, `BaseWidgetProps`, and registry/TeachingResource/LessonItem config merge order.

## 3. Validation

- [x] 3.1 Add tests for official/preview boundary rendering, launch provenance, replay state, and Workbench context persistence.
- [x] 3.2 Add course-launch regression coverage for lesson item provenance, progress callbacks, and embedded/standalone mode behavior.
- [x] 3.3 Validate with `rtk proxy openspec validate unify-simulation-arena-workbench-experience-shells --strict`.

# Pole Manipulator Interactive Module (Enhancements)

## Goal
- Enhance the Pole Manipulator interactive module to meet updated S-plane interaction, challenge logic, naming, and curriculum placement requirements.

## Scope
- In-scope: rename to 极点操纵器, S-plane + response zoom/pan + ticks, lock modes (Re/Im/ζ/ωn), polar grid, updated challenge mode, data capture, interactive-learning entry verification, preset lesson update, docs, tests.
- Out-of-scope: new backend analytics services beyond existing InteractiveProvider/event pipeline.

## Steps
1) Audit current Pole Manipulator implementation, lesson entry, and time-domain listing coverage.
2) Refactor the module for zoom/pan, axis ticks, lock modes (Re/Im/ζ/ωn), polar grid, and revised challenge flow.
3) Rename to 极点操纵器 across registry/seed/lesson/UI and ensure time-domain entry is visible in interactive-learning.
4) Update docs/ProjectDescription.md and run lint/test/build/integration tests.

## Tests
- npm run lint
- npm run test
- npm run build
- npm run test:integration

## Acceptance
- Free exploration available under /interactive-learning with the new module.
- Resource is registered and usable in lesson plans.
- Challenge mode scores/time are recorded via InteractiveProvider.
- A time-domain analysis preset lesson includes this resource.
- Docs updated and all required tests pass.

## Context

The cruise simulation page already has a credible product shape: central 3D scene, left status, right controls, bottom camera/tools. Control Workbench has strong analytical content but too many equally weighted cards. Arena and interactive runtime need the same task context and return-navigation rules.

## Goals / Non-Goals

**Goals:**

- Create a shared immersive shell for simulation scenes.
- Create a shared engineering analysis shell for Control Workbench and compatible Arena/lesson tasks.
- Keep provenance, return navigation, official/preview status, and lesson context visible.

**Non-Goals:**

- Changing physics, scoring, replay, or lesson-engine contracts.
- Rebuilding all Arena task internals.
- Redesigning public simulation hub, which belongs to the entry-surface change.

## Decisions

### Decision 1: Treat simulation scenes as full-bleed workspaces

The primary scene should remain central and unframed, with status and controls as operational overlays or rails.

### Decision 2: Treat Control Workbench as an engineering canvas

The workbench should use step flow, chart canvas, parameter controls, and evidence/status rails instead of generic stacked cards.

### Decision 3: Context provenance is mandatory

Every task workspace should show whether it is standalone, course-launched, Arena preview, official evaluation, or teacher/admin review.

## Validation

- `rtk openspec validate unify-immersive-task-workspaces --strict`
- Visual QA for representative simulation scene, Control Workbench, Arena task, and interactive course runtime page in light and dark themes.
- Browser checks for panel stability, floating dock placement, and return navigation.

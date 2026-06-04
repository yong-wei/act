## Why

Simulation scenes and Control Workbench already contain the strongest product patterns in the system, but they are isolated from Arena, interactive runtime, and the platform shell. The result is a powerful tool experience without a unified navigation or visual grammar.

This change unifies immersive simulations, engineering workbenches, Arena task contexts, and interactive runtime task surfaces.

## What Changes

- Define shared immersive task workspace and engineering workbench route frames.
- Align simulation scene, Control Workbench, Arena challenge, and interactive runtime navigation.
- Standardize context strip, command bar, instrument area, evidence rail, support drawer, and floating dock behavior for task pages.
- Preserve domain ownership for simulation physics, official evaluation, lesson runtime, and Arena scoring.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-arena-workbench-experience-ui`: add immersive and engineering workspace requirements.
- `commercial-workspace-surface-system`: add task-workspace layout and panel hierarchy rules.

## Impact

- Affects `/simulations/:id`, `/interactive-learning/control-workbench`, Arena task surfaces, and representative interactive course runtime task pages.
- Depends on `define-premium-platform-ui-foundation`.
- Does not change simulation models, WASM/runtime contracts, or official evaluation semantics.

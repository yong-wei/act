## Why

The project uses Three.js, React Three Fiber, Drei, and force-graph packages for simulations and knowledge visualization. These packages are coupled to React and browser canvas behavior, so they should be migrated after the React runtime is stable.

## What Changes

- Upgrade Three.js, React Three Fiber, Drei, and related 3D/graph visualization packages to selected latest stable versions.
- Resolve API and type compatibility issues in simulation and graph components.
- Validate canvas rendering, interaction, and responsive layout in browser.
- Keep unrelated dependency lanes out of scope.

## Capabilities

### Modified Capabilities
- `stable-dependency-chain-migration`: Requires 3D and visualization upgrades to include browser canvas verification.
- `simulation-scene-shell-architecture`: Preserves simulation scene shell behavior through visualization dependency migration.

## Impact

- Affects 3D simulation components, model preview components, knowledge graph canvases, and package versions.
- Requires browser/canvas validation, not just TypeScript tests.

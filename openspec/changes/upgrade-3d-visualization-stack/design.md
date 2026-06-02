## Visualization Migration Focus

Candidate packages include:

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `react-force-graph-2d`
- `react-force-graph-3d`

React Three Fiber latest stable currently peers against React 19, so this change should follow the React runtime migration.

## Browser and Canvas Checks

Validation must prove that canvas surfaces are nonblank and interactive:

- Simulation landing page.
- At least one ship simulation route.
- Ship model preview or equivalent 3D model component.
- Knowledge graph 2D route.
- Any route using force-graph 3D if available.

Desktop and mobile framing should be checked where the page is expected to support both.

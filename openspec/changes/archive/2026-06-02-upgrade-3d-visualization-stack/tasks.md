## 1. Visualization Upgrade

- [x] 1.1 Upgrade Three.js, React Three Fiber, Drei, and selected graph visualization packages to latest stable compatible versions.
- [x] 1.2 Resolve TypeScript and API compatibility issues in simulation and graph components.
- [x] 1.3 Keep framework, database, and design-system migrations out of scope unless required to preserve already-migrated React compatibility.

## 2. Browser and Canvas Validation

- [x] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [x] 2.2 Run `rtk npm run test`.
- [x] 2.3 Run `rtk npm run test:unit`.
- [x] 2.4 Run `rtk npm run build`.
- [x] 2.5 Use browser or Playwright checks to verify representative 2D/3D canvases are nonblank, framed correctly, and interactive.
- [x] 2.6 Validate at least one desktop and one mobile viewport for responsive canvas layout.

## 3. OpenSpec Validation

- [x] 3.1 Run `rtk openspec validate upgrade-3d-visualization-stack --strict`.

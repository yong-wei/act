## 1. Visualization Upgrade

- [ ] 1.1 Upgrade Three.js, React Three Fiber, Drei, and selected graph visualization packages to latest stable compatible versions.
- [ ] 1.2 Resolve TypeScript and API compatibility issues in simulation and graph components.
- [ ] 1.3 Keep framework, database, and design-system migrations out of scope unless required to preserve already-migrated React compatibility.

## 2. Browser and Canvas Validation

- [ ] 2.1 Run `rtk npx tsc --noEmit --pretty false`.
- [ ] 2.2 Run `rtk npm run test`.
- [ ] 2.3 Run `rtk npm run test:unit`.
- [ ] 2.4 Run `rtk npm run build`.
- [ ] 2.5 Use browser or Playwright checks to verify representative 2D/3D canvases are nonblank, framed correctly, and interactive.
- [ ] 2.6 Validate at least one desktop and one mobile viewport for responsive canvas layout.

## 3. OpenSpec Validation

- [ ] 3.1 Run `rtk openspec validate upgrade-3d-visualization-stack --strict`.

## Why

Unit 1-2 now needs a precomputed 3D magnitude surface that students can rotate and zoom, but the current manifest runtime renders `compute.panel` / `interactive-figure` as summary or image panels rather than an interactive 3D surface. The data is static, so the missing capability is a frontend surface viewer, not a Rust/WASM numerical engine.

## What Changes

- Add a reusable manifest-driven static 3D surface panel for `compute.panel` modules.
- Support precomputed mesh data, camera controls, axis labels, pole markers, color scale metadata, default view, and reset view.
- Register a dedicated compute capability for static 3D surfaces so lessons do not misrepresent the panel as a generic `interactive-figure`.
- Route Unit 1-2's `pole_magnitude_3d` surface panel through the new capability while keeping static image references available as fallback evidence.
- Extend validation/tests so unregistered 3D surface payloads fail before runtime.

## Capabilities

### New Capabilities
- `static-surface-3d-panel`: A manifest-driven frontend viewer for precomputed 3D surface meshes rendered with existing Three.js / React Three Fiber dependencies.

### Modified Capabilities
- `interactive-module-taxonomy`: Register and validate the `static-surface-3d` compute capability for canonical `compute.panel` modules.
- `interactive-course-standard-module-migration`: Require standard-module lessons that use static 3D surfaces to render through the shared compute panel path, not lesson-private visual components.

## Impact

- `src/features/interactive/shared/manifest-runtime/*` compute panel rendering and gate logic.
- New shared frontend component for static 3D surfaces, likely under `src/features/interactive/shared/` or `src/resources/control-system/`.
- Unit 1-2 authoring/runtime contract for the pole magnitude surface panel.
- Tests for module taxonomy, manifest runtime rendering, and Unit 1-2 surface routing.

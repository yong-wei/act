## Context

Unit 1-2 introduces a precomputed 3D magnitude surface for explaining why poles appear as geometric singularities. The current manifest runtime can validate `compute.panel` with `capabilityRef: interactive-figure`, but the shared renderer falls back to summary or image panels and does not provide a rotate/zoom 3D surface viewer. The repository already includes Three.js, React Three Fiber, and drei, so this change does not need a new rendering dependency or a Rust/WASM numerical path.

## Goals / Non-Goals

**Goals:**

- Provide a shared frontend component for static, precomputed 3D surface meshes.
- Expose it through canonical `compute.panel` manifests with a registered `static-surface-3d` compute capability.
- Support the Unit 1-2 pole magnitude surface without creating lesson-private renderer variants.
- Preserve static image fallback evidence for review, accessibility notes, and low-capability environments.
- Add tests and gate coverage so unsupported 3D surface payloads fail before classroom runtime.

**Non-Goals:**

- No Rust/WASM numerical engine for this change.
- No dynamic transfer-function recomputation or parameter sliders.
- No general 3D scene authoring framework beyond the static surface panel contract.
- No changes to activity response scoring beyond optional parameter/observation evidence already supported by canonical response kinds.

## Decisions

1. Use a dedicated `static-surface-3d` compute capability.

   `interactive-figure` is too broad and currently behaves like an image/summary fallback. A named capability lets the registry gate, renderer, and lesson contract agree that the module requires an interactive 3D surface viewer.

2. Keep surface data precomputed and manifest-addressable.

   The component should consume a compact mesh payload or a referenced JSON data asset containing vertices/grid samples, indices or regular-grid dimensions, color scale metadata, axis labels, markers, and default camera settings. This keeps runtime behavior deterministic and avoids unnecessary Rust.

3. Render with existing React Three Fiber / drei primitives.

   The project already depends on `three`, `@react-three/fiber`, and `@react-three/drei`. The implementation should use those dependencies with `OrbitControls`, bounded device-pixel ratio, reset-view behavior, and a nonblank fallback state.

4. Route through shared manifest runtime.

   The renderer selection should live in the shared manifest compute-panel path, keyed by `module.payload.capabilityRef === "static-surface-3d"` or an equivalent registered capability resolver. Unit 1-2 should not introduce a course-local `step-panels.tsx` renderer solely for this surface.

5. Keep image fallback and accessibility text.

   The static PNG/SVG remains useful for review artifacts, loading failure fallback, and screen-reader/teacher explanation. The interactive component should display teaching-semantic title/caption text rather than implementation labels.

## Risks / Trade-offs

- [Risk] Large precomputed mesh payloads may increase bundle or page load cost. → Mitigation: store data as a runtime asset, cap grid resolution, and lazy-load the 3D viewer only when the panel is visible.
- [Risk] WebGL availability varies across browsers/devices. → Mitigation: provide an image fallback and explicit unavailable state.
- [Risk] Orbit controls can conflict with page scroll on touch devices. → Mitigation: constrain panel height, use pointer capture intentionally, and keep reset-view controls visible.
- [Risk] A too-general payload format may become an unsupported mini scene language. → Mitigation: limit the contract to surface mesh/grid, axes, markers, color scale, caption, and camera.

## Migration Plan

1. Add the registered `static-surface-3d` compute capability and registry gate tests.
2. Implement the shared static surface viewer and manifest compute-panel routing.
3. Move Unit 1-2 `pole_magnitude_3d` from generic `interactive-figure` to `static-surface-3d`.
4. Add or reference the precomputed surface data asset.
5. Run manifest audit, registry gate tests, Unit 1-2 runtime review, and browser/Playwright smoke checks for a nonblank rotatable panel.

## 1. Token Mapping

- [x] 1.1 Define simulation theme roles for canvas, translucent shell, panel, toolbar, hint, border, text, status, evidence, replay, preview, and official context.
- [x] 1.2 Map roles to existing platform and commercial brand tokens for light and dark themes.
- [x] 1.3 Identify and remove page-local palettes from migrated simulation surfaces.

## 2. Template Application

- [x] 2.1 Apply the light/dark catalog template to `/simulations`.
- [x] 2.2 Apply the light/dark `SimulationShell` template to representative detail pages.
- [x] 2.3 Apply consistent translucent treatment to top, side, control, and bottom panels.
- [x] 2.4 Ensure 3D scene colors remain readable under both shell templates.

## 3. State Semantics

- [x] 3.1 Define status and evidence color use for preview, official, replay, warning, success, danger, and unavailable states.
- [x] 3.2 Verify theme switching preserves contrast for labels, buttons, forms, and status markers.
- [x] 3.3 Ensure no generic AI gradients, decorative glow blobs, or page-local hero treatments are introduced.

## 4. Acceptance

- [x] 4.1 Capture `/simulations` and representative detail pages in light and dark themes.
- [x] 4.2 Verify text contrast, scene visibility, toolbar readability, and panel boundaries.
- [x] 4.3 Run token governance checks and `rtk openspec validate define-simulation-dual-theme-templates --strict`.

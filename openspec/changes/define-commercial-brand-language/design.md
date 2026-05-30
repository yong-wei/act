## Context

Recent UI review found that the platform already has semantic tokens and role-aware shell primitives, but visual identity is still fragmented across `surface-*`, `interactive-course-hub-*`, `premium-lesson-*`, `admin-console-*`, and page-local slate/emerald/violet palettes. The commercial direction should allow bold replacement of unreasonable old shells instead of merely adapting them.

## Design Direction

The brand idea is `maritime control learning system`: a commercial-grade platform for control theory learning, simulation, Arena challenges, evidence-based personalization, and teacher governance.

Core metaphors:

- Navigation trace: learning path, vessel path, and mission flow.
- Feedback loop: control reasoning, evidence, adjustment, and reflection.
- Instrument grid: engineering workspace, evaluation, and governance.

Logo exploration should use an abstract mark derived from trace plus feedback loop, optionally with `A/C` geometry. It should not use literal ship clipart, rocket icons, generic AI sparkles, or copied crests.

## Visual System

- Palette: deep maritime base, steel-blue surfaces, navigation-cyan primary accent, muted chart blue, buoy-amber warning, subdued green/red status colors.
- Typography: use a distinctive sans display/body stack with Chinese fallbacks; numbers and metrics must use tabular figures or a mono numeric treatment.
- Surfaces: limit to canvas, panel, instrument, overlay, and status variants. Cards are no longer the default grouping primitive.
- Motion: use short transform/opacity transitions for state changes. No broad decorative motion on dense product pages.
- Texture: brand texture may use subtle chart grid, scanline, or map-grain treatments, but only as a low-contrast system layer.

## Brand Applications

The brand contract should include application expectations for favicon, app mark, navigation logo, login/auth panel, course badge, Arena badge, workbench instrument chrome, report watermark, and teacher/admin governance snapshot. The goal is not to finalize raster artwork in this change, but to make later implementation verify the same visual world across product, learning, and operations surfaces.

At least one brand application board or equivalent design reference should show how the mark, palette, typography, instrument surface, evidence status, and navigation treatment coexist. Without this, downstream work can satisfy the words while still looking visually unrelated.

## Boundaries

This change creates the brand contract only. It does not migrate pages, introduce new dependencies, or generate final raster assets. Later changes may replace existing UI shells when they conflict with the brand contract.

## Risks

- If the brand language remains only prose, later work can still drift. A later governance change must add source and visual checks.
- If the brand mark becomes literal maritime decoration, the platform will feel less like a commercial control system. Keep the mark abstract and scalable.

## Verification

- Strict OpenSpec validation.
- Design review against homepage, Arena, workbench, adaptive practice, and interactive lesson hub use cases before implementation begins.
- Design review against login/auth, teacher workspace, admin governance, and report-watermark use cases before implementation begins.

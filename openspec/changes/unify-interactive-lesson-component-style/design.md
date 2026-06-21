## Context

Manifest-first interactive lessons render page title modules in `layout-renderer.tsx` as `premium-lesson-panel`, while content modules are first wrapped by `commercial-module-chrome` and then often render their own `premium-lesson-panel`. Recent visual repairs made several module chrome classes transparent with `display: contents`, but this is incomplete and still allows visible shell drift, module-local spacing, and renderer-local font sizing.

The user-facing requirement is a courseware style contract: every visible course page component should look like the page title module, component spacing should be controlled by the shared page layout, and typography should follow semantic heading levels rather than local renderer choices.

## Goals / Non-Goals

**Goals:**

- Provide one visible courseware panel exterior for page titles, content modules, visual modules, activities, and compute panels in all manifest-first interactive lessons.
- Make component-to-component vertical spacing a shared runtime layout concern.
- Introduce explicit typography tokens/classes for:
  - level 1 page title;
  - level 2 module title;
  - level 3 in-module title;
  - unified body text.
- Add tests/gates that reject visible double shells, page-local module spacing overrides, and renderer-local text-size drift across the manifest-first runtime inventory.
- Use 1-2 as the first acceptance course because it exercises title, figure, card set, visual stage, derivation stage, block diagram, signal flow graph, annotated media, activity, table, and compute modules.

**Non-Goals:**

- No new route, API, database, or evidence schema.
- No change to lesson content meaning, manifest module taxonomy, or student submission contracts.
- No migration of older non-manifest course-private `step-panels.tsx` implementations. Any such implementation must be listed as a migration exception and must not be counted as satisfying the manifest-first courseware component contract.
- No redesign of the full LessonRuntimeShell navigation or teacher/student classroom flow.

## Decisions

### Decision 1: Make `premium-lesson-panel` the only visible courseware exterior

All manifest-first courseware modules should render a visible `premium-lesson-panel` as their outer visual surface. `commercial-module-chrome` remains as the shared data/metadata wrapper but should be visually transparent (`display: contents`) for standard interactive lesson modules that render their own panel.

Alternatives considered:

- Keep `commercial-module-chrome` visible for content and compute modules. Rejected because it creates a different shape from the page title panel and can cause double-shell nesting.
- Remove `commercial-module-chrome` entirely. Rejected because it carries module metadata, governance data attributes, control-scope markers, and standard-class identification.

### Decision 2: Centralize courseware spacing in the manifest layout renderer

The shared step layout should own component spacing through a governed class such as `interactive-courseware-stack` or equivalent. Individual pages, lesson-specific runtime adapters, lesson manifests, and module renderers should not add outer `mt-*`, `mb-*`, `space-y-*`, or wrapper gap classes to change spacing between sibling courseware modules.

Internal component spacing remains allowed through semantic panel-body classes, but cross-component spacing must be page-runtime controlled.

### Decision 3: Replace freeform text sizing with semantic courseware typography

Introduce shared classes for courseware hierarchy. The class names are contract identifiers; implementation may define them in global CSS or an equivalent shared style layer, but renderers must not replace them with local Tailwind font-size choices.

- `interactive-courseware-title-level-1`: page title.
- `interactive-courseware-title-level-2`: module title.
- `interactive-courseware-title-level-3`: in-module subsection title.
- `interactive-courseware-body`: all body copy, matching the current PPT derivation body size token, equivalent to `text-base leading-7 md:text-lg md:leading-8`.
- `interactive-courseware-caption`: auxiliary labels and captions.
- `interactive-courseware-control`: compact control text, buttons, tabs, and toolbar labels.

Required default scale:

- level 1: 24px title with line height no less than 36px.
- level 2: 22px title with line height no less than 32px.
- level 3: 20px title with line height no less than 30px.
- body: 16px/28px, upgrading to 18px/32px at the existing responsive breakpoint used by the PPT derivation component.

Renderers should use these classes instead of choosing `text-sm`, `text-lg`, `text-2xl`, etc. locally. Level 2 and level 3 should be larger than the current compact module title treatment, but level 2 must remain smaller than or equal to level 1, and level 3 must remain smaller than level 2.

Heading semantics are part of the contract. The page title should render as an `h1` or `role="heading" aria-level="1"` equivalent. Top-level module titles should render as `h2` or `aria-level="2"`. In-module subsection titles should render as `h3` or `aria-level="3"`. The visual class alone is insufficient.

### Decision 4: Gate both structure and rendered output

Tests should cover:

- the manifest-first runtime inventory resolves all registered courseware module families to the shared shell, spacing, and typography contract;
- standard module visual standards resolve to transparent chrome where the renderer provides a panel;
- title module and standard module panels expose the same visible shell family;
- rendered runtime output contains courseware typography markers;
- known local freeform typography patterns are absent from shared manifest runtime renderers for courseware title/body text;
- 1-2 renders with the unified shell and typography contract.

Allowed exceptions should be explicit and narrow:

- Formula glyph sizing may be controlled by the math renderer when needed for legibility, but surrounding explanatory text must use `interactive-courseware-body`.
- Control microcopy may use `interactive-courseware-control`, but ordinary explanations, prompts, figure notes, and activity text may not.
- Captions may use `interactive-courseware-caption`, but captions must be semantically marked and cannot become a substitute for body copy.
- Legacy non-manifest private course pages may remain as registered migration exceptions; they must be named in the inventory report and cannot add new freeform style patterns.

Browser visual evidence remains necessary for final implementation review, but automated tests should catch the most common regression before visual QA.

### Decision 5: Require traceable visual evidence for style changes

Implementation acceptance must include traceable browser evidence compatible with the existing interactive visual governance contract. Evidence filenames or metadata should identify component, route, role, theme, viewport, and state.

Minimum acceptance matrix:

- lesson 1-2 student route and teacher route;
- light and dark themes;
- desktop, mobile, and projection-sized viewport;
- representative states for title panel, content figure, derivation stage, block diagram, signal flow graph, activity panel, table/rich content, and compute panel;
- manifest audit and unit tests linked to the same change.

## Risks / Trade-offs

- Shared typography changes can shift existing lesson layout. Mitigation: use the manifest-first inventory, 1-2 student/teacher screenshots, and unit tests first; keep changes in shared runtime classes rather than per-page patches.
- Some compute/workbench panels may have dense controls that need smaller labels. Mitigation: body copy follows the unified size, while captions and control micro-labels use `interactive-courseware-caption` with explicit semantics.
- Legacy course-private panels remain inconsistent. Mitigation: this change governs manifest-first shared runtime and prevents new drift; older private panels can be migrated in later changes.
- Transparent `commercial-module-chrome` can hide useful debugging visual boundaries. Mitigation: keep data attributes and registry gates; do not rely on visible wrapper borders for debugging.

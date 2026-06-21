## Why

Interactive lesson pages currently mix two visible shell systems: page title panels use `premium-lesson-panel`, while some module classes still show `commercial-module-chrome` or local wrapper styles. Typography and vertical spacing are also set inside individual renderers, which makes course pages visually inconsistent and allows page-local font and spacing drift.

## What Changes

- Make every manifest-first interactive lesson courseware component use the same visible panel exterior as the page title module.
- Force page-level vertical spacing between courseware components through the shared lesson runtime layout, not through individual pages, lesson manifests, or module renderers.
- Define courseware typography by semantic heading hierarchy:
  - page title is level 1;
  - module titles are level 2;
  - titles inside a module are level 3.
- Increase level 2 and level 3 title sizes while keeping each lower level smaller than its parent level.
- Make all body copy use the same body size token as the current PPT-style derivation component body text: `text-base leading-7 md:text-lg md:leading-8`, represented through a shared primitive rather than page-local classes.
- Add governance gates that reject page-local typography and spacing overrides in manifest-first interactive course runtime components.
- Add a manifest-first courseware inventory gate so the change proves coverage across registered runtime module families, not only lesson 1-2 screenshots.
- Preserve runtime manifest truth and existing component behavior; this change standardizes presentation, not lesson semantics.
- Document any older non-manifest course-private implementation as an explicit migration exception; it is not evidence that the manifest-first requirement has been satisfied.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: add interactive lesson courseware component shell, spacing, and typography hierarchy requirements.
- `commercial-ui-governance-gates`: add blocking governance for interactive lesson component shell parity, typography token use, and page-level spacing ownership.

## Impact

- Affected shared runtime files:
  - `src/app/globals.css`
  - `src/features/interactive/shared/manifest-runtime/layout-renderer.tsx`
  - `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`
  - `src/features/interactive/shared/manifest-runtime/activity-renderers.tsx`
  - `src/features/interactive/shared/manifest-runtime/module-visual-standards.ts`
  - relevant runtime module gate tests
- Affected lessons:
  - all manifest-first interactive lessons that render through the shared runtime.
  - lesson 1-2 is the required browser acceptance route because it exercises the broadest active module mix.
- No public route, API, database, or evidence schema changes are intended.

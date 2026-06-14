## Why

Interactive lesson data contracts are becoming standardized, but module chrome and state presentation can still vary by course. The accepted UI direction requires a shared visual standard so new courses cannot introduce unregistered local variants that break classroom projection, student clarity, or teacher controls.

## What Changes

- Define shared visual chrome for content, interaction, teacher-control, student-state, and fallback modules.
- Cover text, image, media, formula, table, code, knowledge card, single choice, multiple choice, sorting, pairing, drag/match, task card, parameter input, graph hotspot, short answer, and pre/post assessment surfaces.
- Define role/theme/viewport states for desktop, mobile, projection, light, and dark.
- Require module-level visual QA with source references from `design-handoff.md`, `concepts/revised/03-student-guest-runtime.png`, and `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `interactive-course-standard-module-migration`: require standard visual chrome for registered module kinds.
- `commercial-workspace-surface-system`: define how module chrome fits LessonRuntimeShell.

## Impact

- Affects shared runtime module renderers and course module acceptance gates.
- Does not introduce new module kinds or relax manifest runtime contracts.
- Blocked by `persist-app-shell-navigation-preference` for shell and dock behavior.
- Blocks `standardize-lesson-runtime-shell` because runtime shell acceptance depends on registered module chrome.

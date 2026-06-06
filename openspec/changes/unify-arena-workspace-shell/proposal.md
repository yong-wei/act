## Why

The previous platform UI work established governance and partial shell contracts, but the student-facing pages still expose different navigation models, narrow centered layouts, duplicated controls, and occasional visible commercial vocabulary. Arena already has the closest layout direction, so it should become the first concrete prototype for a unified workspace shell before expanding the pattern to knowledge graph, interactive learning, virtual simulation, and adaptive learning.

## What Changes

- Extract the Arena layout direction into a reusable workspace shell prototype with collapsible left navigation, sticky breadcrumb top bar, personal-center account action, responsive mobile drawer behavior, and full-width task-first content.
- Migrate Arena hall and challenge detail pages to the prototype while preserving Arena route behavior, challenge context, publication context, workbench entry, leaderboard context, and evaluation semantics.
- Remove visible `商业` wording from Arena student-facing UI while retaining the premium platform design intent.
- Introduce a centralized platform visual asset location for Arena visual-world assets, including asset manifest rules, generated raster/SVG placement, light/dark usability, and no scattered page-local asset directories.
- Replace emoji-like or decorative symbolic treatments in Arena shell and cards with a consistent icon-and-visual-asset system.
- Add visual acceptance expectations for desktop, projector-like wide desktop, 320px mobile, light theme, dark theme, collapsed navigation, and mobile drawer states.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: Add a unified collapsible workspace shell prototype and centralized visual-world asset rules for dense learning workspaces.
- `arena-student-entry-experience`: Require Arena hall and challenge detail to adopt the unified shell prototype, remove visible commercial vocabulary, and use centralized Arena visual assets.
- `commercial-ui-governance-gates`: Add governance requirements for centralized visual assets, emoji-free premium symbols, and shell visual evidence.

## Impact

- Affected UI routes: `/arena` and `/arena/challenges/[taskId]`.
- Affected shared UI likely includes the Arena shell and/or a new shared platform workspace shell component.
- Affected assets should be placed under a single platform visual-world directory such as `public/assets/platform/visual-worlds/arena/`, with any reusable metadata or helpers kept near the shared platform UI layer rather than in page-local route directories.
- No database, API, scoring, publication, submission, or evaluation protocol changes are intended.

## Why

Wide screens currently expose large unused margins across knowledge graph, interactive learning, mission workspaces, operations pages, and many legacy/local shells. The platform should treat screen width as usable workspace by default instead of centering most surfaces inside narrow max-width containers.

## What Changes

- Replace route-frame and major workspace defaults that center content in fixed maximum widths with a governed compact edge-spacing model.
- Require AppShell content frames, mission workspaces, knowledge/data map surfaces, operations consoles, report ledgers, and interactive course runtime shells to use fixed narrow viewport edges rather than dynamic wide-screen side gutters.
- Preserve only explicitly justified reading or modal constraints; ordinary text, forms, reports, course modules, dashboards, and tool surfaces must still live inside the compact page edge system rather than drifting to the page center.
- Require a complete page-level wrapper inventory: every `mx-auto max-w-*`, `container mx-auto`, AppShell frame cap, and course runtime page cap must be migrated or classified as an approved component-intrinsic or temporary exception with owner, scope, reason, and removal/permanence condition.
- Add governance and visual evidence requirements so screenshots and DOM metrics together prove stable compact edges at 1024px, 1100px, 1279px, 1440px, 1920px, 2560px, tablet, and 320px.
- Treat unclassified page-local `mx-auto max-w-*`, `container mx-auto`, and course runtime `max-w-[1180px]/max-w-[1280px]` wrappers as blocking migration debt.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: define compact edge spacing as the default AppShell frame behavior across registered route archetypes.
- `commercial-workspace-surface-system`: require dense workspaces and interactive course runtime pages to use the compact edge model instead of narrow centered local shells.
- `commercial-ui-governance-gates`: add visual and source-level governance for stable page edges, wide-screen utilization, and explicit exceptions.

## Impact

- Affected code: `src/components/platform/app-shell.tsx`, route inventory metadata, commercial UI governance checks, interactive course shared shells, course runtime header/main wrappers, teacher/student workspace shells, and representative legacy route wrappers that hard-code `mx-auto max-w-*`.
- Affected tests: platform shell contract tests, commercial UI governance tests, interactive course visual/runtime gates, and screenshot capture scripts for representative routes.
- No database, API, or course-content data model changes are expected.

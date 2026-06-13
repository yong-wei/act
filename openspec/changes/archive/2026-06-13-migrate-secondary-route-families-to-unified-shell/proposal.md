## Why

The platform UI unification has reached representative routes, but first-hop and descendant pages still fall back to page-local shells, fixed-width content, and scattered local tools. This breaks the navigation language immediately after users enter Interactive Learning, knowledge graph, resources, simulations, or operations workflows.

## What Changes

- Migrate secondary route families and first-hop destinations to `AppShell` or an approved workspace shell instead of page-local topbars and standalone dark pages.
- Require route-family inventory coverage for descendant pages, not only representative parent routes.
- Standardize content-width behavior so collapsed navigation expands usable workspace width instead of leaving fixed `max-w` islands on data, graph, and workspace surfaces.
- Upgrade knowledge graph local tools so chapter directory, relation filters, legend, view switch, and resource panel are collapsible or drawer-based tools rather than permanent overlay clutter.
- Replace page-local accent palettes on migrated secondary routes and knowledge panels with platform token roles.
- Keep the existing `enforce-secondary-navigation-visual-governance` change responsible for governance gate behavior; this change supplies migrated routes, route-family metadata, exception metadata, and evidence fixtures consumed by those gates.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: add route-family shell inheritance, content-width, and local-tool collapse requirements for descendant pages.
- `platform-role-navigation`: require first-hop and descendant route inventory coverage, contextual breadcrumbs, and next-action continuity across route families.
- `resource-node-knowledge-workspace-ui`: require collapsible/drawer-based knowledge graph tools and tokenized local panels.

## Impact

- Affects `src/components/platform/app-shell.tsx`, `src/lib/platform-role-navigation.ts`, route-family inventory fixtures, exception metadata, and evidence manifests consumed by `enforce-secondary-navigation-visual-governance`.
- Affects student-facing Interactive Learning descendants, resource pages, knowledge graph panels, simulation descendants, and selected teacher/admin descendant pages.
- Requires visual/DOM evidence for desktop expanded, desktop collapsed, mobile navigation, local-tool open/closed states, and inherited light/dark coverage where the route family already supports both themes.
- Does not implement lesson content changes, resource business logic changes, or a new visual brand system.

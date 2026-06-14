## Why

The shared AppShell currently defaults desktop navigation to expanded and keeps the collapsed state local to a render. That makes dense workspaces such as `/knowledge`, Arena, simulations, and reports lose horizontal workspace area and resets the user's choice when moving across pages.

## What Changes

- Make the desktop AppShell navigation default to collapsed on eligible primary workspace routes.
- Persist the user's explicit expanded/collapsed preference across platform pages until the user changes it.
- Keep the collapsed rail fully navigable through icons, labels, focus order, and active-route state.
- Add governance evidence that proves the preference survives representative route changes without creating mobile rail regressions or hydration layout thrash.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-design-system-and-shell`: define default collapsed navigation and persisted desktop AppShell navigation preference.
- `platform-role-navigation`: require route inventory and navigation metadata to remain valid in the default collapsed state.
- `commercial-ui-governance-gates`: require visual and interaction evidence for cross-page navigation preference persistence.

## Impact

- Affects `src/components/platform/app-shell.tsx`, AppShell tests, route-shell evidence, and commercial UI governance checks.
- Supports the knowledge graph redesign by making the default canvas width predictable.
- Does not change route ordering, role authorization, or page-local tool behavior.

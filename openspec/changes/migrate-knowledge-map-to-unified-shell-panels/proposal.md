## Why

The knowledge graph route currently bypasses AppShell for unauthenticated users and renders a hard-coded 240px blue local sidebar inside the graph workspace. This makes the page look disconnected from the unified platform navigation and makes the graph's chapter directory compete with global navigation.

## What Changes

- Migrate `/knowledge` into the unified knowledge-data-map shell for public, student, teacher, and admin states.
- Reframe the chapter directory, relation filters, graph legend, and node resource panel as local workspace panels or drawers instead of platform navigation.
- Replace local color and fixed-width sidebar styling with platform tokens and responsive workspace panel behavior.
- Preserve graph data loading, node selection, 2D/3D mode, relation filtering, and resource panel behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-student-entry-surfaces`: requires knowledge graph student/public entry to use the route-ledger shell rather than a local page shell.
- `commercial-workspace-surface-system`: defines knowledge map local panels as workspace controls with drawer behavior and platform-token styling.

## Impact

- Affects `/knowledge`, `KnowledgeGraphSystem`, `KnowledgeSidebar`, relation filter panels, resource panel layout, mobile drawers, and visual QA evidence.
- Depends on `fix-app-shell-collapsed-navigation-contract` for shared navigation behavior.

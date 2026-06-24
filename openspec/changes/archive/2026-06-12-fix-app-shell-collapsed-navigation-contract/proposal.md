## Why

The current AppShell collapsible navigation reports a collapsed state but keeps the desktop layout at the expanded 248px width, and collapsed links render duplicated text such as `知识资源知`. This makes Arena and Control Workbench look inconsistent after the recent UI unification and weakens the shell contract for every future workspace migration.

## What Changes

- Fix the shared AppShell desktop collapsed navigation contract so the content column actually expands when navigation is collapsed.
- Render collapsed navigation as an icon-first rail with accessible labels, active route indication, stable focus order, and no duplicated visible text.
- Add local tests and visual acceptance checks that prove expanded, collapsed, and mobile drawer navigation states work on representative mission workspaces.
- Keep this change limited to shared shell behavior; route migrations are handled by follow-up changes in the same series.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: tightens the collapsible workspace shell requirement with measurable layout and icon rail behavior.
- `commercial-ui-governance-gates`: requires navigation-state evidence to validate actual collapsed geometry and visible text behavior, not only data attributes.

## Impact

- Affects `src/components/platform/app-shell.tsx`, shared shell CSS in `src/app/globals.css`, platform shell tests, and visual QA evidence for Arena and Control Workbench.
- Provides a prerequisite for student secondary route and knowledge-map migrations.

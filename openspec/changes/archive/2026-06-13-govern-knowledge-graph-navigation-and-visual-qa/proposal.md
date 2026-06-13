## Why

The knowledge graph redesign needs a governance change that prevents visual grammar, runtime relation coverage, tool state, and readability from regressing after implementation. Existing shell and route-family migration remains owned by `migrate-secondary-route-families-to-unified-shell`; this change verifies knowledge graph outcomes instead of re-owning broad platform migration.

## What Changes

- Require `/knowledge` to expose chapter directory and relation filters as collapsed local tool menus by default, with open states available on demand.
- Extend governance checks so knowledge graph visual grammar, runtime relation coverage, local tool collapse, active state preservation, and readability evidence are verifiable.
- Depend on `redesign-knowledge-graph-visual-language` and `stabilize-knowledge-graph-layout-clarity`.
- Treat AppShell default collapse, Interactive Learning descendant breadcrumbs, and simulation route-family shell coverage as owned by `migrate-secondary-route-families-to-unified-shell` or a later dedicated route-family change, not by this knowledge graph governance change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: align graph local tool placement with default collapsed chapter/filter menus.
- `commercial-ui-governance-gates`: add visual QA and DOM gates for knowledge graph runtime relation coverage, visual grammar, compact local tools, preserved interaction state, and readability evidence.

## Impact

- Affects knowledge graph local tools, governance tests, and commercial UI evidence manifests.
- Requires browser evidence for `/knowledge` tool states, relation samples, runtime relation coverage, and clarity states.
- Does not implement the graph visual grammar itself; it verifies and governs the outcomes of the related graph changes.

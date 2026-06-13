## Context

The current active change `migrate-secondary-route-families-to-unified-shell` already owns broad route-family gaps. This change narrows scope to knowledge graph governance: default compact local tools, relation coverage, state preservation, and visual/readability QA.

This change is the governance and navigation companion to the two knowledge graph readability changes.

It does not own AppShell default collapse, Interactive Learning descendant shell migration, or simulation route-family shell migration. Those remain in `migrate-secondary-route-families-to-unified-shell` or a later dedicated route-family change.

## Goals / Non-Goals

**Goals:**

- Make `/knowledge` canvas-first by default with chapter directory and filters collapsed into two primary local tool menus.
- Ensure governance tests fail when graph visual language, runtime relation coverage, local tool collapse, state preservation, or readability evidence regress.

**Non-Goals:**

- Redesign graph edge and node rendering; that is owned by `redesign-knowledge-graph-visual-language`.
- Rework graph layout physics; that is owned by `stabilize-knowledge-graph-layout-clarity`.
- Change AppShell default collapse, Interactive Learning descendant breadcrumbs, simulation route-family shells, or teacher/admin route-family migration.

## Decisions

### 1. Knowledge graph local tools default to compact menus

The chapter directory, filters, legend, view switch, and resource panel should be collapsed or compact by default. Open states remain available, but the graph canvas should not lose large areas before the learner asks for tools or selects a node.

Alternative considered: keep permanent desktop panels. That preserves the current failure mode.

### 2. Runtime relation coverage is a governance gate

Governance should read `course-content/runtime/knowledge/graph/relations.jsonl` and fail when any relation type lacks visual-semantic coverage. This prevents the UI from silently turning specialized teaching relations into weak generic associations.

Alternative considered: test only manually curated relation samples. That would miss authored runtime relation types.

## Risks / Trade-offs

- Reusing shell migration output can hide missing default-state evidence. Mitigation: governance must verify the `/knowledge` evidence directly rather than assuming migration completion implies acceptance.
- Runtime relation coverage can drift as course content changes. Mitigation: the governance gate must read runtime relation types at test time instead of relying on a static list.
- Tool state preservation can be missed by screenshot-only checks. Mitigation: pair visual evidence with DOM or interaction checks for selected node, filters, density, legend state, and summaries.

## Migration Plan

1. Move or verify knowledge graph local tools in default compact menu states.
2. Add runtime relation coverage checks.
3. Add evidence checks for local tool open/closed states, state preservation, graph visual QA, and graph clarity states.

## Open Questions

- Whether knowledge graph local tools should share one drawer implementation or separate compact menus for chapter, filters, legend, view, and resource inspection.

## Context

Browser review showed the knowledge graph can display roughly thousands of edges at once, while many relation types are visually similar and relation strength is not meaningfully differentiated. Existing visual config has relation styles, but the default experience still reads as an undifferentiated line field.

## Goals / Non-Goals

**Goals:**

- Make relation types visually distinguishable through color role, line style, width, arrow, opacity, and legend.
- Lower default edge density and reveal weak relations progressively.
- Highlight selected-node neighborhoods and reduce unrelated edge noise.
- Preserve graph exploration and ResourceNode-aware panel behavior.

**Non-Goals:**

- Rebuilding the graph data model.
- Changing knowledge-node identity or ResourceNode mapping rules.
- Removing advanced relation filters for expert users.

## Decisions

### Decision 1: Default graph view shows structure, not every edge

The first graph view should emphasize chapter/module structure, prerequisites, follows/leads-to, and selected neighborhood. Weak `related` edges should be collapsed, dimmed, or filtered by default.

### Decision 2: Relation style encodes meaning

Prerequisite/foundation, contains, follows/leads-to, applies-to, opposite, and related relations should use distinct visual encodings that work in both themes.

### Decision 3: Focus behavior is required

Hovering or selecting a node should dim unrelated edges and strengthen the relevant neighborhood. Labels should appear only when useful.

## Validation

- `rtk openspec validate clarify-knowledge-graph-relationship-visuals --strict`
- Visual QA for `/knowledge` in light and dark themes with default, filtered, hover, and selected-node states.
- Tests or scripts for relation style mapping, default density, and strength calculation.

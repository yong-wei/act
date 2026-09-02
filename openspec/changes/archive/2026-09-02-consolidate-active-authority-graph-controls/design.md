## Context

Active graph controls currently occupy the shared top toolbar as a search field, single-select type dropdown, fixed Teaching badge and four engineering-family buttons. The Legacy path already has a compact multi-select relation control with visual samples. The active runtime also turns its semantic accessibility list into a visible bottom grid whenever edges are empty or Teaching is unavailable; because default shards contain no engineering edges and current Teaching is unavailable, the fallback becomes a permanent visual directory.

## Goals / Non-Goals

**Goals:**

- Provide one dedicated responsive filter panel with multi-select node and relation controls.
- Keep global navigation/layout controls separate from semantic filters.
- Preserve force, camera, selection, loaded shards and inspector state across filtering.
- Remove the visible all-node directory while retaining semantic accessibility.
- Switch the complete panel through the qualified locale contract.

**Non-Goals:**

- Removing search or screen-reader access to nodes.
- Loading every secondary object merely to populate the panel.
- Changing relation truth, Teaching availability or node hierarchy.
- Rebuilding the shared design system outside the knowledge workspace.

## Decisions

### 1. One filter panel owns node types and relation families

The active panel uses reversible checkbox semantics, registered node glyph samples and relation line/direction samples. It shows only registered types/families available to the current bounded logical graph, while keeping controls for loaded-but-hidden families. The panel has desktop anchored and mobile drawer presentations over one state owner.

Alternative rejected: keep type as a single-select dropdown. It cannot express independent reversible visibility and conflicts with existing specs.

### 2. The shared toolbar keeps only global actions

Version, language, 2D/3D, fit, reflow and domain return remain in the workspace toolbar. Search may open a bounded discovery surface, but relation/type controls and their failure states live in the filter panel.

### 3. Semantic directory is accessibility-only by default

All canvas nodes remain represented by focusable/announced semantic controls, but the directory stays visually hidden. An explicit accessible recovery action may expose bounded search or focus controls; Teaching unavailability or zero visible edges never expands a full node grid into the layout.

### 4. Filter state is identity- and mode-namespaced

Active/Legacy and 2D/3D ownership follows the existing session boundaries. Active node/relation filters survive dimension and locale changes; they do not cross-map into Legacy. Enabling an unloaded family fetches exactly that shard and preserves state on failure.

## Risks / Trade-offs

- [Panel obscures a small viewport] → Use one controlled drawer/sheet with focus trap and restore, not multiple floating rows.
- [Many future types make the panel long] → Group by node versus relation and use scroll within a bounded panel.
- [Removing visible directory harms keyboard users] → Preserve semantic controls, search and explicit focus recovery, and test with keyboard/screen-reader scenarios.
- [Locale refresh changes panel width] → Use responsive bounds and test long English labels without truncating meaning.

## Migration Plan

1. Add failing tests for single-select type filtering, toolbar sprawl and visible node-directory fallback.
2. Introduce active filter-panel state/model and visual samples by reusing shared relation presentation configuration.
3. Move active controls from the toolbar and keep fetch failures inside the panel.
4. Convert the directory to screen-reader-only semantics and add bounded empty-state recovery.
5. Run bilingual desktop/mobile visual, keyboard and state-preservation tests.

## Open Questions

None.

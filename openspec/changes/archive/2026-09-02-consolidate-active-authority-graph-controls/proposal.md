## Why

The active graph currently mixes search, a single-select type dropdown, Teaching status and engineering-family buttons in the top toolbar, while a visible all-node directory is forced into the bottom of the workspace whenever Teaching is unavailable. This differs from the established legacy filter experience, competes with the canvas, and obscures the three-level navigation model.

## What Changes

- Move node-type and relation-family controls into one dedicated responsive filter panel modeled on the legacy multi-select relation control, with visible line/shape samples and complete bilingual labels.
- Preserve independent reversible state for DomainConcept, Formula, KnowledgeStatement, SystemModel, ModelRepresentation, Teaching relations and every engineering family without resetting force coordinates, camera, selection, loaded shards or inspector state.
- Keep the global workspace toolbar limited to version, language, dimension, fit, reflow and domain return actions; search remains a bounded discovery action rather than a permanent node directory.
- Remove the visible bottom all-node list in ordinary graph states, including Teaching-unavailable and edge-empty domains; retain a screen-reader-only semantic directory and explicit accessible empty-state controls.
- Add desktop/mobile, keyboard, screen-reader, high-density, long-label and mixed filter tests that reject single-select type filtering, horizontal control sprawl, visible full-node directories and mode-state leakage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `layered-authority-domain-workspace`: Establish dedicated filter-panel ownership and remove the visual all-node directory from the canvas layout.
- `active-authority-legacy-force-runtime`: Require legacy-equivalent reversible multi-select controls without changing force or camera state.
- `active-authority-semantic-graph-presentation`: Separate discovery, filtering, semantic accessibility and visible graph hierarchy.
- `authority-locale-readiness-and-switching`: Require the complete filter panel and its accessible states to switch languages atomically.

## Impact

- Affects active graph toolbar/chrome, filter state, relation-family loading controls, node-type presentation, accessibility directory, responsive layout and UI governance tests.
- Depends on `restore-active-authority-force-runtime-parity` and `activate-v037-bilingual-authority-graph`.
- Does not remove semantic accessibility, alter Authority truth, infer relations or expose a full graph through another visual surface.

## Context

The root knowledge map currently reuses ordinary node geometry and external-label placement. Root nodes are packed into a measured grid, while the global label policy can defer labels after projection and collision checks. The selected-node inspector is independent from selection in reducer state, but both renderers report manipulation start to the workspace, which dispatches `close-inspector`. The inspector's relation, path, and learning-action sections are permanently open and the first nested relation group opens by default.

The existing workspace contract requires deterministic collision-safe root layout, stable user-positioned domain coordinates, 2D/3D equivalence, platform semantic color roles, mobile canvas priority, and explicit blank-space dismissal. The implementation must preserve those guarantees and the canonical relation/path contracts.

## Goals / Non-Goals

**Goals:**

- Make every top-level domain immediately readable as a substantial, dimensional bubble with its complete name inside.
- Produce a compact irregular cluster that is visually organic but deterministic for the same graph and viewport.
- Keep inspector state stable through every viewport or node manipulation gesture.
- Reduce inspector density through an accessible single-open relation/path accordion.
- Preserve renderer parity, mobile usability, deterministic tests, and existing navigation and graph semantics.

**Non-Goals:**

- Changing canonical nodes, links, relation families, canonical corridors, graph export, or path planning.
- Changing domain-entry navigation, ordinary knowledge-node labels, or user-position persistence.
- Introducing new dependencies, backend APIs, database fields, or a page-local color system.

## Decisions

### 1. Pack roots with deterministic collision-aware candidate sampling

Root nodes remain sorted by reviewed chapter order and stable ID. A stable 32-bit seed derived from graph version, sorted root IDs, and viewport dimensions drives candidate angle, radius, and bounded axis jitter. Candidates are sampled inside a centered viewport-shaped ellipse and accepted only when their bubble collision circles satisfy the minimum gap; the search radius expands only when no compact candidate fits. The accepted cluster is recentered and frozen through `x/y/z` and `fx/fy/fz`.

This yields deliberate irregularity without refresh-to-refresh movement. True random placement was rejected because it breaks orientation and visual regression tests. A jittered grid was rejected because its rows remain perceptible, and a ring was rejected because it wastes the canvas center and separates related domain choices.

### 2. Give root nodes a dedicated bubble and internal-label contract

Root presentation derives a bubble radius from measured, wrapped full text plus padding, bounded readable font size, and at most three lines. Root labels use an `inside` placement mode, remain requested at every zoom, and bypass the ordinary external-label collision-defer step because the bubble itself reserves their complete bounds. Ordinary nodes retain the existing external label policy.

The 2D renderer draws a radial surface, consistent upper-left highlight, rim, and tinted shadow from platform tokens. The 3D renderer uses a sphere with bounded shininess/emissive depth and existing glow layers. Both renderers center the same wrapped label over the bubble with pointer events disabled and preserve selected/hover emphasis without changing radius or layout. A separate root mode was chosen over globally enlarging ordinary nodes because domain selection and dense domain exploration have different readability constraints.

### 3. Remove inspector dismissal from manipulation plumbing

Renderer-local gesture tracking continues to distinguish blank click from drag, freeze unrelated coordinates, update the dragged node, and report camera activity where required. The workspace no longer maps a generic manipulation-start callback to `close-inspector`; the dismissal callback is removed from the 2D/3D renderer props where it has no other semantic purpose.

Canvas pan, node drag, orbit, wheel, and pinch therefore preserve selected node, inspector-open state, focused corridor, disclosure state, scroll position, cached shards, viewport, and established coordinates. A completed non-moved blank gesture still dispatches `dismiss-selection`; the inspector close button dispatches `close-inspector`; domain navigation clears an out-of-domain selection as before.

### 4. Use one explicit top-level disclosure state

The inspector owns `activeRelationPathSection: null | 'relations' | 'canonical-corridor' | 'adjacent-domains' | 'learning-actions'`. It starts as `null`, selecting another node resets it to `null`, and selecting an already open section closes it. Opening one section replaces the active key, giving single-open accordion behavior. Async detail refresh and graph manipulation do not change the key or scroll position.

Each header is a button with count/status summary, `aria-expanded`, `aria-controls`, a stable region ID, visible focus treatment, and a rotating chevron. Nested relation groups start collapsed whenever a node changes; opening the outer relations section does not silently expand the first group. Knowledge Card and evidence sections retain their existing presentation.

## Risks / Trade-offs

- [Long labels could force oversized bubbles] → Wrap complete text to at most three lines, reduce only to the existing readable minimum, include final text bounds in bubble radius, and validate current plus synthetic long labels.
- [Irregular packing could become sparse on narrow screens] → Shape candidates by viewport aspect, recenter accepted nodes, retain bounded fit insets, and test both portrait and landscape extents.
- [Internal labels could lose contrast over dimensional shading] → Use platform foreground/inverse roles with a subtle text backing/shadow selected from measured luminance, and verify light/dark screenshots.
- [Removing a shared manipulation callback could weaken blank-click detection] → Keep the existing completed-blank-gesture threshold and add separate pan, node-drag, wheel, and pinch regressions before changing source expectations.
- [Accordion state could reset during async resource updates] → Key reset only on selected node ID, not on object identity or fetched content revision.

## Migration Plan

No data migration is required. Ship the spec, internal contracts, renderers, inspector state, and tests together. Rollback consists of reverting this change; no persisted data needs conversion.

## Open Questions

None. The user selected single-open accordion behavior and stable pseudo-random placement.

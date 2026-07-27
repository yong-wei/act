## Why

Two presentation gaps remain after the root-bubble refinement: the root bubble cluster still reads as flat, static spheres (gradient + rim but no life), and the graph's only motion is a three-marker corridor effect that activates solely on selection, so the map feels inert — edges carry direction semantics that learners can only decode from tiny static arrowheads. The codebase already owns a complete motion infrastructure (frame loop, path-tangent marker placement, travel/pause cycles, reduced-motion gating); it is simply scoped too narrowly. Extending it to an ambient "traffic network" flow layer and a paint-level bubble vitality layer makes the map feel alive without touching the frozen layout contracts.

## What Changes

- Generalize corridor-only motion markers into a scoped ambient flow layer: directional markers travel along the visible post-requisite structural-foreground edges (and optionally child edges) with staggered phases and per-family tint, giving the domain view a dynamic traffic-network feel; the selected corridor keeps its prominent marker treatment on top.
- Bound the flow layer with a deterministic concurrent-marker budget, shared-segment deduplication, reduced-motion opt-out, and automatic pause when the tab is hidden or the canvas is offscreen; update the performance test expectations that currently pin the corridor-only three-marker cap.
- Add paint-level root-bubble vitality: layered inner highlight and rim-light arc, a soft outer halo, a slow breathing glow on the active bubble, and a bounded entrance stagger when the root view mounts — all strictly paint-level so node geometry, hit areas, deterministic packing, and the always-visible internal label contract are untouched.
- No layout, packing, navigation, interaction, density, or data changes; no renderer decomposition.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Widen the motion requirement from corridor-only continuous markers to a budgeted ambient flow layer, and add root-bubble vitality presentation requirements with frozen-geometry and reduced-motion constraints.

## Impact

- Affects `src/features/knowledge/graph/motion.ts` (flow eligibility, budget, phasing), `knowledge-graph-2d.tsx` and `knowledge-graph-canvas.tsx` / `three-link-presentation.ts` (flow and bubble paint), `visual-config.ts` (bubble vitality tokens), and `tests/knowledge-graph-performance.spec.ts` (marker budget expectations).
- Independent of `extend-knowledge-graph-projection-contract`; coordinates with `encode-knowledge-graph-evidence-visuals` so evidence-muted edges render subdued flow markers (whichever lands second rebases the interplay).
- Respects all pinned contracts: deterministic root packing, always-visible bubble labels, frozen layouts with no reheat, inspector persistence, density caps, reduced-motion equivalence.

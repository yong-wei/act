## Context

Both shared renderers configure D3 forces, but deterministic layout output is immediately copied into automatic `fx`/`fy` anchors; 3D additionally fixes `fz`. The renderer then uses zero cooldown ticks, and 3D also uses zero warmup ticks. Consequently force values cannot change ordinary node positions. Existing tests assert these values and therefore certify the implementation mechanism rather than force behavior.

## Goals / Non-Goals

**Goals:**

- Restore real force motion and bounded settlement in 2D and 3D.
- Keep deterministic root packing, explicit user pins and dimension-specific state.
- Reheat only the affected bounded scope when shards arrive.
- Make overview concept labels readable by default under the settled layout.
- Replace source assertions with behavioral and performance evidence.

**Non-Goals:**

- Returning to the removed active SVG renderer.
- Allowing an unbounded continuously hot simulation.
- Moving line-free root navigation through D3 force.
- Solving data-level hierarchy, formulas, locales or control-panel structure.

## Decisions

### 1. Initial seeds are not fixed coordinates

Deterministic overview and one-hop layouts provide initial `x/y/z` seeds. They do not receive `fx/fy/fz`. Only root packing and explicit user pins set fixed coordinates. The runtime records live settled positions separately from pins.

Alternative rejected: remove all deterministic seeding. Random starts make screenshots, camera fit and repeated sessions unstable.

### 2. Reflow is a bounded simulation lifecycle

Every dimension has explicit warmup, reheat alpha, tick/time ceiling, settle signal and reduced-motion policy. New bounded nodes reheat their affected connected component; filter-only changes do not restart physics. Manual reflow clears only automatic settled coordinates, never user pins.

Alternative rejected: set a large permanent cooldown. It wastes CPU and introduces layout drift after the graph has settled.

### 3. Label acceptance is behavioral

DomainConcept labels are priority labels in the overview. The collision solver may defer overlapping labels only after attempting force separation and camera fit. Selected, hovered and focused labels remain visible, but the ordinary state must retain a measured minimum visible-label ratio.

### 4. Shared runtime remains source-neutral

Legacy and active adapters continue to own separate data and sessions. Force lifecycle, geometry, label collision and camera hooks stay in the shared runtime; no active-only renderer is introduced.

## Risks / Trade-offs

- [Force motion makes exact coordinates nondeterministic] → Assert bounded displacement, separation, stable seeds and final metrics rather than pixel-identical coordinates.
- [Reheat causes visible jumps] → Reheat only the affected connected component and preserve settled coordinates as soft initial conditions.
- [Many labels reduce frame rate] → Use cached DOM content and bounded coordinate updates; performance gates measure frame and KaTeX counts.
- [Drag conflicts with automatic movement] → Convert only drag-end positions into explicit pins and provide an unpin action that returns the node to force ownership.

## Migration Plan

1. Add failing behavioral tests proving ordinary nodes are currently fixed and reflow does not change the layout.
2. Split automatic seed, settled coordinate and user-pin state.
3. Implement bounded 2D/3D force lifecycle and component-scoped reheat.
4. Rework label fit/collision tests around visible ratios and interaction states.
5. Run real browser interaction and performance checks on the bounded three-level data contract.

## Open Questions

None. Tick, alpha and frame thresholds become explicit evidence-backed constants before implementation completion.

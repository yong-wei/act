## Why

The `/knowledge` root view currently renders small grid-aligned nodes whose external labels can be deferred by zoom and collision rules, so learners cannot reliably read every domain without hovering. The stable inspector also follows an obsolete contract that closes on any canvas or node manipulation, while its dense relation and corridor sections open by default and interrupt comparison-oriented exploration.

## What Changes

- Replace the root grid with a deterministic, collision-safe irregular bubble cluster whose positions remain stable for the same graph and viewport.
- Render every root-domain name as a full, always-visible multiline label inside its bubble in both 2D and 3D views.
- Give root bubbles platform-token-based depth through bounded highlights, shading, rim treatment, and glow without changing domain navigation or graph relations.
- Preserve the selected-node inspector, focused corridor, active disclosure, scroll position, viewport, and stored coordinates during canvas pan, node drag, orbit, wheel, and pinch gestures.
- Keep explicit blank-canvas activation, the close control, and navigation away from the selected node as the inspector dismissal paths.
- Convert `关联知识点`, `当前规范路径`, `相邻领域路径`, and `学习路径动作` into an accessible single-open accordion that starts fully collapsed and resets only when the selected node changes.
- Replace the existing OpenSpec scenarios and tests that require manipulation-start dismissal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Refine compact root presentation, root-label visibility, manipulation-safe inspector state, and inspector disclosure behavior.

## Impact

- Affects the `/knowledge` root packing and node presentation contracts, the 2D and 3D graph renderers, graph interaction state, and the ResourceNode inspector.
- Updates focused Vitest/client tests, browser visual evidence, and the knowledge workspace OpenSpec contract.
- Does not modify canonical knowledge data, relation projection, path planning, persistence schemas, backend APIs, or external dependencies.

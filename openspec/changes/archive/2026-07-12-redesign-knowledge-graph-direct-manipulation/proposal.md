## Why

The `/knowledge` graph currently turns local expansion into a two-step action and places expansion children on complete rings, producing cross-shaped clusters that obscure parent-child direction and disturb the learner's spatial memory. The interaction should behave like direct manipulation: clicking an expandable node reveals its neighborhood, clicking a leaf opens details, and dragging affects only the object being dragged.

## What Changes

- **BREAKING** Replace the selected-node expansion button workflow with node-click semantics: expandable nodes expand or collapse directly, while non-expandable leaf nodes open the detail inspector.
- Add explicit expandability metadata to progressive graph payloads so the client can distinguish expandable, leaf, and temporarily unknown nodes before deciding the click outcome.
- Replace full-circle focused expansion rings with deterministic outward sector or fan placement that preserves the parent direction, avoids occupied space, and never moves unrelated existing nodes.
- Freeze the automatic layout after its initial pass; dragging a node updates only that node's stored coordinates and does not reheat or redistribute the graph.
- Close the node inspector when the user clicks blank canvas space or starts dragging the canvas or a node.
- Add restrained graph motion inspired by the Chaoxing reference: focused-node emphasis, staged node reveal, edge growth, local viewport reveal, and reduced-motion fallbacks without copying Chaoxing's visual skin.
- Reorder the inspector so Knowledge Card content appears before Related Knowledge Points, while preserving the remaining learning-path actions and evidence context.
- Extend automated and visual governance to cover direct-click branching, sector expansion, animation, inspector dismissal/order, stable node coordinates, 2D/3D parity, theme parity, narrow viewports, keyboard behavior, and reduced motion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Replace node-local expansion controls and centered full-ring placement with direct-click node semantics, explicit expandability, outward sector expansion, stable direct manipulation, governed motion, inspector dismissal, and revised inspector information order.
- `commercial-ui-governance-gates`: Require interaction, coordinate, motion, accessibility, and visual evidence for the revised knowledge-graph behavior.

## Impact

- Affects `/knowledge` progressive graph payloads, interaction state, selected-node inspector state, 2D/3D renderers, focused layout helpers, coordinate persistence, and visual capture tests.
- Expected code areas include `src/app/api/knowledge/graph`, `src/lib/knowledge-graph-source.ts`, `src/features/knowledge/knowledge-graph-system.tsx`, `src/features/knowledge/graph/`, and focused unit/Playwright tests.
- Removes the node-following expansion button and its positioning/focus machinery introduced by the previous expansion change.
- Does not change knowledge semantics, relation taxonomy, ResourceNode binding, learning-path logic, Konling behavior, or course content.

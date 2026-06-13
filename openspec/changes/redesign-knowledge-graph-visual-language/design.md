## Context

The knowledge graph currently has some relation styling in `src/features/knowledge/graph/visual-config.ts`, but the rendered result still reads as a dense tangle. Desktop controls occupy too much space, but this change handles only graph expression: how nodes, edges, labels, filters, and legends communicate meaning once the graph is visible.

Frontend design direction: treat the graph as a refined teaching instrument. The visual system should be precise, restrained, and semantic. It should avoid decorative thickness and avoid relying on color alone.

## Goals / Non-Goals

**Goals:**

- Make relation meaning visible through actual line glyphs, not only text descriptions.
- Make graph edges fine by default and use focus states for emphasis.
- Make node scale reflect graph importance such as degree, instructional importance, or selected context.
- Make filter and legend labels readable in Chinese teaching language.
- Keep light and dark themes visually equivalent.

**Non-Goals:**

- Rebuild the graph layout algorithm or force simulation physics changes. That is handled by `stabilize-knowledge-graph-layout-clarity`.
- Move chapter directory, filters, or legend into shell drawers. That is handled by shell/navigation changes.
- Change course-content knowledge graph data schema.

## Decisions

### 1. Use a relation grammar instead of ad hoc styles

Each relation family should map to a stable visual grammar:

- prerequisite/foundation: fine solid directional edge with restrained arrow.
- contains: fine structural edge with no arrow and stronger endpoint grouping.
- follows/leads-to: fine long-dash directional edge.
- applies-to: fine short-dash directional edge.
- opposite: fine alternating mark or diverging endpoint treatment without arrow.
- related: faint dotted or low-opacity edge, hidden or de-emphasized in default dense views.

Alternative considered: keep color-only mapping. That fails accessibility and does not help when many edges overlap.

### 2. Make the legend graphical

The legend should render miniature edge samples using the same style data consumed by the graph renderer. Text can name the relation, but the meaning must be shown visually.

Alternative considered: keep text phrases such as "long dashed arrow". That forces the learner to translate words back into visual form and does not validate renderer consistency.

### 3. Cover every runtime relation type before rendering

Every `relation_type` present in `course-content/runtime/knowledge/graph/relations.jsonl` must map to a teaching label, visual family, direction semantics, density policy, and legend explanation. Unknown runtime relation types must fail validation or be reported as blocking coverage gaps instead of silently falling back to `related`.

Alternative considered: design only the six currently prominent relation families. That would lose teaching semantics for cross-domain, generalization, instance, support, enablement, and other authored relations.

### 4. Define the node scale contract, leave metric computation to layout clarity

This change defines how node scale should be visually expressed: the radius range, token usage, emphasis hierarchy, and bounds. The actual degree, importance, and focus metrics are computed and verified by `stabilize-knowledge-graph-layout-clarity`.

Alternative considered: fixed node size. That hides conceptual hubs and makes the graph look arbitrary.

### 5. Localize visible filters

Visible labels should use Chinese domain language such as "知识类别" and "认知层级", while raw keys remain internal implementation details.

Alternative considered: keep schema names. That exposes implementation vocabulary and weakens the commercial product feel.

## Risks / Trade-offs

- Fine edges can become invisible on low-contrast backgrounds. Mitigation: define theme-aware token roles and minimum opacity per relation family.
- Node scaling can overemphasize high-degree but low-value nodes. Mitigation: use a capped composite score and preserve focus-state override.
- Graphical legends can drift from renderer styles. Mitigation: generate legend samples from shared relation style config.

## Migration Plan

1. Extract relation visual grammar and localized labels into shared graph presentation config.
2. Update 2D and 3D graph renderers to consume the same semantic style contract where technically possible.
3. Replace text-only legends with graphical samples.
4. Add DOM and visual evidence for relation samples, localized labels, and theme parity.

## Open Questions

- Whether 3D relation styles should exactly match 2D styles or use equivalent particle/arrow encodings when dashed lines are not available.

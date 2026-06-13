## Context

The current graph renders many nodes and edges at once. The result is visually dense enough that learners cannot infer prerequisite, containment, follow-up, application, opposition, or weak-related structures. A readable graph requires algorithmic defaults, not just improved colors.

This change assumes `redesign-knowledge-graph-visual-language` will define the node and relation visual grammar.

## Goals / Non-Goals

**Goals:**

- Make the default graph view readable at ordinary desktop sizes.
- Reveal conceptual hubs through node size and structure without turning the graph into a decorative poster.
- Reduce edge noise by default and expose weak relations through explicit user choice.
- Make selection and hover focus show actual logical neighborhoods.
- Add measurable acceptance checks for layout clarity.

**Non-Goals:**

- Replace the entire graph library unless current libraries cannot satisfy the requirements.
- Redesign local tool placement or AppShell navigation.
- Change canonical knowledge graph content.

## Decisions

### 1. Default to high-signal structure

The default graph should show skeleton, hierarchy, prerequisite/foundation, contains, follows/leads-to, and selected-context relations before weak related edges.

Alternative considered: render all edges and rely on filters. That produces the current tangle and asks learners to fix the page before learning.

### 2. Compute node importance as a bounded composite score

Node size should derive from explicit importance when available, degree centrality, and current focus relevance. A capped score prevents hub nodes from overwhelming the canvas.

Alternative considered: only use degree. Degree can privilege noisy or broad metadata nodes over pedagogically important concepts.

### 3. Treat focus as a graph state, not a style override

When a node is selected, the visible edge set and opacity should emphasize first-order and useful second-order neighborhoods while reducing unrelated edges.

Alternative considered: only bold selected edges. In dense graphs, bolding a few edges still leaves the background unreadable.

### 4. Verify clarity with deterministic metrics

The implementation should expose testable metrics such as default visible edge count, relation family distribution, node radius bounds, label visibility count, and selected-neighborhood edge ratio.

Alternative considered: accept screenshots only. Screenshots are useful, but deterministic metrics prevent regression when data changes.

## Risks / Trade-offs

- Hiding weak edges can make the graph feel incomplete. Mitigation: show active density mode and provide explicit "全部关系" access.
- Layout metrics may be brittle across viewport sizes. Mitigation: test representative breakpoints and assert ranges rather than exact positions.
- Degree computation can be expensive for large graphs. Mitigation: compute memoized graph statistics from filtered nodes and links.

## Migration Plan

1. Add graph statistics helpers for degree, importance score, and relation family grouping.
2. Update default density filtering to prioritize high-signal structure.
3. Update selected-neighborhood behavior to reduce unrelated nodes and edges.
4. Add clarity metrics and browser evidence for default, all-relations, and selected-node states.

## Open Questions

- Whether chapter cluster nodes should be generated before or after importance scoring.
- Whether the default view should cap visible weak edges globally or per selected neighborhood.

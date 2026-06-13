## 1. Graph Statistics

- [x] 1.1 Add pure helpers for node degree, relation family grouping, and bounded importance score.
- [x] 1.2 Integrate graph statistics into node radius and label priority decisions using the visual scale contract from `redesign-knowledge-graph-visual-language`.
- [x] 1.3 Memoize graph statistics from the current filtered graph to avoid unnecessary render churn.

## 2. Density Defaults

- [x] 2.1 Update default density filtering to show high-signal relation families before weak related edges.
- [x] 2.2 Ensure dense "全部关系" mode is explicit, reversible, and preserves selected node context.
- [x] 2.3 Keep active density and filter summaries visible for learners.

## 3. Focus Behavior

- [x] 3.1 Update selected-node focus to emphasize first-order and useful second-order neighborhoods.
- [x] 3.2 Reduce unrelated edge and node opacity or visibility in focus states.
- [x] 3.3 Preserve graph orientation while avoiding the current all-edge tangle.

## 4. Clarity Verification

- [x] 4.1 Add deterministic checks for node radius bounds, visible edge density, and selected-neighborhood ratio.
- [x] 4.2 Define representative graph fixtures or captured graph states for default high-signal view, selected-node focused view, and all-relations dense view.
- [x] 4.3 Capture browser evidence for default, focused, and all-relations states, recording which clarity metrics each state validates.
- [x] 4.4 Run `rtk openspec validate stabilize-knowledge-graph-layout-clarity --strict`.

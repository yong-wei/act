# Design: Knowledge Graph Evidence & Concept Visual Encoding

## Context

Change `extend-knowledge-graph-projection-contract` (dependency, must land first) adds `evidenceState` to public links and `semanticName`/`conceptKind`/`candidate`/`sourceCoverageCount` to public nodes. Today's canvas already has: family-level edge grammar (child dashed gray-blue / post-requisite solid deep-blue / association dotted amber without arrow), density caps (post structural foreground 32, association one-hop 24), frozen deterministic layouts, and a graphical family legend. The inspector already shows evidence state via provenance; the canvas does not.

Hard constraints pinned by existing specs and tests: 2D/3D parity of visible subsets and emphasis; contrast ≥ 3:1 for edge styles; no layout reheat from hover or style changes; label visibility thresholds (≥ 12 px when shown); performance budgets (p95 rAF < 24 ms, initial visible lines ≤ 32); root bubble and inspector-persistence contracts from `refine-knowledge-graph-root-bubbles-and-inspector-persistence` are out of scope.

## Goals / Non-Goals

**Goals**
- Evidence-state modulation on canvas edges, in the legend, and in the inspector — one vocabulary everywhere.
- A six-category concept taxonomy ready for ActKG `concept_kind` but useful on current data.
- Coverage as a bounded tertiary node-size signal; candidate-node governance visibility.

**Non-Goals**
- No layout algorithm, navigation, drill-down, interaction, or density-cap changes.
- No root-bubble or inspector accordion/persistence changes.
- No ActKG adapter changes (contract change owns those); this change only consumes the fields.
- No canvas/system component decomposition.

## Decisions

### D1: Evidence as intra-family modulation, not a new grammar dimension

Unavailable-evidence edges keep their family's pattern/arrow/curvature and only lose opacity and width (bounded deltas, e.g. opacity × 0.45, width × 0.7, tuned against the contrast floor). This preserves the spec rule that emphasis comes from selection/corridor/family — not from permanently heavy strokes — and avoids a combinatorial explosion of grammars (3 families × evidence × themes).

*Alternative considered:* a dedicated color or dash for unavailable evidence. Rejected — it would break "not by color alone", collide with family dashes, and visually scream in dense domains where unavailable edges may be common.

### D2: Absent evidence state is not "unavailable"

Current sources omit the field when no evidence information exists; only an explicit `'unavailable'` triggers modulation. This keeps today's rendering byte-identical for graphs without evidence metadata and prevents a scary-looking graph on day one.

### D3: Six macro-categories with a two-source classifier

`resolveConceptMacroCategory(node)`: `conceptKind` → grouping table (15 ActKG kinds → 6 categories); else legacy `nodeType`/`knowledgeDim` mapping; else neutral. The grouping table lives in `visual-config.ts` beside `NODE_TYPE_CONFIGS` so 2D/3D share one source of truth. Presentation uses shape/token-role cues plus color, consistent with the existing semantic-map contract.

*Alternative considered:* render 15 concept kinds directly. Rejected — 15 distinguishable presentations exceed a learnable visual budget; six categories match how teachers talk about the domain.

### D4: Coverage joins the existing bounded scale pipeline as tertiary

`sourceCoverageCount` normalizes into the same capped range mechanism that degree centrality uses today, ordered after teaching importance and degree. Absence is neutral (never a penalty), satisfying the contract change's absence-means-unknown rule.

### D5: Candidates filtered at the view-model layer, not the renderer

The graph view-model (system reducer pipeline) removes `candidate: true` nodes and incident edges for learner roles before layout, so frozen-layout, label-collision, and density logic never see them. Teacher/review contexts keep them with a dashed outline + badge. This matches the data-governance instinct (learners never see unreviewed knowledge) while keeping the renderer role-agnostic.

## Risks / Trade-offs

- [Muted edges harm readability in dense domains] → Modulation deltas bounded and validated against the existing ≥ 3:1 contrast tests; Playwright pixel-regression suite must still pass; density caps unchanged.
- [2D/3D drift in modulation or category cues] → All style resolution stays in shared `visual-config.ts`/`edge-presentation.ts` pure functions; parity tests extend to evidence and category cases.
- [Legacy mapping misclassifies current nodes] → Macro-categories are presentation-only and the neutral fallback is always acceptable; the mapping table ships with unit tests per `nodeType`/`knowledgeDim` combination and a visual QA pass.
- [Candidate filtering confuses counts (e.g. "132 nodes")] → Node-count badges reflect the rendered (post-filter) set for learners, with an inspector-level note when candidates were hidden; teacher counts include candidates.

## Migration Plan

1. Land shared style resolvers (evidence modulation, category classifier, coverage scale) with unit tests — renderers unchanged.
2. Wire 2D then 3D renderers + legend + inspector rows; extend parity and contrast tests.
3. Wire candidate filtering in the view-model with role-gated tests.
4. Visual QA at 1440×900 and 390×844 in both themes; Playwright performance budget run.
5. Rollback: revert; no data or schema migration involved.

## Open Questions

- Exact opacity/width deltas for the muted variant — finalize during visual QA against the contrast floor.
- Whether teacher contexts default to showing candidates or require an explicit toggle — default to showing with badge; confirm with course team.

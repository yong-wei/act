## Why

The projection contract (change `extend-knowledge-graph-projection-contract`) puts evidence state on public links and projection-shaped attributes on public nodes, but the canvas still renders every edge and node as if all knowledge were equally verified and equally classified. Learners currently cannot distinguish a reviewed, evidence-backed prerequisite chain from an unverified assertion, and when the ActKG base lands there will be no visual vocabulary ready for its concept kinds, coverage counts, and candidate nodes. This change builds that vocabulary now, driven by today's derivable data, so the ActKG switchover becomes a data swap rather than a redesign.

## What Changes

- Encode link `evidenceState` on the 2D and 3D canvas as a bounded modulation within each relation family's existing grammar (unavailable-evidence edges render muted: lower opacity and reduced width; absent/unknown state renders exactly as today). No new color roles; platform tokens only; contrast floor preserved.
- Add an evidence dimension to the graphical relation legend and to the inspector relation rows, so canvas, legend, and inspector never disagree about what is verified.
- Introduce a concept macro-category configuration (six teaching-oriented categories grouping ActKG's fifteen `concept_kind` values) consumed by node presentation. Today it is fed by the existing `nodeType`/`knowledgeDim` mapping; when `conceptKind` is present it takes precedence with no further renderer change.
- Extend node scale policy: `sourceCoverageCount` (when present) joins as a capped tertiary signal after teaching importance and degree centrality; absent coverage never shrinks a node below its current size.
- Render `candidate: true` nodes as governance candidates: excluded from learner-facing canvas by default, visible in teacher/review contexts with a dashed candidate outline and badge.
- No layout algorithm, interaction, density-cap, root-bubble, or inspector-persistence changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: Extend the relation visual grammar with an evidence-state modulation; extend node scale policy with a coverage signal; add concept macro-category presentation, candidate-node governance visibility, and legend/inspector evidence parity requirements.

## Impact

- Affects `src/features/knowledge/graph/` presentation modules (`edge-presentation.ts`, `visual-config.ts`, `knowledge-graph-2d.tsx`, `knowledge-graph-canvas.tsx`, `three-link-presentation.ts`, `relation-family-control.tsx`, `node-label-layout.ts`) and the inspector relation rows; focused Vitest/Playwright performance budgets apply unchanged.
- Depends on `extend-knowledge-graph-projection-contract` (field contract); must not start before it lands.
- Does not modify canonical knowledge data, relation projection, path planning, persistence schemas, backend APIs, or the ActKG adapter itself.

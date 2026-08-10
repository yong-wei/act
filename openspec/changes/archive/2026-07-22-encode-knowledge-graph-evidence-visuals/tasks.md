# Tasks: encode-knowledge-graph-evidence-visuals

> Depends on `extend-knowledge-graph-projection-contract`. Do not start before that change lands.

## 1. Shared style resolvers

- [x] 1.1 Add evidence-modulation resolution to `graph/edge-presentation.ts` / `visual-config.ts`: given family style + `evidenceState`, return bounded muted variants (opacity/width deltas) honoring the contrast floor; absent state returns the unmodified family style.
- [x] 1.2 Add `resolveConceptMacroCategory` with the 15→6 concept-kind grouping table and the legacy `nodeType`/`knowledgeDim` fallback in `visual-config.ts`, neutral on unknown kinds.
- [x] 1.3 Extend the node scale pipeline with `sourceCoverageCount` as a capped tertiary signal (absence neutral).
- [x] 1.4 Unit tests: modulation bounds and contrast, grouping table completeness for all 15 kinds, legacy fallback per nodeType/knowledgeDim, unknown-kind neutrality, coverage ordering and absence neutrality.

## 2. Renderer and legend wiring

- [x] 2.1 Wire evidence modulation and macro-category cues into the 2D renderer (`knowledge-graph-2d.tsx`) without touching layout, density, or interaction logic.
- [x] 2.2 Wire equivalent treatment into the 3D renderer (`knowledge-graph-canvas.tsx`, `three-link-presentation.ts`) preserving 2D/3D parity contracts.
- [x] 2.3 Add the evidence swatch pair to the graphical relation legend (`relation-family-control.tsx`) with theme-matched samples.
- [x] 2.4 Extend parity, contrast, and density tests: 2D/3D same modulation, ≥ 3:1 contrast for muted variants, caps unchanged, unknown state byte-identical rendering.

## 3. Inspector evidence parity

- [x] 3.1 Align inspector relation rows with canvas modulation for the same relation, keeping the honest `关系依据未提供` fallback.
- [x] 3.2 Client test: selected node with mixed evidence states shows canvas/inspector agreement and never fabricates evidence.

## 4. Candidate governance visibility

- [x] 4.1 Filter `candidate: true` nodes and incident edges in the graph view-model for learner roles; annotate hidden-candidate counts where counts are displayed.
- [x] 4.2 Render candidates with dashed outline + badge and candidate-muted edges in teacher/review contexts.
- [x] 4.3 Tests: learner exclusion (canvas, legend counts, label layout), teacher distinct rendering, non-candidate visibility unaffected.

## 5. Validation and visual QA

- [x] 5.1 Run focused knowledge graph suites plus `rtk npm run typecheck` and the Playwright knowledge-graph performance budget; fix in-scope failures.
- [x] 5.2 Capture and inspect `/knowledge` at 1440x900 and 390x844 in light and dark themes: muted edges, legend swatches, category cues, candidate states.
- [x] 5.3 Run `rtk openspec validate encode-knowledge-graph-evidence-visuals --type change --strict` and resolve all findings.
- [x] 5.4 Obtain independent code review clearance for the final diff and resolve all blocking findings.

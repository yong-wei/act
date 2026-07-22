# Tasks: animate-knowledge-graph-flow-and-root-vitality

## 1. Generalized flow layer

- [x] 1.1 Extract corridor marker selection into `resolveFlowMarkerSet({ scope: 'corridor' | 'ambient' })` in `graph/motion.ts`: ambient eligibility from the visible post-requisite structural-foreground set, deterministic capped selection, per-edge phase offsets from edge-key hash, shared-segment dedup.
- [x] 1.2 Extend `bindKnowledgeGraphMotionEnvironment` to suspend ticking on tab hidden, canvas offscreen, and mid-transition states.
- [x] 1.3 Unit tests: deterministic selection and budget conformance, phase stagger distinctness, dedup, corridor scope unchanged, pause/resume behavior, reduced-motion gating.

## 2. Renderer wiring

- [x] 2.1 Render subdued family-tinted ambient markers in the 2D painter before corridor markers, keeping static arrow semantics and lane curvature intact.
- [x] 2.2 Render equivalent ambient markers in the 3D link presentation with parity of eligibility, budget, and phasing.
- [x] 2.3 Extend 2D/3D parity and interaction tests: ambient flow does not move geometry, does not reheat layout, stops prominent corridor markers on deselection while ambient continues subdued.

## 3. Root bubble vitality

- [x] 3.1 Add layered vitality tokens (inner highlight offset, rim-light arc, halo range, breathing period/intensity bounds) to `visual-config.ts` from platform tokens for both themes.
- [x] 3.2 Implement the 2D bubble paint layer: halo → body → rim-light → label order, breathing on active/hover, bounded entrance stagger on mount.
- [x] 3.3 Implement equivalent 3D bubble treatment and confirm label texture and internal label contracts are untouched.
- [x] 3.4 Tests: deterministic packing/radii/hit areas unchanged, labels fully visible after all effects, reduced-motion static equivalence, entrance settles to identical presentation.

## 4. Performance and spec alignment

- [x] 4.1 Update `tests/knowledge-graph-performance.spec.ts` marker expectations from the corridor-only cap to the ambient+corridor budget, and assert pause-when-hidden.
- [x] 4.2 Run focused knowledge graph suites, `rtk npm run typecheck`, and the Playwright performance budget (p95 rAF < 24 ms); fix in-scope failures.
- [x] 4.3 Capture and inspect root and domain views at 1440x900 and 390x844 in light and dark themes: ambient flow, corridor prominence, bubble vitality, entrance stagger.
- [x] 4.4 Run `rtk openspec validate animate-knowledge-graph-flow-and-root-vitality --type change --strict` and resolve all findings.
- [x] 4.5 Obtain independent code review clearance for the final diff and resolve all blocking findings.

# Design: Knowledge Graph Flow Layer & Root Bubble Vitality

## Context

The graph already owns a production-grade motion stack in `src/features/knowledge/graph/motion.ts`: `KnowledgeGraphMotionFrameLoop`, travel/pause frame timing (`travelDurationMs: 1200`, `pauseDurationMs: 360`), 64-sample path placement with tangent rotation, eligibility/suppression scoping, and reduced-motion gating. Today it is scoped to a selected corridor with `maxMarkers: 3`, and the Playwright performance suite pins that cap (`markerMaximum`, `markerReachedThree`). Root bubbles (refined by `refine-knowledge-graph-root-bubbles-and-inspector-persistence`) render gradient + rim + glow but no temporal dimension; their packing, radii, and internal labels are pinned contracts.

Hard constraints: frozen layouts with no reheat; deterministic root packing and always-visible internal labels; p95 rAF < 24 ms; initial visible lines ≤ 32; post-requisite structural foreground already capped at 32 edges; 2D/3D parity; reduced-motion equivalence.

## Goals / Non-Goals

**Goals**
- Ambient directional flow on the structural foreground (traffic-network feel), scoped and budgeted.
- Paint-level root bubble vitality: depth layers, breathing active state, bounded entrance stagger.
- Accessibility and performance conformance as first-class scenarios.

**Non-Goals**
- No geometry, packing, layout, navigation, density-cap, or data changes.
- No changes to corridor marker semantics (they stay prominent on selection).
- No third-party animation library; the existing frame loop is extended.

## Decisions

### D1: Reuse the corridor marker machinery as a general flow layer

Extract the corridor marker pipeline into a `resolveFlowMarkerSet({ scope })` with two scopes: `corridor` (unchanged behavior, prominent treatment) and `ambient` (new). Ambient eligibility = the already-computed visible post-requisite structural-foreground edge set (the same ≤32 set used for density), optionally plus visible child edges. Markers share the frame loop, path sampling, and tangent placement — no second animation system.

*Alternative considered:* CSS/SVG overlay animation. Rejected — edges are canvas/Three.js paths with lane curvature; only the existing path samplers know the true geometry.

### D2: Deterministic budget with staggered phases

Ambient concurrent markers are capped (target ≈ 8–12, finalized against the frame budget) and selected deterministically (sort by edge key, take first N of the eligible set) so replays are stable and tests can assert selection. Each marker gets a phase offset derived from its edge key hash, producing the staggered "traffic" feel instead of a synchronized pulse. Markers-per-edge stay at one; heavily shared segments dedupe exactly as corridor markers do today.

*Alternative considered:* marker on every visible edge. Rejected — 32 simultaneous triangles is visual noise and blows the frame budget on weak GPUs.

### D3: Subdued ambient treatment, prominent corridor treatment

Ambient markers use smaller geometry and lower alpha tinted by the edge's family color; corridor markers keep current geometry and prominence and are drawn after ambient markers. When `encode-knowledge-graph-evidence-visuals` is present, evidence-muted edges render correspondingly subdued ambient markers (coordination point, whichever lands second).

### D4: Pause when unseen

The frame loop already centralizes ticking; extend `bindKnowledgeGraphMotionEnvironment` to also suspend on `document.visibilitychange` and IntersectionObserver-offscreen, and to freeze during domain transitions. This turns ambient flow from a constant cost into an on-demand one.

### D5: Bubble vitality is a pure paint layer

Vitality lives in the bubble paint functions (2D canvas painter, 3D texture/material builder): offset inner highlight, rim-light arc (a rotated partial ring), outer halo with slow intensity oscillation on the active bubble (period ≈ 2.4 s, bounded alpha), and a mount-time staggered fade/settle (≤ 400 ms total, within existing `totalRevealDurationMs` philosophy). No effect writes to node `x/y/fx/fy`, radii, or label layout — the deterministic packing contract is structurally untouchable.

*Alternative considered:* idle position drift ("floating" bubbles). Rejected — it would violate the frozen-layout and no-reheat requirements.

## Risks / Trade-offs

- [Frame budget regression from ambient markers] → Deterministic cap, pause-when-unseen, and updated Playwright expectations (`markerMaximum` becomes the ambient+corridor budget; `markerReachedThree` replaced by budget-conformance assertions); p95 rAF < 24 ms must still pass.
- [Ambient flow reads as noise in dense domains] → Subdued treatment + budget + dedup; visual QA at 1440×900 and 390×844 in both themes with the densest domain fixture.
- [2D/3D drift in flow or vitality] → All eligibility, budget, and phase logic in shared pure functions (`motion.ts`, `visual-config.ts`); renderers only consume resolved marker poses and paint tokens; parity tests extended.
- [Vitality overdrawing bubble labels] → Paint order pinned: halo → body → rim-light → label; scenario asserts labels stay fully visible.

## Migration Plan

1. Extract `resolveFlowMarkerSet` + environment pause with unit tests (no visual change yet).
2. Wire ambient flow in 2D, then 3D; extend parity tests.
3. Implement bubble vitality paint layers + entrance stagger in 2D and 3D.
4. Update performance spec expectations; run full knowledge graph suites, typecheck, Playwright budget, and visual QA.
5. Rollback: revert; no data or schema changes.

## Open Questions

- Final ambient budget number (8 vs 12) — settle during performance runs on the densest fixture.
- Whether child-family edges join ambient flow in v1 or after user feedback — default: post-requisite only in v1.

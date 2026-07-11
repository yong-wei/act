# Task 3 Report: Stable Sector Layout

Status: DONE

## Scope

- Completed OpenSpec tasks 3.1–3.4 only.
- Replaced complete-ring placement with deterministic bounded sectors and additional arcs.
- Added activation-intent provenance, stable center-id tie-breaking, canonical chapter-root relation filtering, occupied-space scoring, and first-reveal ownership.
- Preserved established and pinned coordinates; only newly materialized neighbors receive automatic fixed coordinates.
- Froze 2D/3D renderer coordinates after deterministic layout and disabled ordinary force reheating.
- Preserved explicit relayout/reset behavior, including provenance invalidation.

## TDD Evidence

RED: `knowledge-graph-expansion-layout.test.ts` initially failed 4 new cases covering sector bounds, overlapping provenance, existing-neighbor preservation, multiple arcs, and drag isolation.

GREEN:

- `npm run test:unit -- --run src/features/knowledge/__tests__/knowledge-graph-expansion-layout.test.ts src/features/knowledge/__tests__/knowledge-graph-node-expansion-control.test.ts src/features/knowledge/__tests__/knowledge-graph-interaction-state.test.ts src/features/knowledge/__tests__/knowledge-node-activation.test.ts`
- Result: 4 files passed, 53 tests passed.

## Verification

- `npm run typecheck`: passed.
- Touched-file ESLint: passed with zero errors and zero warnings.
- `openspec validate redesign-knowledge-graph-direct-manipulation --type change --strict`: passed.
- Diff review: limited to Task 3 layout, renderer freeze, activation payload ordering support, focused tests, and tasks/report artifacts.

## Concerns

None. Task 4 motion, camera behavior changes, inspector behavior, and Task 5 browser evidence remain intentionally untouched.

## Review Remediation

Status: DONE

- Added an activation-intent commit queue. Expansion responses may arrive in reverse order, but cache merge, materialization, and provenance commit only after every earlier activation has settled, failed, or been cancelled.
- Added deferred asynchronous coverage for reversed response order and overlapping shared-neighbor provenance; later payloads preserve the winning first-reveal coordinate.
- Graph-version changes now reset system activation/materialization state, abort stale expansion requests, clear the commit queue, and synchronously invalidate 2D/3D runtime coordinate/provenance caches before rebuilding same-id nodes.
- Occupied-space scoring now excludes only pending unanchored materializations; historical materialized anchors participate in later collision scoring.
- Multi-edge neighbors now select a canonical relation by density, relation, endpoint role, and stable link id before neighbor ordering.
- Connected drag isolation to actual 2D and 3D `onNodeDrag` callbacks. A mounted controlled-renderer test verifies only the dragged coordinates change and cooldown remains disabled.

Review verification:

- Focused tests: 5 files, 62 tests passed.
- `npm run typecheck`: passed.
- Touched-file ESLint: zero issues.
- OpenSpec strict validation: passed.

## Fresh Review Remediation

Status: DONE

- Activation sequence state now records every expansion attempt rather than retaining a center's first attempt. Failed or cancelled attempts only settle the commit queue; a later retry receives its later sequence and cannot reclaim provenance from an intervening successful center.
- Network expansion materialization now compares payload node ids against the visible-node snapshot captured at activation time. Nodes already present in background cache but hidden from the canvas are therefore materialized and sector-anchored consistently with cached-shard expansion.
- Added failure → intervening success → retry shared-neighbor provenance coverage and hidden-background-cache materialization coverage.

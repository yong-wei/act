---
change_id: redesign-knowledge-graph-direct-manipulation
claim_branch: redesign-knowledge-graph-direct-manipulation
series: knowledge-graph-experience
coupling_group: knowledge-graph-interaction
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/redesign-knowledge-graph-direct-manipulation
risk: high
area: knowledge-graph
---

## Goal

Replace the `/knowledge` graph's two-step node-local expansion button and complete-ring cross layout with direct node activation, deterministic outward-sector expansion, stable single-node dragging, bounded explanatory motion, and a clearer leaf-node inspector hierarchy.

## Scope

- Add versioned expandability metadata to progressive graph payloads so the client can distinguish expandable, leaf, and compatibility-unknown nodes.
- Make one node activation expand or collapse expandable nodes and open the inspector only for leaf nodes, with pointer and keyboard parity.
- Replace complete 360-degree focused rings with deterministic outward sectors and additional arcs that never move existing or user-positioned nodes.
- Freeze established coordinates after initial layout so dragging changes only the dragged node.
- Add bounded focus, relation-reveal, node-reveal, collapse, and local-camera motion with reduced-motion equivalence.
- Dismiss the inspector on blank-canvas activation or drag start and render Knowledge Card before Related Knowledge Points.
- Preserve the existing “智控深蓝” design system, relation grammar, progressive loading, floating workspace, and 2D/3D modes.
- Use the authenticated Chaoxing course graph only as an interaction reference for direct activation, outward fan revelation, focus dimming, and staged relation reveal; do not copy its visual skin.

## Out of Scope

- Knowledge semantics, relation taxonomy, course content, ResourceNode binding, learning-path logic, Konling permissions, or graph authoring.
- Replacement of the existing graph renderer or introduction of a new physics/layout dependency.
- Continuous particles, ambient orbiting, perpetual pulsing, free-running force motion, or a copied Chaoxing theme.
- Context menus, batch node editing, multi-select, or new graph management workflows.

## Acceptance Checklist

- [ ] AC-1: Versioned graph payloads identify expandable, leaf, and unknown nodes, and every graph, directory, search, deep-link, or related-item activation uses one resolver that expands/collapses expandable nodes or opens leaf details without a second expansion button. Owner: independent reviewer.
  Evidence: payload/unit fixtures plus browser and keyboard traces for collapsed, expanded, filtered-empty, filter recovery, canonical leaf, unknown resolution, loading, error, retry, duplicate suppression, and cache-reuse states.
- [ ] AC-2: Newly materialized neighbors use deterministic outward-sector or multi-arc placement derived from stable first-reveal provenance and canonical neighbor rules, and never relocate existing, pinned, or unrelated nodes. Owner: independent reviewer.
  Evidence: layout unit tests, provenance and coordinate snapshots, and browser screenshots for activation-sequence arbitration, reversed response order, overlapping reveals, root fallback, dense, existing-neighbor, repeated-reveal, and pinned cases.
- [ ] AC-3: Initial graph coordinates freeze after layout and dragging a node changes only that node while explicit reset/relayout remains functional. Owner: independent reviewer.
  Evidence: before/during/after coordinate assertions in 2D and 3D plus reset/relayout regression tests.
- [ ] AC-4: Expansion and collapse use bounded, cancellable one-shot focus, edge, node, and local-camera transitions with no new expansion-specific perpetual motion, a large-shard fallback, and an equivalent reduced-motion path that preserves static relation direction. Owner: independent reviewer.
  Evidence: motion-state and stale-callback tests, timestamped browser recording or screenshots, large-shard performance observations, and a `prefers-reduced-motion` run.
- [ ] AC-5: Leaf inspectors close on blank-canvas activation, canvas drag start, node drag start, expandable-node activation, or an expandable Related Knowledge Points activation without changing graph state; Knowledge Card renders before Related Knowledge Points on desktop and mobile. Owner: independent reviewer.
  Evidence: component/Playwright assertions, DOM order checks, state snapshots, and desktop/mobile screenshots.
- [ ] AC-6: Direct node activation remains keyboard and screen-reader operable after the node-local expansion button is removed, with visible focus and non-color busy, expanded, leaf, error, and retry communication. Owner: independent reviewer.
  Evidence: semantic DOM/accessibility assertions and keyboard browser traces in light/dark and narrow/desktop states.
- [ ] AC-7: Independent visual review finds no cross/star focused topology, global layout movement, inspector/canvas/dock collision, canvas resize, unreadable focus, or 2D/3D divergence, and all OpenSpec, Buddy, TypeScript, focused unit, and browser gates pass. Owner: independent reviewer.
  Evidence: visual evidence matrix, reviewer verdict, validation logs, and focused test output.

## Tasks

- [ ] Task 1: Extend progressive graph contracts and fixtures with graph-version-consistent expandability metadata.
  Covers: AC-1
  Acceptance: Root, expansion, active-filter, and remaining payloads expose expandable, leaf, or unknown state and revealable-neighbor count without browser-side full-graph loading or link-absence inference.
  Evidence: payload builder tests, cache-version tests, and updated fixtures.
  Reviewer Check: Confirm metadata is derived from canonical graph relations, invalidates with graph version, and does not leak or require the full relation payload in the client.
- [ ] Task 2: Implement the shared direct activation resolver and semantic node activation path, then remove the old node-local button and instruction panel.
  Covers: AC-1, AC-6
  Acceptance: 2D/3D nodes, directory, search, deep links, and Related Knowledge Points share one resolver for collapsed, expanded, filtered-empty, filter recovery, canonical leaf, unknown, loading, error, and retry states with no duplicate activation.
  Evidence: component/integration tests and browser traces for every entry point in 2D and 3D.
  Reviewer Check: Confirm no second expansion click remains, only canonical leaf evidence opens the inspector, filtered-empty does not become leaf, and keyboard/screen-reader access is not regressed when the DOM button is removed.
- [ ] Task 3: Replace full-ring focused layout and free-moving drag behavior with deterministic sectors and frozen established coordinates.
  Covers: AC-2, AC-3
  Acceptance: Newly materialized neighbors occupy an outward sector or additional arcs using activation-sequence-ordered first-reveal provenance and deterministic scoring, existing coordinates remain unchanged, and only the dragged node is persisted or moved.
  Evidence: deterministic provenance/layout tests, reversed network-order and overlapping-reveal cases, coordinate snapshots, repeated-reveal cases, 2D/3D drag assertions, and browser evidence.
  Reviewer Check: Confirm response arrival order cannot choose provenance, cross/star layouts and global force reheating are absent, canonical neighbor rules are unambiguous, already visible neighbors are not duplicated or moved, and reset/relayout remains explicit.
- [ ] Task 4: Add bounded expansion/collapse motion and reduced-motion equivalence using existing platform visual tokens.
  Covers: AC-4
  Acceptance: Focus, edge, node, collapse, and necessary local-camera transitions finish within bounded durations, cancel stale callbacks, batch large shards, and do not alter canonical coordinates.
  Evidence: transition-state and cancellation tests, rapid target-switch traces, timestamped evidence, large-shard observations, and reduced-motion browser run.
  Reviewer Check: Confirm motion explains origin and direction, adds no expansion-specific continuous effects or full zoom-to-fit, preserves existing semantic relation grammar, disables animated particles under reduced motion, remains performant, and is not a visual copy of Chaoxing.
- [ ] Task 5: Implement inspector dismissal and information hierarchy changes across desktop and mobile.
  Covers: AC-5
  Acceptance: Required blank/drag/expand events close the inspector without graph-state mutation, and Knowledge Card precedes Related Knowledge Points before downstream actions.
  Evidence: DOM order assertions, interaction tests, state snapshots, and responsive screenshots.
  Reviewer Check: Confirm dismissal does not collapse neighborhoods, clear cache, move nodes, resize the canvas, or lose appropriate focus return.
- [ ] Task 6: Complete cross-surface regression, accessibility, motion, visual-governance, and release validation.
  Covers: AC-6, AC-7
  Acceptance: 2D/3D, light/dark, desktop/narrow, reduced-motion, local-tool, inspector, and Konling collision states pass automated and independent review gates.
  Evidence: focused test logs, TypeScript and OpenSpec validation, visual evidence matrix, and independent reviewer verdict.
  Reviewer Check: Reject any cross/star topology, unrelated coordinate movement, inaccessible activation, perpetual motion, incorrect inspector order, overlap, canvas resize, or evidence limited to render-only screenshots.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

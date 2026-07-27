---
change_id: refine-knowledge-graph-path-focused-navigation
claim_branch: refine-knowledge-graph-path-focused-navigation
series: knowledge-graph-experience
coupling_group: knowledge-graph-workspace
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/refine-knowledge-graph-path-focused-navigation
risk: high
area: knowledge-graph
---

## Goal

Turn the learner-facing knowledge graph into a compact two-level domain navigator and prerequisite-path reader: one active domain at a time, three understandable relation families, prerequisite-aware spiral placement, truthful boundary-clipped edges, focused path motion, readable node labels, and a stable selected-node inspector.

## Scope

- Replace the distant root ring and recursive radial expansion with compact root packing and explicit single-domain navigation.
- Project canonical relations into child, post-requisite, and association canvas families while retaining all raw semantics in details.
- Add prerequisite-constrained spiral layout, cycle and disconnected-node handling, and bounded path-corridor focus.
- Render node-boundary edges, reciprocal curves, target arrowheads, larger wrapped node labels, and selected-only path-following motion.
- Replace the full semantic legend with a compact interactive three-family control.
- Decouple node inspection from domain navigation and progressive loading across desktop, mobile, 2D, 3D, keyboard, and reduced-motion flows.

## Out of Scope

- Changing canonical runtime graph files, database relation types, K/A/Q schemas, or relation evidence.
- Adding another authored hierarchy below chapter/domain membership.
- Replacing adaptive path-planning, ResourceNode launch, Knowledge Card, evidence, or assistant-context systems.
- Removing the optional 3D graph mode.

## Acceptance Checklist

- [ ] AC-1: The root view shows compact large domain nodes, activating one domain hides unrelated domains, and a visible return action restores the root view. Owner: independent reviewer.
  Evidence: navigation component tests and desktop/mobile browser captures for root, domain, and return states.
- [ ] AC-2: All runtime, database, English/Chinese alias, and zero-instance relations map through a normative contract without losing raw direction; reverse child and unknown types block; post cycles are diagnosed; directed associations have source/target sentences; and the compact legend implements default, all, mixed, and bounded one-hop association states. Owner: independent reviewer.
  Evidence: end-to-end coverage checker, alias/follows/reverse-child/cycle/cross-family fixtures, inspector sentence and unavailable-evidence assertions, and desktop/mobile legend density tests.
- [ ] AC-3: Domain nodes use deterministic teaching order; without lesson context, canonical post-requisite edges define order, while valid `/knowledge?lessonId=` preserves covered lesson `card_order` before post-requisite fill of uncovered nodes; invalid lesson context clears, overlay links require exact canonical triples and never create edges, and layout meets reproducible bounds. Owner: independent reviewer.
  Evidence: lesson URL/launch/invalid-clear; sequence-authoritative exact manifest match and exact `graph_order_policy: "manifest-reviewed-no-sequence"` fallback; mandatory `1-1`/`4-2`/`5-2` equality; RFC 8785 cross-language canonical-byte/digest vectors; named overlay-edge fixtures; layout metrics; and visual captures.
- [ ] AC-4: Static edges connect node boundaries, reciprocal relations use non-overlapping curves, directed edges have one target-boundary arrowhead, and larger wrapped labels overlay nodes without hiding edge direction. Owner: independent reviewer.
  Evidence: geometry and label tests plus 2D/3D visual captures.
- [ ] AC-5: Selecting a knowledge node derives only a four-level/64-node/96-edge corridor from authored canonical post-requisite relations, clips it to the active domain with explicit adjacent-domain navigation, deduplicates shared segments, suppresses cycle motion, and uses at most three tangent-aligned arrows; persisted LearningPath and ResourceNode path data are not consumed. Owner: independent reviewer.
  Evidence: corridor cap, branch/convergence, cross-domain clipping, cycle suppression, persisted-path non-consumption, motion, reduced-motion, and performance tests.
- [ ] AC-6: Node selection always opens or updates the stable inspector independently from navigation/loading; child membership, cycle state, raw association directions, provenance, and adjacent-domain canonical corridor context remain inspectable; `path-eligibility` and planned-segment triggers are absent while source-owned resource launch remains; read-only graph navigation never implies completion; and scroll/mobile/stale-response contracts remain intact. Owner: independent reviewer.
  Evidence: component and browser tests for child provenance, selection, async updates, cross-domain navigation, drag/pan and blank-canvas dismissal, mobile collapse, and stale responses.
- [ ] AC-7: 2D, 3D, desktop, mobile, pointer, keyboard, light/dark, and reduced-motion modes preserve equivalent navigation, relation-family, direction, inspector, and accessibility semantics. Owner: independent reviewer.
  Evidence: mode-parity tests, accessibility assertions, and visual acceptance artifacts.
- [ ] AC-8: The change passes focused graph tests, typecheck, applicable lint, strict OpenSpec validation, Buddy issue validation, and representative performance bounds without changing canonical graph data. Owner: independent reviewer.
  Evidence: recorded command output, graph-data diff check, performance metrics, and independent review summary.

## Tasks

- [ ] Task 0: Restore a reproducible green graph-spec baseline before feature implementation.
  Covers: AC-8
  Acceptance: Record proposal-time 11/12 with the known source-string assertion failure; before feature edits, replace it with a directly callable behavior contract and run `npm run test:unit -- src/lib/__tests__/resource-node-knowledge-workspace-ui.test.ts` with 12/12; retain the exact final gate.
  Evidence: proposal-time 11/12, pre-feature 12/12, and final 12/12 command output.
  Reviewer Check: Confirm implementation work did not begin on a red or undefined baseline.
- [ ] Task 1: Implement the normative relation-family projection, blocking coverage checker, and shared edge geometry contract.
  Covers: AC-2, AC-4
  Acceptance: Every runtime, database, English/Chinese alias, and zero-instance type has an explicit family/direction rule; malformed JSONL, missing/empty/unknown type, duplicate ids, and reverse child block end-to-end; synthetic `chapter-link:*` membership defines scope only and never becomes a child edge; post cycles remain motionless; associations retain directional provenance; cross-family edges coexist; static and animated rendering share geometry.
  Evidence: machine-readable blocking coverage, malformed/missing/duplicate/alias/follows/reverse-child/chapter-link/cycle/cross-family/provenance/sentence, boundary-intersection, curve, arrowhead, and tangent tests.
  Reviewer Check: Confirm canonical relation data remains unchanged and inspector provenance covers every visual merge.
- [ ] Task 2: Implement explicit compact-root and single-domain progressive navigation.
  Covers: AC-1, AC-6
  Acceptance: Domain activation loads or reuses its shard, treats chapter metadata only as scope, represents failure/retry/filtered-empty honestly, hides unrelated domains, exposes return navigation, normalizes trusted lesson launch context to `/knowledge?lessonId=`, clears invalid lesson state, and routes all activation surfaces through one resolver without using inspector closure as navigation state.
  Evidence: component and browser tests for root, loading, failure, retry, filtered-empty, cache reuse, domain, lesson launch/URL/clear, return, deep-link, directory, and cross-domain flows.
  Reviewer Check: Confirm no ordinary knowledge node recursively creates another hierarchy level.
- [ ] Task 3: Implement deterministic root packing and prerequisite-constrained domain layout.
  Covers: AC-3
  Acceptance: Root nodes remain compact; a shared resolver makes sequence order authoritative when present, requires exact manifest agreement, permits manifest-only only with exact machine policy, and requires `1-1`/`4-2`/`5-2` equality before export; without lesson context layout uses canonical post edges; with valid lesson context, RFC 8785 revisioned runtime order preserves covered nodes before post-edge fill; no other fallback or overlay-created edge is allowed; and layout meets the collision protocol.
  Evidence: resolver match/mismatch/manifest-only, cross-language revision, lesson transport/clear, no-active-lesson/shared-node/noncanonical-overlay, collision, cycle, and screenshot evidence.
  Reviewer Check: Confirm association and child relations do not fabricate prerequisite depth.
- [ ] Task 4: Implement wrapped node labels and three-family 2D/3D rendering.
  Covers: AC-2, AC-4, AC-7
  Acceptance: Both renderers show the same domain subset and family visibility, boundary-clipped edges, reciprocal curves, target arrows, node-overlaid wrapped labels, and compact desktop/mobile legend behavior.
  Evidence: renderer tests and light/dark desktop/mobile 2D/3D captures.
  Reviewer Check: Confirm visual family meaning does not depend on color alone and labels remain readable at default zoom.
- [ ] Task 5: Implement bounded selected-path focus and path-following motion.
  Covers: AC-5, AC-7
  Acceptance: Selected corridors use only canonical post-requisite edges, remain bounded and active-domain scoped, expose adjacent-domain navigation, deduplicate shared segments, suppress SCC motion, and animate at most three exact-geometry arrows; persisted LearningPath/ResourceNode path context is ignored and requires a separate future governance change.
  Evidence: persisted-path non-consumption, corridor cap, branch/convergence, cross-domain, cycle, motion, reduced-motion, and performance evidence.
  Reviewer Check: Confirm the animation begins at the source boundary, disappears at the final target, and never drifts from straight or curved edges.
- [ ] Task 6: Complete stable inspector and detail-semantic integration.
  Covers: AC-6, AC-7
  Acceptance: Inspector content updates independently from domain state; exposes child, cycle, directed association sentences, provenance, and adjacent-domain canonical corridor context; removes `path-eligibility` and persisted planned-segment inputs; preserves opaque source-owned ResourceNode/adaptive-node launch, Knowledge Card/evidence actions, and scroll/mobile contracts; rejects stale responses; and never writes learning completion.
  Evidence: inspector state, child/cycle/directional/provenance detail, async ownership and scroll, read-only completion, drag/pan, mobile collapse, cross-domain, launch, assistant-context, and accessibility tests.
  Reviewer Check: Confirm selecting expandable or progressively resolved content no longer makes the inspector disappear.
- [ ] Task 7: Run complete behavioral, visual, accessibility, performance, and contract validation.
  Covers: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
  Acceptance: The exact Task 0 baseline command remains 12/12; focused tests, the machine-readable semantic checker, content review/export gates, typecheck, applicable lint, strict OpenSpec/Buddy validation, removed-requirement/archive-contract tests, canonical graph-data immutability checks, required lesson/domain/path/source-family fixtures, and reproducible performance bounds pass with stored evidence.
  Evidence: command transcript, review-check output, visual acceptance files, protocol metadata and raw metrics, data diff, and independent reviewer report.
  Reviewer Check: Confirm each AC has current evidence and no canonical graph or unrelated workspace behavior changed.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

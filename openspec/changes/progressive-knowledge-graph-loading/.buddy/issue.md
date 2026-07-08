---
change_id: progressive-knowledge-graph-loading
claim_branch: progressive-knowledge-graph-loading
series: knowledge-graph-workspace-redesign
coupling_group: knowledge-graph-visual-clarity
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/progressive-knowledge-graph-loading
risk: medium
area: ui
---

## Goal

Make the knowledge graph load progressively so `/knowledge` first render shows collapsed top-level graph roots instead of waiting for the full graph payload, while node expansion, filter changes, and dense exploration load only missing graph shards.

## Scope

- Replace full-payload-first `/knowledge` loading with a root-first graph payload.
- Add explicit expand/collapse behavior for graph nodes.
- Add active-filter and remaining-graph background loading batches.
- Add versioned shard keys and client-side de-duplication for loaded nodes, links, and shards.
- Preserve existing knowledge graph ResourceNode actions, local tools, selected-node inspector, Konling context, and layout-stability contracts.
- Add tests and visual/browser evidence proving first render does not depend on the full graph endpoint.

## Out of Scope

- Re-authoring the canonical knowledge graph data.
- Replacing the graph renderer library.
- Changing ResourceNode registry semantics or path-planning resource eligibility.
- Durable offline graph caching beyond the session-level or browser cache behavior needed for this change.
- Redesigning AppShell navigation or knowledge graph local tool placement.

## Acceptance Checklist

- [ ] AC-1: `/knowledge` first render displays collapsed top-level graph roots without requesting, parsing, or depending on the full graph payload before roots are visible. Owner: independent reviewer.
  Evidence: browser or component test showing root nodes visible before any full graph endpoint request or parse, plus source diff.
- [ ] AC-2: Selecting a collapsed node exposes expand behavior; expanding loads only missing shards, shows local loading when needed, and collapsing hides descendants without clearing cache. Owner: independent reviewer.
  Evidence: focused component/browser test and cache state assertions.
- [ ] AC-3: Active-filter shards and remaining graph shards load in ordered background batches without blocking graph interaction, local tools, selected-node inspector, or Konling entry. Owner: independent reviewer.
  Evidence: browser evidence and tests for background loading state, structured overlap checks, focus-return checks, and dock-avoidance metadata.
- [ ] AC-4: Shard cache keys, graph version handling, and node/link merge behavior prevent duplicate requests and duplicate graph objects. Owner: independent reviewer.
  Evidence: unit tests for graph payload helpers and client cache reducer/merge logic.
- [ ] AC-5: Existing knowledge graph ResourceNode actions, relation filters, inspector, Konling context, 2D/3D modes, keyboard/focus behavior, filtered-empty states, and layout stability remain intact. Owner: independent reviewer.
  Evidence: focused regression tests, visual/browser review at 1440px, 1279px, 1100px, 1024px, and 320px, and filtered-empty expansion evidence.
- [ ] AC-6: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate progressive-knowledge-graph-loading --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Define graph root, expansion, active-filter shard, remaining-shard, graph version, node id, and link key contracts.
  Covers: AC-1, AC-4
  Acceptance: Contracts distinguish visible expansion state from cached graph data and include stable graph version and shard identity.
  Evidence: spec/design updates and payload helper tests.
  Reviewer Check: Confirm first-render payload is bounded and not a renamed full graph.
- [ ] Task 2: Implement server/runtime payload generation and API behavior for root-first and shard-based graph loading.
  Covers: AC-1, AC-3, AC-4
  Acceptance: Root, expansion, active-filter, and remaining graph payloads can be requested independently; full graph endpoint is not requested, parsed, or required before roots are visible, and dense mode uses remaining shards.
  Evidence: API/helper tests and response fixture checks.
  Reviewer Check: Confirm cache headers or graph-version behavior are suitable for runtime graph data.
- [ ] Task 3: Refactor `KnowledgeGraphSystem` client state for progressive cache and expansion visibility.
  Covers: AC-1, AC-2, AC-4
  Acceptance: The client tracks `nodesById`, `linksByKey`, `loadedShardKeys`, `loadingShardKeys`, `expandedNodeIds`, and `loadingExpansionNodeIds` or equivalent state.
  Evidence: component tests and source diff.
  Reviewer Check: Confirm graph visibility is driven by expansion state rather than by deleting cached data.
- [ ] Task 4: Add expand/collapse UI and local loading states for graph nodes.
  Covers: AC-2, AC-5
  Acceptance: Collapsed selected nodes expose expand; expanded selected nodes expose collapse; missing data shows local loading; Enter/Space activation, accessible expanded/loading state, and focus retention work; rest of the graph stays interactive.
  Evidence: browser or component tests and visual screenshots.
  Reviewer Check: Confirm labels are learner-facing Chinese, controls are keyboard reachable, and background loading does not steal focus.
- [ ] Task 5: Add ordered background loading for active-filter and remaining graph shards.
  Covers: AC-3, AC-4
  Acceptance: Background loading starts only after root graph is visible, does not block interactions or parse/merge on the visible critical path, skips already loaded shards, and dense mode does not use the full graph endpoint.
  Evidence: tests with request ordering and duplicate-fetch assertions.
  Reviewer Check: Confirm dense/all-relation data does not become visible until explicitly requested.
- [ ] Task 6: Preserve existing knowledge graph integrations.
  Covers: AC-5
  Acceptance: ResourceNode launch, inspector, relation filters, legend, 2D/3D mode, Konling context, keyboard/focus behavior, filtered-empty expansion, and layout stability tests remain valid or are updated to stronger equivalent checks.
  Evidence: focused regression test output and browser evidence at 1440px, 1279px, 1100px, 1024px, and 320px, including opened local tool, selected-node inspector, expanded Konling, floating dock, and expansion loading overlap checks.
  Reviewer Check: Confirm no unrelated AppShell, ResourceNode, or `konling-answer` citation relevance behavior changed.
- [ ] Task 7: Run validation and prepare review evidence.
  Covers: AC-6
  Acceptance: Focused tests, commercial UI governance checks, strict OpenSpec validation, and Buddy issue-body validation pass or documented pre-existing unrelated debt is separated.
  Evidence: command output in implementation summary.
  Reviewer Check: Confirm AC evidence is independently reviewable and not self-approved by the implementation thread.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

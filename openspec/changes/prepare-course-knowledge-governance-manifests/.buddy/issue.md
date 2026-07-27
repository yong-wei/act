---
change_id: prepare-course-knowledge-governance-manifests
claim_branch: prepare-course-knowledge-governance-manifests
series: course-knowledge-governance-manifests
coupling_group: course-knowledge-governance-manifests
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/prepare-course-knowledge-governance-manifests
risk: medium
area: knowledge-governance
---

## Goal

Track eight preparation changes that freeze the exact manifests required to propose a truthful second-stage course-knowledge rebuild series, without treating this parent as product implementation.

## Scope

- Maintain the exact eight-child inventory and declared dependency graph.
- Coordinate shared evidence from `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0045 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.
- Gate future-series creation on the discriminated record contract: `change_id`, work kind, schema/algorithm/normalization versions, typed counts/items, applicable capacity/owner fields, complete cross-block endpoints, change-ID `blockedBy`, structured per-source/upstream digests, `governance_contract_digest`, `source_snapshot_digest`, required outputs, acceptance profile, and scope-anchor evidence.

## Out of Scope

- Runtime, authoring, Prisma, database, or production implementation.
- Claiming this tracking parent for a product PR.
- Creating the second-stage parent or any content-block child before validation.

## Acceptance Checklist

- [ ] AC-1: The parent declares exactly eight executable preparation children and each new capability has one owner. Owner: independent reviewer.
  Evidence: strict OpenSpec validation and Buddy proposal-shape validation over all nine changes.
- [ ] AC-2: Parent and child metadata represent the declared acyclic dependency graph, including the two parallel branches after inventory. Owner: independent reviewer.
  Evidence: issue frontmatter, proposal-review manifests, and dependency comparison.
- [ ] AC-3: Second-stage change creation remains blocked until the complete discriminated future-child schema, typed-item closure, layered digests, field applicability, and dependency closure validate without placeholders or waivers. Owner: independent reviewer.
  Evidence: parent/child specs, final validation child contract, and repository check confirming no second-stage changes exist.

## Tasks

- [ ] Task 1: Track the eight preparation children and exclusive capability ownership.
  Covers: AC-1
  Acceptance: All children listed in proposal review exist, are independently executable, and own one distinct capability.
  Evidence: child proposals/spec paths, strict validation, and proposal-shape output.
  Reviewer Check: Confirm the parent owns tracking semantics only and no child capability is duplicated.
- [ ] Task 2: Track the dependency graph from inventory through final validation.
  Covers: AC-2
  Acceptance: Every child `depends_on`/`blocked_by` entry matches the declared graph and the graph is acyclic.
  Evidence: validated issue metadata and dependency comparison.
  Reviewer Check: Confirm identity and vocabulary can proceed independently after inventory and every downstream blocker is complete.
- [ ] Task 3: Enforce the exact-manifest gate before any second-stage propose operation.
  Covers: AC-3
  Acceptance: Every work kind satisfies its applicable owner/endpoint fields, typed-item counts, source/dependency closure, required outputs, acceptance profile, and scope anchors, with no wildcard, placeholder, provisional count, or waiver path.
  Evidence: strict specs, final validator fixtures, and absence of second-stage OpenSpec directories.
  Reviewer Check: Confirm this parent cannot be used as product implementation or as authority to pre-enumerate content-block children.

## Agent Guardrails

- Only execute this issue's change.
- Treat this issue as tracking-only and do not claim it for product implementation.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Do not create GitHub state or second-stage OpenSpec changes from this preparation parent.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
## ADR 0045 Boundary

Historical facts/events and learner-derived state stay on their original revisions and do not enter readiness. Full-history decoder and full-root writer closure are out of scope. The existing dependency frontmatter is unchanged.

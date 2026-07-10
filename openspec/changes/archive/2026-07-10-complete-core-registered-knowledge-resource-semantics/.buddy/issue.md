---
change_id: complete-core-registered-knowledge-resource-semantics
claim_branch: complete-core-registered-knowledge-resource-semantics
series: resource-semantic-completion-closure
coupling_group: resource-semantic-data
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-core-registered-knowledge-resource-semantics
risk: medium
area: resource-governance
---

## Goal

Complete reviewed semantic metadata for remaining registered resources, knowledge cards, and knowledge infographs so they can be safely used by path planning, Konling, and citation flows.

## Scope

- Process only `registered-resource`, `knowledge-card`, and `knowledge-infograph` workqueue items.
- Review every in-scope item against source content, graph context, LearningGoal K/A/Q objectives, path role, citation target, evidence behavior, privacy policy, and source/version state.
- Classify every item as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.
- Preserve before/after helper evidence.

## Out of Scope

- Runtime lesson steps, modules, media, handouts, textbook/reference rows, and assessment items.
- Changing planner filtering logic.
- Bulk script-generated semantic completion.

## Acceptance Checklist

- [ ] AC-1: The scoped workqueue includes only remaining registered-resource, knowledge-card, and knowledge-infograph items with starting blocker counts. Owner: independent reviewer.
  Evidence: helper workqueue output.
- [ ] AC-2: Every in-scope resource receives reviewed semantic fields or reviewed exclusion/support rationale. Owner: independent reviewer.
  Evidence: metadata diff and before/after helper output.
- [ ] AC-3: Path-plannable promotions have route, evidence, readiness, privacy, citation, and review metadata; non-path items cannot become PathNodes. Owner: independent reviewer.
  Evidence: ResourceNode audit and focused path/RAG checks.
- [ ] AC-4: The scoped queue closes with zero unexplained unreviewed items or only concrete missing-source blockers. Owner: independent reviewer.
  Evidence: final helper summary.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-core-registered-knowledge-resource-semantics --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Generate and freeze the scoped workqueue.
  Covers: AC-1
  Acceptance: Queue is deterministic and limited to the three in-scope families.
  Evidence: Helper output path and summary.
  Reviewer Check: Confirm no unrelated family is included.
- [ ] Task 2: Review each resource item by item.
  Covers: AC-2
  Acceptance: Each item has reviewed disposition, K/A/Q or graph rationale, path profile where applicable, citation, evidence, privacy, source/version, and review metadata.
  Evidence: Metadata diff and helper before/after output.
  Reviewer Check: Confirm fields reflect source meaning rather than script guesses.
- [ ] Task 3: Validate path and citation eligibility.
  Covers: AC-3
  Acceptance: Promoted items are executable and governed; support-only items remain non-path.
  Evidence: ResourceNode audit and focused tests.
  Reviewer Check: Confirm no support-only item becomes a PathNode.
- [ ] Task 4: Close the scoped queue.
  Covers: AC-4
  Acceptance: The scoped queue reports zero unexplained remaining items.
  Evidence: Final helper summary.
  Reviewer Check: Confirm semantic-review-required was handled by the implementing agent, not escalated as a human blocker.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, helper checks, and focused tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Semantic review is an implementing-agent responsibility in this issue; do not mark `needs-human` merely because semantic judgment is required.
- Use helper scripts only for workqueue selection, gap measurement, and validation. Do not use scripts to infer accepted semantic labels.
- Stop only for concrete blockers: missing scoped workqueue, unstable denominator, inaccessible source artifact, schema conflict, dependency conflict, claim conflict, or PR/branch conflict.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

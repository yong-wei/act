---
change_id: repair-resource-identity-bindings
claim_branch: repair-resource-identity-bindings
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - add-resource-completion-workqueues
parent_issue: 786
blocked_by:
  - add-resource-completion-workqueues
blocking:
  - complete-analysis-design-graph-resource-bindings
  - complete-foundation-graph-resource-bindings
  - review-runtime-lesson-planning-units
  - review-runtime-media-handout-dispositions
openspec_path: openspec/changes/repair-resource-identity-bindings
risk: high
area: resource-governance
---

## Goal

Repair source identity and teaching-resource binding blockers so downstream semantic review starts from stable resource identities.

## Scope

- Restore or generate the missing runtime lesson 1-3 JSON expected by mapped runtime lessons.
- Resolve missing and unregistered TeachingResource registryId values through existing registry contracts.
- Manually bind each TeachingResource to appropriate knowledge nodes or mark it with an explicit reviewed limitation when no binding is valid.

## Out of Scope

- Do not mark resources path-eligible merely because identity is repaired.
- Do not complete unrelated resource disposition backlog.

## Acceptance Checklist

- [ ] AC-1: Runtime artifact blocker for mapped lesson 1-3 is resolved or has a reviewed explicit limitation. Owner: independent reviewer.
  Evidence: data-completeness helper output.
- [ ] AC-2: No TeachingResource remains missing registryId or referencing an unregistered registryId. Owner: independent reviewer.
  Evidence: resourceBinding helper output.
- [ ] AC-3: TeachingResource knowledge-node bindings are manually reviewed and either linked or explicitly limited. Owner: independent reviewer.
  Evidence: before/after helper workqueue and reviewer notes.

## Tasks

- [ ] Task 1: Repair runtime artifact identity.
  Covers: AC-1
  Acceptance: Mapped lesson 1-3 loads or is documented as a reviewed unavailable artifact.
  Evidence: runtime lesson audit and helper output.
  Reviewer Check: Confirm no placeholder JSON hides missing content.
- [ ] Task 2: Repair TeachingResource registry identity.
  Covers: AC-2
  Acceptance: Missing and unregistered registry ids are resolved through existing resource registry metadata.
  Evidence: resourceBinding helper output.
  Reviewer Check: Confirm ids point to real registered resources.
- [ ] Task 3: Review TeachingResource knowledge bindings.
  Covers: AC-3
  Acceptance: Every TeachingResource has a reviewed graph binding or explicit limitation.
  Evidence: workqueue diff and helper output.
  Reviewer Check: Confirm bindings are semantically justified, not string-matched only.
- [ ] Task 4: Validate OpenSpec and resource binding helpers.
  Covers: AC-1, AC-2, AC-3
  Acceptance: OpenSpec and targeted resource binding tests pass.
  Evidence: `rtk openspec validate repair-resource-identity-bindings --strict` plus helper command.
  Reviewer Check: Confirm this change does not promote path eligibility by itself.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Preserve before/after helper evidence for this batch.
- Do not auto-promote semantic fields from scripts, SAR, RAG, or model suggestions without human review.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

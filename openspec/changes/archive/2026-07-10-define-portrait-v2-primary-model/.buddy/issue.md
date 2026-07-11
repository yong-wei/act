---
change_id: define-portrait-v2-primary-model
claim_branch: define-portrait-v2-primary-model
series: portrait-v2-primary-model
coupling_group: learner-portrait-v2
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/define-portrait-v2-primary-model
risk: high
area: data-governance
---

## Goal

Promote the existing seven-dimension portrait v2 contract from graph/objective compatibility metadata to the primary learner portrait model for new learner-state and profile data.

## Scope

- Define the canonical primary portrait v2 learner-state payload.
- Preserve exactly seven portrait v2 dimensions with score, confidence, freshness, evidence, lineage, and calculation version.
- Add persistence or adapter support for primary portrait v2 writes.
- Mark legacy six-dimensional vectors as compatibility-only for migration.

## Out of Scope

- Migrating existing production rows.
- Rewriting every UI consumer.
- Changing path-planner personalization behavior.
- Implementing the long-term incremental update algorithm.

## Acceptance Checklist

- [ ] AC-1: The primary learner portrait contract exposes exactly the seven portrait v2 dimensions with score, confidence, freshness, evidence counts, lineage, and calculation version. Owner: independent reviewer.
  Evidence: focused portrait contract tests.
- [ ] AC-2: New learner portrait writes can persist and read the seven-dimensional primary payload with audit metadata. Owner: independent reviewer.
  Evidence: persistence or adapter tests.
- [ ] AC-3: Legacy six-dimensional vectors remain readable only as compatibility or migration inputs, not as authoritative new primary portrait writes. Owner: independent reviewer.
  Evidence: contract tests and implementation diff.
- [ ] AC-4: Portrait source lineage is privacy scoped for learner-facing, AI-facing, reviewer, and administrator consumers. Owner: independent reviewer.
  Evidence: lineage payload contract tests.
- [ ] AC-5: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate define-portrait-v2-primary-model --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Define the primary portrait v2 learner-state contract.
  Covers: AC-1
  Acceptance: Contract exposes exactly seven portrait v2 dimensions and required metadata.
  Evidence: Focused unit tests.
  Reviewer Check: Confirm no new primary contract still uses the six-dimensional `CompetencyVector` shape.
- [ ] Task 2: Add primary portrait v2 persistence/write support.
  Covers: AC-2
  Acceptance: New portrait v2 payloads can be stored and read with source lineage and version metadata.
  Evidence: Persistence or adapter tests.
  Reviewer Check: Confirm auditability and migration compatibility.
- [ ] Task 3: Make legacy six-dimensional vectors compatibility-only.
  Covers: AC-3
  Acceptance: Legacy vectors are read for migration/mapping only and are not written as primary portrait truth.
  Evidence: Contract tests and implementation summary.
  Reviewer Check: Confirm no silent six-dimensional primary write path remains in the changed scope.
- [ ] Task 4: Add privacy-scoped source lineage contract tests.
  Covers: AC-4
  Acceptance: Student/profile, Konling/planner, reviewer, and administrator payloads expose only authorized lineage detail.
  Evidence: Contract tests.
  Reviewer Check: Confirm raw payloads, private fixture refs, teacher-scoped refs, and migration snapshot ids are not exposed to ordinary learners.
- [ ] Task 5: Run validation and prepare review evidence.
  Covers: AC-5
  Acceptance: OpenSpec validation, issue-body validation, and focused tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not migrate production data in this issue.
- Do not adapt all UI consumers in this issue.
- Do not implement the incremental portrait update algorithm in this issue.
- Do not expose raw source payloads, private fixture refs, teacher-scoped refs, or migration-source snapshot ids to learner-facing or AI-facing consumers.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

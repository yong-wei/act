---
change_id: add-smart-lesson-preparation-workspace
claim_branch: add-smart-lesson-preparation-workspace
series: smart-lesson-preparation
coupling_group: smart-lesson-preparation
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/add-smart-lesson-preparation-workspace
risk: high
area: teacher-authoring
---

## Goal

Track the six-change smart lesson-preparation series from independent foundations through P0 classroom execution and the P1 PDF export without treating the parent as executable product work.

## Scope

- Maintain the authoritative six-child inventory and exclusive capability ownership.
- Maintain the dependency graph, including parallel course-basis and slide-runtime foundations.
- Track P0 completion after children 1–5 plus contest-wide natural-language, source-quality, source-rights, and target-user evidence; track full series completion after all six children are archived.

## Out of Scope

- Product implementation, runtime code, database migration, or UI work in the parent.
- Claiming the parent or creating a parent implementation pull request.
- Replacing child review, evidence, merge, archive, and Issue reconciliation.

## Acceptance Checklist

- [ ] AC-1: The parent declares exactly six executable children and each product capability has one child owner. Owner: independent reviewer.
  Evidence: strict parent/child OpenSpec validation and Buddy proposal-shape metadata validation.
- [ ] AC-2: Child metadata represents the declared acyclic dependency graph and permits the course-basis and slide-runtime foundations to proceed independently. Owner: independent reviewer.
  Evidence: validated Issue metadata, proposal-review manifests, and Buddy relationship checks.
- [ ] AC-3: P0 is recorded only after children 1–5 are archived and evidence proves natural-language task creation, ambiguity clarification, later-turn revision, zero unresolved goal/module gaps, three authoritative content-quality cases, demonstration-material rights, and at least two target-user usage/effect records; the parent closes only after all six children are archived. Owner: independent reviewer.
  Evidence: Buddy archived-child/relationship/PR verification plus timestamped P0 conversation and classroom record, source comparisons, rights manifest, and two target-user feedback records.

## Tasks

- [ ] Task 1: Track course-basis management as an independently executable foundation.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The child retains exclusive source-ingestion capability ownership and is archived before plan authoring is claimed.
  Evidence: Child proposal, dependency metadata, review, merge, and archive records.
  Reviewer Check: Confirm the child did not absorb plan, courseware, publication, or export scope.
- [ ] Task 2: Track lesson-plan authoring after the course-basis blocker.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The child remains blocked until course-basis archive and exclusively owns text-plan generation and approval.
  Evidence: Child blocker, review, merge, and archive records.
  Reviewer Check: Confirm the blocker and capability ownership match the parent graph.
- [ ] Task 3: Track the generated slide runtime as the second independent foundation.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The child is independently claimable and exclusively owns generated slide schema, renderer, and validators.
  Evidence: Child proposal, compatibility review, merge, and archive records.
  Reviewer Check: Confirm it has no course-basis dependency and does not implement generation workflow.
- [ ] Task 4: Track the courseware editor after both plan and runtime blockers.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The child starts only after both foundations are archived and exclusively owns generation/editing/preview behavior.
  Evidence: Child blocker, review, merge, and archive records.
  Reviewer Check: Confirm publication and export remain outside the editor child.
- [ ] Task 5: Track publication and classroom execution as the final P0 child.
  Covers: AC-1, AC-2, AC-3
  Acceptance: The child follows editor archive and supplies deterministic publication plus real classroom acceptance, including the required natural-language, ambiguity, multi-turn, source-completeness, and content-quality evidence.
  Evidence: Child review, P0 conversation/task/source evidence, merge, archive, and relationship records.
  Reviewer Check: Confirm P0 is not reported complete before this child is archived and all repository-verifiable P0 evidence is present.
- [ ] Task 6: Track the P1 PDF child and reconcile series completion.
  Covers: AC-1, AC-2, AC-3
  Acceptance: PDF starts after publication archive and parent closure occurs only after all six archives plus source-rights and two target-user feedback records reconcile.
  Evidence: PDF child review/merge/archive, rights manifest, target-user usage/effect records, and Buddy parent closeout verification.
  Reviewer Check: Confirm P1 did not block the earlier P0 claim, no child remains open, and non-code contest evidence was not inferred from code completion.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

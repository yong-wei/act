---
change_id: complete-graph-resource-semantic-coverage
claim_branch: complete-graph-resource-semantic-coverage
series: data-completeness-grounding
coupling_group: data-completeness-grounding
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - add-data-completeness-audit-helper
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/complete-graph-resource-semantic-coverage
risk: high
area: data-governance
---

## Goal

Complete graph-resource semantic coverage so existing project resources can be reliably cited by Konling and selected by path planning according to audited ResourceNode and PlanningUnit rules.

## Scope

- Use the completeness helper as the worklist.
- Complete semantic bindings for existing graph, textbook, reference, lesson, knowledge card, quiz, simulation, and registered resources.
- Distinguish citation-only resources from path-plannable resources.
- Regenerate runtime governance artifacts after completion.
- Add targeted path planning and Konling citation validation.

## Out of Scope

- Do not create Yang Fan mock learner data in this change.
- Do not promote provisional metadata to path eligibility without human review.
- Do not force all media, textbook chunks, or references to become path nodes.
- Do not change Konling chat UI behavior.

## Acceptance Checklist

- [ ] AC-1: The selected resource completion batch is driven by the completeness helper blocker report. Owner: independent reviewer.
  Evidence: before/after helper output.
- [ ] AC-2: Completed resources distinguish citation-only, path-plannable, and evidence-producing roles. Owner: independent reviewer.
  Evidence: resource governance artifacts and reviewer inspection.
- [ ] AC-3: Human-reviewed resources can become path-eligible only when required route, graph, evidence, privacy, readiness, and review fields are complete. Owner: independent reviewer.
  Evidence: ResourceNode audit output and targeted tests.
- [ ] AC-4: Path planning and Konling citation tests demonstrate governed resource use. Owner: independent reviewer.
  Evidence: targeted path planner and Konling/source-pack test output.
- [ ] AC-5: Arena official scoring and ranking boundaries remain owned by ArenaSubmission and official evaluation records. Owner: independent reviewer.
  Evidence: implementation review and targeted Arena boundary tests or fixture review.
- [ ] AC-6: GitHub blockedBy dependency relationship to `add-data-completeness-audit-helper` is created and verified after issue creation. Owner: independent reviewer.
  Evidence: Buddy/GitHub relationship verification output.
- [ ] AC-7: OpenSpec and data-completeness validation pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate complete-graph-resource-semantic-coverage --strict` and helper output.

## Tasks

- [ ] Task 1: Run the completeness helper and select the completion batch.
  Covers: AC-1
  Acceptance: The implementation identifies blocker buckets and selected records from helper output.
  Evidence: before helper summary.
  Reviewer Check: Confirm the batch is not chosen ad hoc.
- [ ] Task 2: Complete citation and graph binding fields.
  Covers: AC-2, AC-3
  Acceptance: Selected resources include source hashes, citation targets, graph refs, KAQ refs, LearningGoal refs, route targets, and review metadata where applicable.
  Evidence: diff and regenerated governance artifacts.
  Reviewer Check: Confirm semantic fields are reviewed rather than blindly generated.
- [ ] Task 3: Complete path-planning and evidence fields.
  Covers: AC-2, AC-3, AC-5
  Acceptance: Path-plannable resources have evidence contracts, instrumentation, readiness metadata, privacy policy, and launch/route targets.
  Evidence: ResourceNode audit and targeted tests.
  Reviewer Check: Confirm citation-only records are not promoted to path nodes and Arena official results are not fabricated or overwritten.
- [ ] Task 4: Validate path planning and Konling citation use.
  Covers: AC-4
  Acceptance: Tests show mixed resource path generation and clickable governed citations from graph context.
  Evidence: targeted test output.
  Reviewer Check: Confirm tests exercise real governed resource data.
- [ ] Task 5: Verify GitHub dependency relationship after issue creation.
  Covers: AC-6
  Acceptance: The issue is blocked by the helper change through GitHub native relationship metadata.
  Evidence: Buddy/GitHub relationship verification output.
  Reviewer Check: Confirm local `depends_on` and GitHub blockedBy truth agree.
- [ ] Task 6: Validate the change.
  Covers: AC-7
  Acceptance: OpenSpec validation and completeness helper checks pass.
  Evidence: validation command output.
  Reviewer Check: Confirm helper output improved for the selected batch.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

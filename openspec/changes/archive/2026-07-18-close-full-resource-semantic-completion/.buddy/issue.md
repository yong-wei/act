---
change_id: close-full-resource-semantic-completion
claim_branch: close-full-resource-semantic-completion
series: resource-semantic-completion-closure
coupling_group: resource-semantic-closure
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - align-path-planner-with-resource-center-registry
  - enforce-learning-goal-kaq-planner-boundary
  - gate-new-resource-semantic-completeness
  - complete-core-registered-knowledge-resource-semantics
  - complete-runtime-lesson-media-resource-semantics
  - complete-longform-textbook-reference-resource-semantics
  - complete-assessment-checkpoint-resource-semantics
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/close-full-resource-semantic-completion
risk: high
area: data-governance
---

## Goal

Close the full resource semantic-completion effort by proving every current project resource has reviewed disposition and all path-ready LearningGoals can use governed resources, with future resource debt blocked by gates.

## Scope

- Run full-resource helper, ResourceNode audit, LearningGoal stage coverage, all-goal path diagnostics, and resource-metadata citation addressability checks.
- Account for every discovered current resource as path-plannable, supporting-citation, embedded-asset, evidence-producing, or excluded-with-rationale.
- Repair only small residual uncovered records; large newly discovered families require a new scoped change.
- Tighten resource completeness gates after closure.

## Out of Scope

- Absorbing another unbounded semantic review batch.
- Redesigning path UI or Konling UI.
- Changing LearningGoal catalog scope beyond validation.

## Acceptance Checklist

- [ ] AC-1: Full closure diagnostics run and reconcile inventory totals across helper, ResourceNode audit, LearningGoal stage matrix, and path diagnostics. Owner: independent reviewer.
  Evidence: generated JSON/Markdown summaries.
- [ ] AC-2: Any small residual uncovered records are reviewed or given concrete blocker rationale; large new families are not hidden in closure. Owner: independent reviewer.
  Evidence: metadata diff and before/after helper output.
- [ ] AC-3: Full-resource gate reports zero unexplained disposition, semantic-review, parent-link, invalid-promotion, and exclusion-rationale blockers for current resources. Owner: independent reviewer.
  Evidence: full-resource readiness gate output.
- [ ] AC-4: Every registered path-ready LearningGoal generates meaningful governed path options or a specific reviewed blocker, with no cosmetic identical multi-path bundle accepted. Owner: independent reviewer.
  Evidence: all-goal path diagnostic output.
- [ ] AC-5: Selected and supporting resources in generated paths and path explanations resolve through reviewed citation metadata or reviewed limitation state. Owner: independent reviewer.
  Evidence: citation resolver/RAG checks.
- [ ] AC-6: Resource completeness gates fail on any future unreviewed resource debt after closure. Owner: independent reviewer.
  Evidence: gate tests and direct gate command output.
- [ ] AC-7: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate close-full-resource-semantic-completion --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Run full-resource closure diagnostics.
  Covers: AC-1
  Acceptance: Diagnostics produce a current closure snapshot and reconciled counts.
  Evidence: Generated JSON/Markdown summaries.
  Reviewer Check: Confirm no family is silently dropped.
- [ ] Task 2: Repair small residual uncovered records.
  Covers: AC-2
  Acceptance: Small residuals receive reviewed metadata or concrete blocker rationale.
  Evidence: Metadata diff and before/after helper output.
  Reviewer Check: Confirm semantic review rules are followed.
- [ ] Task 3: Verify all current resources are accounted for.
  Covers: AC-3
  Acceptance: Full-resource gate reports zero unexplained blockers for current resources.
  Evidence: Full-resource readiness gate output.
  Reviewer Check: Confirm all current resources are classified.
- [ ] Task 4: Verify all path-ready LearningGoals generate governed paths.
  Covers: AC-4
  Acceptance: Each path-ready LearningGoal produces meaningful governed options or a specific reviewed blocker.
  Evidence: All-goal path diagnostic output.
  Reviewer Check: Confirm no cosmetic identical path bundle is accepted.
- [ ] Task 5: Verify resource citation and path-rationale addressability.
  Covers: AC-5
  Acceptance: Resource metadata and path-rationale citations resolve or carry reviewed limitation state.
  Evidence: Citation resolver/RAG checks.
  Reviewer Check: Confirm citations are clickable or limitation-marked; answer-level Konling relevance is left to its dedicated change.
- [ ] Task 6: Tighten gates after closure.
  Covers: AC-6
  Acceptance: Gates fail on future unreviewed resource debt.
  Evidence: Gate tests and direct command output.
  Reviewer Check: Confirm the gate no longer permits silent resource debt.
- [ ] Task 7: Run validation and prepare review evidence.
  Covers: AC-7
  Acceptance: OpenSpec validation, issue-body validation, helper checks, all-goal diagnostics, citation checks, and typecheck pass.
  Evidence: Command output.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not absorb a large new semantic review family; create or request a scoped follow-up instead.
- Semantic review for small residuals is an implementing-agent responsibility; do not mark `needs-human` merely because semantic judgment is required.
- Use helper scripts for audit and validation, not for accepted semantic inference.
- Stop only for concrete blockers: missing dependency change, unstable denominator, inaccessible source artifact, schema conflict, dependency conflict, claim conflict, or PR/branch conflict.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

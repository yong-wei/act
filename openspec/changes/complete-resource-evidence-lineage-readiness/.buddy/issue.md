---
change_id: complete-resource-evidence-lineage-readiness
claim_branch: complete-resource-evidence-lineage-readiness
series: resource-path-readiness
coupling_group: resource-path-readiness-2026-07
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - close-resource-disposition-review-backlog
  - complete-learning-goal-assessment-baselines
  - complete-rag-citation-anchor-coverage
  - wire-adaptive-engine-to-reviewed-item-catalog
parent_issue: 786
blocked_by:
  - close-resource-disposition-review-backlog
  - complete-learning-goal-assessment-baselines
  - complete-rag-citation-anchor-coverage
  - wire-adaptive-engine-to-reviewed-item-catalog
blocking:
  - enforce-all-resource-path-readiness-gate
  - seed-yangfan-diagnostic-learning-state
openspec_path: openspec/changes/complete-resource-evidence-lineage-readiness
risk: high
area: data-governance
---

## Goal

Complete source-event lineage for all reviewed path-relevant core, long-form, and assessment/practice resources so resource execution can produce governed path, mastery, checkpoint, and personalization evidence.

## Scope

- Use the helper to isolate evidence-lineage blockers after upstream core, long-form, and assessment resource reviews are complete.
- Complete EventDictionary, clientEventId, attemptKey, source-event, LearningFact, feature-cache, and path evidenceRef contracts for path-relevant resources.
- Preserve privacy-minimized diagnostics.

## Out of Scope

- Creating Yang Fan fixture data.
- Repairing unrelated legacy logs that are not consumed by current path planning.
- Changing Arena official scoring authority.

## Acceptance Checklist

- [ ] AC-1: Helper evidence-lineage blockers for all reviewed path-relevant resources are resolved or have reviewed limitation states. Owner: independent reviewer.
  Evidence: before/after helper output with layer totals, finding counts, follow-up buckets, evidence-lineage blockers, and Yang Fan fixture blockers.
- [ ] AC-2: Evidence-producing ResourceNodes declare complete event attribution, dedupe, timestamp, LearningFact, confidence, and privacy behavior. Owner: independent reviewer.
  Evidence: ResourceNode/evidence contract tests.
- [ ] AC-3: Path execution can attach evidenceRefs for governed resource events. Owner: independent reviewer.
  Evidence: targeted path execution or materialization tests.
- [ ] AC-4: Learner fixture generation remains blocked unless evidence lineage is sufficient. Owner: independent reviewer.
  Evidence: fixture precondition test or helper output.

## Tasks

- [ ] Task 1: Audit path-relevant evidence-lineage blockers.
  Covers: AC-1
  Acceptance: Evidence-lineage gaps are grouped by path relevance and source family after core, long-form, and assessment resources are reviewed.
  Evidence: helper report.
  Reviewer Check: Confirm legacy-only gaps are not mixed with current path blockers.
- [ ] Task 2: Complete evidence contracts and instrumentation.
  Covers: AC-2, AC-3
  Acceptance: Path-relevant resource events have governed lineage and path evidenceRefs.
  Evidence: code/data changes and targeted tests.
  Reviewer Check: Confirm private raw payloads are not exposed.
- [ ] Task 3: Enforce fixture preconditions.
  Covers: AC-4
  Acceptance: Yang Fan fixture scripts cannot proceed on incomplete resource evidence lineage.
  Evidence: fixture precondition test or dry-run report.
  Reviewer Check: Confirm this issue does not create fixture data.
- [ ] Task 4: Validate OpenSpec and helper.
  Covers: AC-1, AC-2, AC-3, AC-4
  Acceptance: OpenSpec validation and targeted tests pass.
  Evidence: `rtk openspec validate complete-resource-evidence-lineage-readiness --strict`.
  Reviewer Check: Confirm downstream issue dependencies remain accurate.

## Agent Guardrails

- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Preserve before/after helper evidence for this batch.
- Do not bulk-promote semantic fields from scripts, SAR, RAG, or model suggestions. Helpers may generate workqueues, candidate relations, evidence snippets, and audits, but the implementing agent must perform item-by-item semantic review against source content and write per-record rationale before applying any semantic field.
- Do not mark the issue `needs-human` merely because semantic review is required; split the work into bounded batches and leave unreviewed records in the workqueue if the full queue cannot be completed in one run.
- Start by running the helper and preserve before/after output.
- Complete semantic and evidence fields through implementing-agent item-by-item review against source content where interpretation is required, with per-record rationale.
- Do not use scripts to infer final knowledge, capability, or LearningGoal mappings.
- Preserve Arena official scoring and ranking authority.
- Do not execute other planned OpenSpec changes.

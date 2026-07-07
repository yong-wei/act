---
change_id: seed-yangfan-diagnostic-learning-state
claim_branch: seed-yangfan-diagnostic-learning-state
series: data-completeness-grounding
coupling_group: data-completeness-grounding
execution_mode: stacked
base_branch: integration
required_branch:
depends_on:
  - enforce-all-resource-path-readiness-gate
  - complete-resource-evidence-lineage-readiness
  - wire-adaptive-engine-to-reviewed-item-catalog
parent_issue: 774
blocked_by:
  - enforce-all-resource-path-readiness-gate
  - complete-resource-evidence-lineage-readiness
  - wire-adaptive-engine-to-reviewed-item-catalog
blocking: []
openspec_path: openspec/changes/seed-yangfan-diagnostic-learning-state
risk: medium
area: data-governance
---

## Goal

Create a deterministic Yang Fan diagnostic learner-state fixture after graph/resource data is complete, so graph, path planning, Konling, and adaptive answering can be tested against realistic governed evidence.

## Scope

- Gate fixture generation on data-completeness helper output.
- Resolve the canonical Yang Fan account and safely remove or migrate the duplicate no-email account.
- Materialize LearningFacts, KnowledgeProgress, path execution evidenceRefs, adaptive assessment state, snapshots, profile summary, and feature cache data.
- Add dry-run/apply/reset behavior and targeted tests.

## Out of Scope

- Do not run before resource and graph data completion passes.
- Do not mutate production data implicitly at application startup.
- Do not generate learner evidence without traceable fixture provenance.
- Do not create resources or citations in this change.

## Acceptance Checklist

- [ ] AC-1: Fixture apply mode is blocked when data completeness prerequisites fail. Owner: independent reviewer.
  Evidence: dry-run/apply precondition test output.
- [ ] AC-2: Fixture writes are production-protected, default to dry-run, require explicit apply, and enforce database allowlist/denylist checks. Owner: independent reviewer.
  Evidence: safety tests and command output.
- [ ] AC-3: The canonical Yang Fan account is resolved and duplicate account handling is safe and idempotent. Owner: independent reviewer.
  Evidence: fixture command output and duplicate-account tests.
- [ ] AC-4: The canonical account receives traceable governed learner-state records sufficient for graph, path, Konling, and adaptive-answering tests. Owner: independent reviewer.
  Evidence: database fixture output and targeted learner-state tests.
- [ ] AC-5: Repeated fixture runs are stable and do not duplicate records. Owner: independent reviewer.
  Evidence: idempotency test output.
- [ ] AC-6: Fixture output is privacy-minimized, diagnostic-only, marked synthetic/fixture-scoped, and excluded from ordinary learner ranking/dashboard metrics unless diagnostic fixture mode is explicitly active; Arena official scoring/ranking boundaries are preserved. Owner: independent reviewer.
  Evidence: privacy tests and Arena boundary review.
- [ ] AC-7: GitHub blockedBy relationships to upstream completeness changes are created and verified after issue creation. Owner: independent reviewer.
  Evidence: Buddy/GitHub relationship verification output.
- [ ] AC-8: OpenSpec and targeted fixture tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate seed-yangfan-diagnostic-learning-state --strict` and targeted tests.

## Tasks

- [ ] Task 1: Add fixture precondition checks.
  Covers: AC-1, AC-2
  Acceptance: Apply mode refuses to run if graph/resource/citation/path completeness blockers remain, if environment is production-like, if DB safety checks fail, or if explicit apply confirmation is missing.
  Evidence: precondition tests.
  Reviewer Check: Confirm mock learner data cannot be generated against incomplete resource data or unsafe database targets.
- [ ] Task 2: Resolve canonical and duplicate Yang Fan accounts.
  Covers: AC-3
  Acceptance: Canonical account is resolved by stable email/student number and duplicate deletion or migration is explicit, safe, and idempotent.
  Evidence: command output and tests.
  Reviewer Check: Confirm unsafe duplicate records block deletion.
- [ ] Task 3: Materialize Yang Fan learning evidence.
  Covers: AC-4, AC-6
  Acceptance: LearningFacts, KnowledgeProgress, path execution evidenceRefs, adaptive assessment state, snapshots, summaries, and feature cache records are created with traceable fixture provenance.
  Evidence: database output and tests.
  Reviewer Check: Confirm records are derived from governed sources or explicit fixture provenance, carry stable dedupe keys and fixture scope, are excluded from ordinary production learner truth, and Arena official results are not fabricated or overwritten.
- [ ] Task 4: Add reset and idempotency behavior.
  Covers: AC-5, AC-6
  Acceptance: Repeated reset/apply cycles produce stable counts and no duplicate facts, progress, snapshots, or path evidence.
  Evidence: idempotency tests.
  Reviewer Check: Confirm stable dedupe keys are used and output avoids raw PII/content.
- [ ] Task 5: Validate graph, path, Konling, and adaptive-answering scenarios.
  Covers: AC-4, AC-8
  Acceptance: Targeted tests demonstrate fixture data supports the intended product flows.
  Evidence: targeted test output.
  Reviewer Check: Confirm tests use the canonical account and governed resource citations.
- [ ] Task 6: Verify GitHub dependency relationships after issue creation.
  Covers: AC-7
  Acceptance: The issue is blocked by all upstream changes listed in depends_on through GitHub native relationship metadata.
  Evidence: Buddy/GitHub relationship verification output.
  Reviewer Check: Confirm local `depends_on` and GitHub blockedBy truth agree.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

---
change_id: gate-new-resource-semantic-completeness
claim_branch: gate-new-resource-semantic-completeness
series: resource-semantic-completion-closure
coupling_group: resource-data-governance
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue: 876
blocked_by: []
blocking: []
openspec_path: openspec/changes/gate-new-resource-semantic-completeness
risk: medium
area: data-governance
---

## Goal

Prevent newly added or modified registered resources from entering the repository with incomplete reviewed semantic metadata while the historical backlog is being closed in batches.

## Scope

- Add a new/modified resource completeness gate.
- Fail new resource additions that lack reviewed disposition, K/A/Q and graph bindings, path profile, evidence policy, citation metadata, review metadata, or exclusion rationale required by their declared role.
- Wire the gate into worktree hook setup and expose a direct command for future CI.
- Preserve a reviewed baseline exception for unchanged historical backlog.

## Out of Scope

- Completing existing historical resources.
- Enforcing all-resource zero backlog; that belongs to the final closure change.
- Changing GitHub Actions quota or enabling remote CI.

## Acceptance Checklist

- [ ] AC-1: The gate detects newly added or modified registered resources and runtime projections relative to the configured baseline. Owner: independent reviewer.
  Evidence: focused data-governance tests.
- [ ] AC-2: Incomplete new resources fail, while complete path-plannable, supporting-citation, embedded-asset, evidence-producing, and excluded-with-rationale records pass only with reviewed metadata. Owner: independent reviewer.
  Evidence: fail/pass fixture tests.
- [ ] AC-3: Worktree sync or hook setup installs the local commit-time gate, and a direct command exists for future CI. Owner: independent reviewer.
  Evidence: hook setup smoke test or script test.
- [ ] AC-4: OpenSpec and Buddy contracts remain valid. Owner: independent reviewer.
  Evidence: `rtk openspec validate gate-new-resource-semantic-completeness --strict` and issue-body validation pass.

## Tasks

- [ ] Task 1: Add new/modified resource completeness detection.
  Covers: AC-1
  Acceptance: The gate identifies new or changed resource records and runtime projections relative to base branch or baseline.
  Evidence: Data-governance unit tests.
  Reviewer Check: Confirm unchanged historical gaps are not counted as newly introduced debt.
- [ ] Task 2: Enforce reviewed semantic completeness.
  Covers: AC-2
  Acceptance: New resources fail unless their declared role has reviewed semantic fields and rationale.
  Evidence: Fixture tests for incomplete and complete records.
  Reviewer Check: Confirm generated suggestions and placeholder reviewers do not satisfy review.
- [ ] Task 3: Wire the gate into local hook setup.
  Covers: AC-3
  Acceptance: Worktree sync installs or updates the local hook, and a direct command runs the same check.
  Evidence: Hook setup or script smoke test.
  Reviewer Check: Confirm the workflow is usable in isolated worktrees.
- [ ] Task 4: Run validation and prepare review evidence.
  Covers: AC-4
  Acceptance: OpenSpec validation, issue-body validation, and targeted tests pass.
  Evidence: Command output in implementation summary.
  Reviewer Check: Confirm all AC ids have evidence and no AC is self-approved.

## Agent Guardrails

- Only execute this issue's change.
- Do not complete historical resource fields in this issue.
- Do not satisfy semantic review with generated labels, placeholder reviewers, or bulk script inference.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.

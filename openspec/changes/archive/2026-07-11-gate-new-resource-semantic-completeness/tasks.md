## Tasks

- [x] Task 1: Add new/modified resource completeness detection.
  Covers: AC-1
  Acceptance: The gate detects newly added or modified registered resource records and runtime projections relative to the base branch or baseline.
  Evidence: Data-governance unit tests.
  Reviewer Check: Confirm existing backlog does not mask new incomplete records.

- [x] Task 2: Enforce reviewed semantic completeness for new resources.
  Covers: AC-1, AC-2
  Acceptance: New path-plannable resources require reviewed K/A/Q, graph, path profile, route, evidence, privacy, citation, and review metadata; non-path resources require reviewed disposition and rationale.
  Evidence: Fixture tests for fail/pass cases.
  Reviewer Check: Confirm generated suggestions or placeholder reviewers do not satisfy the gate.

- [x] Task 3: Wire the gate into local hook setup and future CI command.
  Covers: AC-3
  Acceptance: Worktree sync installs the hook, and a direct npm/script command can run the same gate without GitHub Actions.
  Evidence: Hook setup test or script smoke test.
  Reviewer Check: Confirm the gate is documented for other worktrees.

- [x] Task 4: Validate OpenSpec, issue body, and targeted tests.
  Covers: AC-4
  Acceptance: OpenSpec validation, issue-body validation, and targeted data-governance tests pass.
  Evidence: Command output.
  Reviewer Check: Confirm all evidence maps to AC ids.

## Validation

- [x] Run `rtk openspec validate gate-new-resource-semantic-completeness --strict`.
- [x] Run targeted data-governance tests for the new-resource gate.
- [x] Run issue-body validation before GitHub issue creation.

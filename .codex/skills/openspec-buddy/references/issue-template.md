# OpenSpec Buddy Issue Template

Use this template when running `openspec-buddy propose`.

```markdown
---
change_id: example-change-id
claim_branch: example-change-id
series: arena-workbench
coupling_group: workbench-context-chain
execution_mode: isolated
base_branch: main
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/example-change-id
risk: medium
area: arena
---

## Goal

Describe the user-visible or engineering outcome.

## Scope

- List the implementation boundaries.
- Keep the scope tied to this single change.

## Out of Scope

- List adjacent changes that must not be implemented here.

## Acceptance Criteria

- [ ] Criteria are observable and testable.
- [ ] Validation commands or manual checks are named.

## Agent Guardrails

- Only execute this issue's change.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
```

Labels to apply:

```text
status:ready
area:<area>
series:<series>
risk:<low|medium|high>
mode:<isolated|fixed-branch|stacked|docs-only>
```

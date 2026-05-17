---
name: openspec-buddy
description: Use when the user explicitly invokes openspec-buddy propose, openspec-buddy apply, or openspec-buddy achieve for OpenSpec changes coordinated through GitHub Issues across branches, agents, or worktrees.
compatibility: Requires openspec CLI and GitHub CLI.
---

# OpenSpec Buddy

OpenSpec Buddy is the coordination layer for GitHub-tracked OpenSpec work.
GitHub Issues are the cross-worktree task record. OpenSpec remains the local specification and execution package.

Use this skill only when the user explicitly asks for `openspec-buddy propose`, `openspec-buddy apply`, `openspec-buddy achieve`, or asks to coordinate OpenSpec changes through GitHub Issues.

## Core Rule

One coordinated change maps to:

```text
one GitHub Issue = one change_id = one claim branch = one OpenSpec change = one PR
```

The issue front matter must include `claim_branch`, and `claim_branch` must equal `change_id`.

## Modes

### propose

Use when the user wants to register a new OpenSpec change in GitHub before implementation.

Steps:

1. Derive or confirm a kebab-case `change_id`.
2. Prepare an issue body from `references/issue-template.md`.
3. Set `claim_branch: <change_id>`.
4. Add labels:
   - `status:ready`
   - `area:<area>`
   - `series:<series>`
   - `risk:<low|medium|high>`
   - `mode:<isolated|fixed-branch|stacked|docs-only>`
5. Create the issue with `gh issue create`.
6. Add the created issue to the default GitHub Project:
   ```bash
   .codex/skills/openspec-buddy/scripts/add-issue-to-project.sh <issue-url>
   ```
7. If the user also asked to create local OpenSpec artifacts, invoke `openspec-propose` after issue creation.

Do not claim the issue or implement in `propose`.

### apply

Use when the user wants to implement a GitHub-tracked OpenSpec change.

Steps:

1. Locate the issue by number, URL, or `change_id`.
2. Read the issue body and labels.
3. Validate metadata:
   ```bash
   .codex/skills/openspec-buddy/scripts/parse-issue-metadata.mjs <issue-body-file>
   ```
4. Verify:
   - issue has `status:ready`
   - dependencies are `Merged` or `Archived`
   - no open issue in the same `coupling_group` has `status:claimed` or `status:in-progress`
   - `claim_branch` equals `change_id`
   - execution mode and branch constraints are satisfiable
5. Claim the issue:
   ```bash
   .codex/skills/openspec-buddy/scripts/claim-change.sh <issue-number>
   ```
6. Re-read the issue and confirm the claim.
7. Use branch `<change_id>` for the implementation. For isolated work, create it from `base_branch`. For fixed-branch work, stop if the required branch is not the same as the declared claim branch.
8. After entering the claim branch, mark the issue in progress:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-in-progress.sh <issue-number>
   ```
9. Invoke `openspec-apply-change` for the matching local OpenSpec change.
10. After opening a PR, mark the issue in review:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-review.sh <issue-number> <pr-url>
   ```

If claim verification fails, stop before editing files.

### achieve

Use after the PR for a GitHub-tracked OpenSpec change has been merged and the user wants to finish the change record.

Steps:

1. Confirm the PR is merged.
2. Confirm the target branch contains the merge.
3. Invoke `openspec-archive-change` for the matching change.
4. Commit and push the OpenSpec archive update when requested by the user or by the current workflow.
5. Mark the issue archived:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-achieved.sh <issue-number> <archive-path> [pr-url]
   ```
6. Report dependent blocked issues, if any.

`achieve` means the GitHub issue, PR, and OpenSpec archive all agree that the change is complete.

## Required References

Read only the reference needed for the current mode:

- `references/issue-template.md`: body template for `propose`
- `references/metadata-schema.md`: field definitions and validation rules
- `references/project-coordination.md`: default GitHub Project target for `propose`
- `references/status-flow.md`: labels and transitions

## Guardrails

- Do not implement unclaimed GitHub-tracked changes.
- Do not execute adjacent OpenSpec changes found in the worktree.
- Do not treat GitHub Projects as the agent execution source of truth; use issue front matter, labels, assignee, and comments.
- Do not use a branch whose name differs from `change_id` unless the user explicitly cancels OpenSpec Buddy coordination for this change.
- Do not continue after a failed claim or unresolved coupling conflict.
- GitHub is the task-state source of truth; Git is still the code source of truth.

## Output

For `propose`, report the issue URL, `change_id`, labels, and OpenSpec path.
Also report the GitHub Project item id or state that the issue was already present in the Project.

For `apply`, report the issue, claim branch, dependency status, coupling-group result, and the OpenSpec change being applied.

For `achieve`, report the PR, merge state, archive path, final labels, and any follow-up issues that were unblocked.

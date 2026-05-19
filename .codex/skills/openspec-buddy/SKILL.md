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

## Execution Retrospective Requirement

After every `propose`, `apply`, or `achieve` run, include a brief execution retrospective in the final report.
The retrospective must state:

- what worked in the Buddy workflow
- what was confusing, fragile, manual, or missing
- whether any reusable rule should be added to `openspec-buddy`, `openspec-buddy-auto`, or their references

If the run reveals a reusable workflow gap and the user asks to persist it, update the relevant skill file in the same branch before closing the task.

## Modes

### propose

Use when the user wants to register a new OpenSpec change in GitHub before implementation.

Steps:

1. Derive or confirm a kebab-case `change_id`.
2. Prepare an issue body from `references/issue-template.md`.
3. In issue front matter, keep empty list fields as `[]`, but write every
   non-empty `depends_on`, `blocked_by`, or `blocking` field as a YAML block
   list. Do not use inline lists such as `[other-change]`; the metadata parser
   rejects those so dependency metadata cannot be misread.
4. Set `claim_branch: <change_id>`.
5. Set `base_branch: integration`. Do not create new Buddy issues with
   `base_branch: main`; release from `integration` to `main` is manual.
6. Validate the prepared body before creating or updating the issue:
   ```bash
   .codex/skills/openspec-buddy/scripts/parse-issue-metadata.mjs <issue-body-file>
   ```
7. Add labels:
   - `status:ready`
   - `area:<area>`
   - `series:<series>`
   - `risk:<low|medium|high>`
   - `mode:<isolated|fixed-branch|stacked|docs-only>`
8. Create the issue with `gh issue create`.
9. If this is a planned series, create or identify the series parent issue, then link the child issue:
   ```bash
   .codex/skills/openspec-buddy/scripts/create-series-parent.sh <series>
   .codex/skills/openspec-buddy/scripts/link-issue-parent.sh <parent-issue> <child-issue>
   ```
10. If this issue depends on another change issue, link the native relationship:
   ```bash
   .codex/skills/openspec-buddy/scripts/link-issue-dependencies.sh <blocked-issue> <blocking-issue>
   ```
11. Add the created issue to the default GitHub Project:
   ```bash
   .codex/skills/openspec-buddy/scripts/add-issue-to-project.sh <issue-url>
   ```
   The script also sets the Project `Status` to `Todo`.
12. If the user also asked to create local OpenSpec artifacts, invoke `openspec-propose` after issue creation.

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
   - issue is not labeled `type:series-parent`
   - native `blockedBy` has no open, unarchived issue
   - front matter `depends_on` entries are not active unfinished changes
   - no open issue in the same `coupling_group` has `status:claimed` or `status:in-progress`
   - `claim_branch` equals `change_id`
   - `base_branch` equals `integration`
   - execution mode and branch constraints are satisfiable
5. Claim the issue with a remote branch lock:
   ```bash
   .codex/skills/openspec-buddy/scripts/claim-change.sh <issue-number>
   ```
   The claim creates `origin/<change_id>` from the declared `base_branch`, writes a structured claim comment, and sets a lease.
   It also mirrors the issue status to the Project `Status` field and sets Project `Start` to the current date.
6. Re-read the issue and confirm the claim id, assignee, status label, and branch lock.
7. Use branch `<change_id>` for the implementation. For isolated work, create it from `base_branch`. For fixed-branch work, stop if the required branch is not the same as the declared claim branch.
8. After entering the claim branch, mark the issue in progress:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-in-progress.sh <issue-number>
   ```
   This must leave the Project `Status` as `In Progress`.
9. Invoke `openspec-apply-change` for the matching local OpenSpec change.
10. Open a ready PR against `integration`, never a draft PR. The PR body must
    not use closing keywords such as `Closes`, `Fixes`, or `Resolves` for the
    Buddy issue, because the issue must stay open until OpenSpec archive.
11. After opening the ready PR, configure PR metadata before review:
   ```bash
   .codex/skills/openspec-buddy/scripts/configure-pr-metadata.sh <issue-number> <pr-url>
   ```
   This must add PR-scoped labels such as `pr:openspec-buddy` and
   `pr:base-integration`, copy the issue's `area:*`, `series:*`, and `risk:*`
   labels to the PR, add the PR to the same Project as the issue, set the PR
   Project `Status` to `In Progress`, and add a non-closing origin issue
   reference to the PR body for Development traceability.
12. Mark the issue in review:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-review.sh <issue-number> <pr-url>
   ```
   This first verifies the PR targets `integration`. If the PR targets `main`,
   the script attempts to retarget it to `integration`; if retargeting fails,
   stop before review/merge. The script also rejects draft PRs and runs the PR
   metadata configuration helper. This must leave the issue Project `Status` as
   `In Progress`.

If claim verification fails, stop before editing files.

### achieve / archive

Use after the PR for a GitHub-tracked OpenSpec change has been merged and the user wants to finish the change record. Treat `archive` as an alias for `achieve`.

Steps:

1. Confirm the PR is merged.
2. Confirm the target branch `integration` contains the merge.
3. Confirm local OpenSpec tasks are complete:
   ```bash
   openspec instructions apply --change <change_id> --json
   ```
   The progress must show `remaining: 0`. If tasks are still unchecked but the
   implementation already satisfies them, finish `tasks.md` and include that
   state before archiving. Do not let a closed issue and an incomplete local
   task checklist diverge.
4. Invoke `openspec-archive-change` for the matching change.
5. Commit and push the OpenSpec archive update when requested by the user or by the current workflow.
6. Mark the issue archived:
   ```bash
   .codex/skills/openspec-buddy/scripts/mark-achieved.sh <issue-number> <archive-path> [pr-url]
   ```
   This must leave the Project `Status` as `Done`, set Project `End` to the current date, and close the issue if it is still open.
   The script also checks the linked series parent and closes it when all child changes are already archived.
7. Report dependent blocked issues and any finalized series parent issue, if any.

`achieve` means the GitHub issue, PR, and OpenSpec archive all agree that the change is complete.

## Required References

Read only the reference needed for the current mode:

- `references/issue-template.md`: body template for `propose`
- `references/claim-locking.md`: branch lock, claim lease, and stale-claim rules for `apply`
- `references/metadata-schema.md`: field definitions and validation rules
- `references/issue-relationships.md`: parent issue, blocked-by, blocking, and Project date rules
- `references/project-coordination.md`: default GitHub Project target and status sync
- `references/status-flow.md`: labels and transitions

## Guardrails

- Do not implement unclaimed GitHub-tracked changes.
- Do not execute adjacent OpenSpec changes found in the worktree.
- Do not claim `type:series-parent` issues.
- Do not claim an issue while GitHub `blockedBy` contains any open, unarchived issue.
- Do not treat GitHub Projects as the agent execution source of truth; use issue front matter, labels, assignee, and comments.
- Do not update `status:*` labels without the Buddy wrapper scripts; Project `Status` must stay synchronized for human-visible coordination.
- Do not open, review, or merge Buddy PRs against `main`. Retarget them to `integration` or stop.
- Do not create or submit draft PRs for Buddy changes; PRs must be ready for review when they are handed to the review loop.
- Do not leave Buddy PRs without PR-scoped labels, copied area/series/risk labels, the same Project as the originating issue, and a non-closing origin issue reference.
- Do not use closing keywords to link Buddy PRs to issues; issue closure is reserved for the archive step.
- Do not use a branch whose name differs from `change_id` unless the user explicitly cancels OpenSpec Buddy coordination for this change.
- Do not bypass the remote branch lock in `claim-change.sh`; label changes alone are not a reliable lock.
- Do not reclaim `status:claimed` or `status:in-progress` work unless the lease is stale and the branch/PR recovery checks prove it is safe.
- Do not continue after a failed claim or unresolved coupling conflict.
- GitHub is the task-state source of truth; Git is still the code source of truth.

## Output

For `propose`, report the issue URL, `change_id`, labels, OpenSpec path, parent issue link, and dependency relationship links.
Also report the GitHub Project item id or state that the issue was already present in the Project, plus the Project `Status`.

For `apply`, report the issue, claim branch, blockedBy status, downstream blocking count when known, coupling-group result, Project `Start`, PR metadata labels, PR Project membership, and the OpenSpec change being applied.

For `achieve`, report the PR, merge state, archive path, Project `End`, final labels, issue close state, any finalized series parent issue, and any follow-up issues that were unblocked.

For every mode, include the execution retrospective required above.

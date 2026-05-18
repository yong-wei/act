# OpenSpec Buddy Project Coordination

`openspec-buddy propose` must add each newly created issue to the coordination Project.

## Default Project

| Field | Value |
| --- | --- |
| Owner | `yong-wei` |
| Number | `1` |
| Title | `ACT Openspec LTE` |
| URL | `https://github.com/users/yong-wei/projects/1` |

The Project is the human-visible coordination board. Labels and issue front matter remain the agent execution source of truth, but every issue status transition must also mirror to the Project `Status` field.

## PR Coordination

Every Buddy implementation PR must be coordinated with the same Project and
labels as its originating issue before the review wait starts.

After creating a ready PR against `integration`, run:

```bash
.codex/skills/openspec-buddy/scripts/configure-pr-metadata.sh <issue-number> <pr-number-or-url>
```

The helper must:

- add `pr:openspec-buddy`
- add `pr:base-<base-branch>`, normally `pr:base-integration`
- copy the issue's `area:*`, `series:*`, and `risk:*` labels to the PR
- add the PR to the same Project as the issue
- set the PR Project `Status` to `In Progress`
- add a non-closing origin issue reference to the PR body

Do not copy `status:*` labels to PRs. Issue status remains the Buddy execution
state, while `pr:*` labels describe PR-specific review metadata.

Do not use closing keywords such as `Closes`, `Fixes`, or `Resolves` to link a
Buddy PR to its issue. Those keywords can close the issue before OpenSpec
archive. Use the helper's non-closing origin reference and the issue comment
created by `mark-review.sh` for traceability. If the GitHub UI requires a
manual Development sidebar link, record that as a manual follow-up rather than
using an unsafe closing keyword.

## Command

After creating the issue, run:

```bash
.codex/skills/openspec-buddy/scripts/add-issue-to-project.sh <issue-url>
```

The script is idempotent: if the issue is already present in the Project, it reports the existing item id and does not add a duplicate.
It also sets the Project `Status` to `Todo` for a newly registered `status:ready` issue.

## Status Sync

Whenever an issue `status:*` label changes, run:

```bash
.codex/skills/openspec-buddy/scripts/set-status-label.sh <issue-number> <status:label>
```

Do not edit status labels directly with `gh issue edit`; the wrapper also updates the Project `Status`.

Project status mapping:

| Issue label | Project `Status` |
| --- | --- |
| `status:backlog`, `status:ready`, `status:blocked`, `status:tracking`, `status:stale-claim`, `status:needs-human`, `status:failed` | `Todo` |
| `status:claimed`, `status:in-progress`, `status:in-review` | `In Progress` |
| `status:merged`, `status:archived` | `Done` |

`status:archived` is the normal completed-change state. It must leave the issue label and the Project `Status` both showing completion. Series parent issues start as `status:tracking`, but once all child changes are closed with `status:archived`, the parent must also move to `status:archived`, Project `Status: Done`, and Project `End` set.

## Overrides

Use these environment variables only when the user explicitly names another Project:

```bash
OPENSPEC_BUDDY_PROJECT_OWNER=<owner>
OPENSPEC_BUDDY_PROJECT_NUMBER=<number>
OPENSPEC_BUDDY_PROJECT_TITLE=<title>
```

## Date Fields

The default Project has `Start` and `End` date fields.

- `claim-change.sh` sets `Start` to the local date after the branch lock, assignee, label, and claim comment are confirmed.
- `mark-achieved.sh` sets `End` to the local date after `status:archived` is recorded.
- `close-completed-series-parent.sh` sets parent `End` when the last child change in a series is archived.

For manual repair, use:

```bash
.codex/skills/openspec-buddy/scripts/set-project-date.sh <issue> Start YYYY-MM-DD
.codex/skills/openspec-buddy/scripts/set-project-date.sh <issue> End YYYY-MM-DD
```

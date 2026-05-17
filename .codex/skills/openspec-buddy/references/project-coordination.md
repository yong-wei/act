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
| `status:backlog`, `status:ready`, `status:blocked`, `status:stale-claim`, `status:needs-human`, `status:failed` | `Todo` |
| `status:claimed`, `status:in-progress`, `status:in-review` | `In Progress` |
| `status:merged`, `status:archived` | `Done` |

`status:archived` is the normal completed-change state. It must leave the issue label and the Project `Status` both showing completion.

## Overrides

Use these environment variables only when the user explicitly names another Project:

```bash
OPENSPEC_BUDDY_PROJECT_OWNER=<owner>
OPENSPEC_BUDDY_PROJECT_NUMBER=<number>
OPENSPEC_BUDDY_PROJECT_TITLE=<title>
```

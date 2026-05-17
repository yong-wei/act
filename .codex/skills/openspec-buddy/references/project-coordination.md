# OpenSpec Buddy Project Coordination

`openspec-buddy propose` must add each newly created issue to the coordination Project.

## Default Project

| Field | Value |
| --- | --- |
| Owner | `yong-wei` |
| Number | `1` |
| Title | `ACT Openspec LTE` |
| URL | `https://github.com/users/yong-wei/projects/1` |

The Project is the human-visible coordination board. Labels and issue front matter remain the agent execution source of truth.

## Command

After creating the issue, run:

```bash
.codex/skills/openspec-buddy/scripts/add-issue-to-project.sh <issue-url>
```

The script is idempotent: if the issue is already present in the Project, it reports the existing item id and does not add a duplicate.

## Overrides

Use these environment variables only when the user explicitly names another Project:

```bash
OPENSPEC_BUDDY_PROJECT_OWNER=<owner>
OPENSPEC_BUDDY_PROJECT_NUMBER=<number>
OPENSPEC_BUDDY_PROJECT_TITLE=<title>
```

# OpenSpec Buddy Status Flow

Use labels as the agent-facing state record.

## Status Labels

```text
status:backlog
status:ready
status:claimed
status:in-progress
status:in-review
status:merged
status:archived
status:blocked
```

Only one `status:*` label should be present on an issue.

## Normal Flow

```text
Backlog -> Ready -> Claimed -> In Progress -> In Review -> Merged -> Archived
```

`Blocked` can be entered from `Backlog` or `Ready` when dependencies, branch constraints, or coupling-group constraints prevent execution.

## Agent Actions

| Action | From | To | Required proof |
| --- | --- | --- |
| propose | none/backlog | ready | issue front matter and labels created |
| claim | ready | claimed | assignee and claim comment confirmed |
| start work | claimed | in-progress | branch exists and OpenSpec change is selected |
| open PR | in-progress | in-review | PR URL comment |
| merge PR | in-review | merged | PR merge commit |
| archive | merged | archived | OpenSpec archive path |

## Coupling Rule

Before claiming an issue, check open issues in the same `coupling_group`.

Stop if any issue other than the current one has:

```text
status:claimed
status:in-progress
```

This rule prevents two worktrees from executing strongly coupled changes at the same time.

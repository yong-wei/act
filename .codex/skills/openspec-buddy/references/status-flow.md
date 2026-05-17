# OpenSpec Buddy Status Flow

Use labels as the agent-facing state record. Mirror every label transition to the GitHub Project `Status` field through `set-status-label.sh`.

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
status:tracking
status:stale-claim
status:needs-human
status:failed
```

Only one `status:*` label should be present on an issue. Do not modify status labels directly; use `scripts/set-status-label.sh` so the Project board stays synchronized.

## Normal Flow

```text
Backlog -> Ready -> Claimed -> In Progress -> In Review -> Merged -> Archived
```

`Blocked` can be entered from `Backlog` or `Ready` when dependencies, branch constraints, or coupling-group constraints prevent execution. `Stale-claim`, `needs-human`, and `failed` are recovery labels for automation.
`Tracking` is reserved for non-executable series parent issues. A series parent moves from `tracking` to `archived` only after all child change issues are closed and labeled `status:archived`.

## Agent Actions

| Action | From | To | Required proof |
| --- | --- | --- |
| propose | none/backlog | ready | issue front matter and labels created |
| claim | ready | claimed | assignee and claim comment confirmed |
| start work | claimed | in-progress | branch exists and OpenSpec change is selected |
| open PR | in-progress | in-review | PR URL comment |
| merge PR | in-review | merged | PR merge commit |
| archive | merged | archived | OpenSpec archive path |
| finish series parent | tracking | archived | every child issue is closed and `status:archived` |
| stale claim | claimed/in-progress | stale-claim | expired lease and safe branch/PR recovery proof |
| human escalation | any active state | needs-human | ambiguity, repeated review loops, or unsafe recovery |
| failure | any active state | failed | reproducible failure with command output |

## Coupling Rule

Before claiming an issue, check open issues in the same `coupling_group`.

Stop if any issue other than the current one has:

```text
status:claimed
status:in-progress
```

This rule prevents two worktrees from executing strongly coupled changes at the same time.

## Claim Lock Rule

`status:claimed` is valid only when the issue also has:

```text
origin/<change_id> exists
latest OpenSpec Buddy Claim comment records the branch
claim lease has not expired
```

If the label and branch disagree, stop and mark the issue `status:needs-human` unless the recovery condition in `claim-locking.md` is satisfied.

# Selecting An Executable Change

Recalculate candidates at the start of every iteration.

## Candidate Source

Use both sources:

```bash
openspec list --json
gh issue list --state open --label status:ready --json number,title,body,labels,url
```

An issue is executable only when:

```text
local active OpenSpec change exists on latest main
issue front matter parses successfully
issue change_id equals the OpenSpec change name
issue openspec_path exists
claim_branch equals change_id
issue has status:ready
no open PR exists for claim_branch
origin/<claim_branch> does not exist
all depends_on entries are archived, merged, or otherwise complete
same coupling_group has no claimed or in-progress issue
```

If any condition is unclear, mark the issue `status:blocked` or `status:needs-human` with a comment rather than guessing.

## Tie Breaker

Prefer:

1. Lower-risk issues.
2. Issues without dependencies.
3. Issues unblocking other ready changes.
4. Older issue number.

Never select an issue solely because it appears first in an old cached list.

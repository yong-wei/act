# Failure Recovery

## Stop And Escalate

Set `status:needs-human` when:

```text
issue metadata disagrees with OpenSpec files
claim branch exists with unknown commits
open PR exists for the same claim branch
dependency status is ambiguous
review loop exceeds configured limit
mergeability is blocked by non-actionable external state
archive produces spec conflicts requiring design judgment
```

Set `status:failed` only for reproducible execution failure with command output.

## Stale Claim

A stale claim can be recovered only when:

```text
lease_until has expired
no open PR exists
claim branch has no commits beyond recorded base_sha
no newer claim comment exists
```

Otherwise stop. Do not force-push or delete another agent's branch.

## Goal Mode Failure Policy

In goal mode:

- Mark blocked/unsafe issues and continue to the next executable issue only if the current issue has no local code changes.
- If local code changes exist, preserve them and stop.
- Never skip a failing verification by opening a PR anyway.

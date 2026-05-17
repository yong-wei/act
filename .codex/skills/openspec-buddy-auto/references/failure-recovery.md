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

## Resume Or Branch Drift

After a resume, compaction, or manual branch operation, verify the current
branch before editing or committing:

```bash
git status --short --branch
git branch --show-current
```

If the branch is not the claimed `change_id`, preserve local work first:

```bash
git stash push -u -m "wip <change_id> before branch correction"
git switch <change_id>
git merge --ff-only integration
git stash pop
```

Do not commit implementation work on a coordination branch. If a coordination
branch contains already committed skill or documentation updates that should
land before the claimed change, merge those updates to `integration` first, then
fast-forward or rebase the claim branch onto the updated `integration`.

## Project Status Script Recovery

When Project status synchronization fails, fix the Buddy script before
continuing the state transition. Verification must include:

```bash
bash -n .codex/skills/openspec-buddy/scripts/*.sh
.codex/skills/openspec-buddy/scripts/set-project-status.sh <issue> status:in-review
```

Use the real GitHub Project field and option names from:

```bash
gh project field-list <project-number> --owner <owner> --format json --limit 100
```

## Goal Mode Failure Policy

In goal mode:

- Mark blocked/unsafe issues and continue to the next executable issue only if the current issue has no local code changes.
- If local code changes exist, preserve them and stop.
- Never skip a failing verification by opening a PR anyway.

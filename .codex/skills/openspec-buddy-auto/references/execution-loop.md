# Execution Loop

## Start

Verify:

```bash
git status --short --branch
git fetch origin
git switch integration
git merge --ff-only origin/integration
```

Stop if local unrelated changes exist.

## Claim

Use `openspec-buddy apply`. The claim must create:

```text
origin/<change_id>
status:claimed
OpenSpec Buddy Claim comment with claim_id and lease_until
Project Status: In Progress
Project Start: current local date
```

Then switch to `<change_id>` and mark `status:in-progress`; the Project `Status` must remain `In Progress`.

## Implement

Read `openspec instructions apply --change <change_id> --json`.
Implement one task set at a time, mark tasks complete immediately after verification, and keep commits scoped to the claimed change.
Before leaving implementation, rerun `openspec instructions apply --change <change_id> --json` and require `progress.remaining` to be `0`.
If behavior is already implemented on the branch but `tasks.md` is still unchecked, mark the verified tasks complete and include that file in the implementation PR.
Do not treat a GitHub issue, PR, or merged code path as complete while local OpenSpec tasks remain open.

## PR

Open a formal PR:

```text
title: concise change title
base: integration
body: summary, verification, linked issue
review request: @codex审核，中文回复
```

Do not let `gh pr create` fall back to the repository default branch; pass
`--base integration` explicitly.
Set issue to `status:in-review` with the PR URL; the Project `Status` must remain `In Progress`.
Do this only after OpenSpec task progress is `complete == total`; otherwise finish or reconcile the local tasks first.

## Merge And Archive

After PR merge:

1. Keep the claim branch until archive is complete.
2. Fast-forward the claim branch to `origin/integration`.
3. Recheck `openspec instructions apply --change <change_id> --json` or the archived `tasks.md` source before moving the change.
   Archive only when all tasks are checked. If the PR auto-closed the issue before tasks were complete, keep the branch, finish the task checklist, and merge that state before marking achieved.
4. Before moving the change, inspect `openspec/changes/<change_id>/specs/**/spec.md`.
   If a delta spec adds a capability and `openspec/specs/<capability>/spec.md`
   does not exist, create the main spec from the delta requirements first.
5. Validate the synced spec or affected spec set, for example:
   ```bash
   openspec validate <capability> --strict
   ```
   A failing unrelated spec in `openspec validate --all --strict` is not a reason
   to edit unrelated capabilities in the current archive commit; record it as
   existing debt unless the claimed change caused it.
6. Run `openspec-buddy achieve` / `archive`.
7. Commit archive update.
8. Merge archive commit into `integration`.
9. Push `integration`.
10. Verify the issue has exactly one `status:*` label and that it is `status:archived`.
   If the issue is already closed or the Project item is already `Done`, still rerun
   `mark-achieved.sh` to reconcile the label, archive comment, and Project `End`.
11. Verify the linked series parent. If every child issue under the parent is
    closed and labeled `status:archived`, the parent must also be closed with
    `status:archived`, Project `Status: Done`, and Project `End` set. Use:
   ```bash
   .codex/skills/openspec-buddy/scripts/close-completed-series-parent.sh <child-or-parent-issue>
   ```
12. Delete the remote claim branch before deleting the local branch. Local `git branch -d`
   can reject deletion while the local branch still tracks an older remote claim branch,
   even when the branch is merged to current `HEAD`.

The archive step must set the issue to `status:archived`, close the issue, set Project `Status` to `Done`, and set Project `End` to the current local date.
The same completion rule applies to a series parent after its last child change is archived.
Buddy automation must not merge or push `main`; promoting `integration` to `main`
is a manual release decision.

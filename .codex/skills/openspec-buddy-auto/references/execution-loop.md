# Execution Loop

## Start

Verify:

```bash
git status --short --branch
git fetch origin
git switch main
git merge --ff-only origin/main
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

## PR

Open a formal PR:

```text
title: concise change title
body: summary, verification, linked issue
review request: @codex审核，中文回复
```

Set issue to `status:in-review` with the PR URL; the Project `Status` must remain `In Progress`.

## Merge And Archive

After PR merge:

1. Keep the claim branch until archive is complete.
2. Fast-forward the claim branch to `origin/main`.
3. Run `openspec-buddy achieve` / `archive`.
4. Commit archive update.
5. Merge archive commit into `main`.
6. Push `main`.
7. Verify the issue has exactly one `status:*` label and that it is `status:archived`.
   If the issue is already closed or the Project item is already `Done`, still rerun
   `mark-achieved.sh` to reconcile the label, archive comment, and Project `End`.
8. Delete the remote claim branch before deleting the local branch. Local `git branch -d`
   can reject deletion while the local branch still tracks an older remote claim branch,
   even when the branch is merged to current `HEAD`.

The archive step must set the issue to `status:archived`, close the issue, set Project `Status` to `Done`, and set Project `End` to the current local date.

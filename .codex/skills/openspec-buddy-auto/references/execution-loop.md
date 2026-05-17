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
```

Then switch to `<change_id>` and mark `status:in-progress`.

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

Set issue to `status:in-review` with the PR URL.

## Merge And Archive

After PR merge:

1. Keep the claim branch until archive is complete.
2. Fast-forward the claim branch to `origin/main`.
3. Run `openspec-buddy achieve` / `archive`.
4. Commit archive update.
5. Merge archive commit into `main`.
6. Push `main`.
7. Delete local and remote claim branch.

# PR Review Waiting

Use a serial foreground wait for each five-minute review pause. Do not use
Codex automations, heartbeat automations, reminders, or background monitors:
they run in parallel and can break the one-change-at-a-time workflow.

The wait should block the current execution flow, for example:

```bash
sleep 300
```

In this repository, follow the local shell rule and run:

```bash
rtk sleep 300
```

## State To Remember

Before waiting, record:

```text
pr_number
head_sha
last_seen_review_ids
last_seen_review_thread_ids
last_seen_comment_ids
review_round
quiet_review_checks
```

## Post-Wait Check

After the foreground wait finishes:

```bash
gh pr view <pr> --json state,baseRefName,mergeable,reviewDecision,reviews,comments,commits,statusCheckRollup
gh api graphql ... # required for reviewThreads and isResolved state
```

Check:

```text
new review comments
new requested changes
PR base branch is integration
unresolved review threads
CI/check failures
mergeability
new commits not created by this run
```

If `baseRefName` is `main`, retarget the PR before any review or merge gate:

```bash
.codex/skills/openspec-buddy/scripts/ensure-pr-base.sh <pr-number-or-url>
```

If the script cannot retarget the PR to `integration`, stop and mark the issue
`status:needs-human` rather than merging a Buddy change to `main`.

## Thread-Aware Review Rule

Use `reviewThreads.nodes[].isResolved` from GitHub GraphQL as the review gate.
Flat `reviews`, `latestReviews`, and `comments` are useful context, but they are
not enough to decide whether inline review feedback is still actionable.

Observed failure mode: `latestReviews` may point at a prior commit or omit the
commit oid, while `reviewThreads` still shows the current unresolved thread.

## Three-Check Merge Rule

After the latest head commit or latest review-handling push, check for new
review every five minutes in the foreground. Merge only after three consecutive
checks with no new review, no new review comments, and no new unresolved
threads.

Reset `quiet_review_checks` to `0` whenever a new review, review comment, PR
comment, requested-changes review, or follow-up fix push appears.

Exception: if the latest Codex review explicitly says there are no significant
issues, no major problems, or equivalent wording, and all other merge gates pass,
the PR may be merged without waiting for the remaining quiet checks.

## Thread Resolution Rule

If there is actionable feedback, fix it, push, and reply in the corresponding
review thread with the fix commit or evidence. Resolve the thread only after the
reply exists. For non-actionable feedback, reply with the rationale and evidence
before resolving. Silent thread resolution is not allowed.

After resolving threads, perform another foreground five-minute wait before
checking again, unless the no-significant-issues exception applies.

## CI Waiting

The five-minute wait is for review latency, not for CI. If no actionable review
remains but `statusCheckRollup` still shows an in-progress check, wait for that
check in the foreground, for example:

```bash
gh run watch <run-id> --exit-status
```

In this repository, follow the local shell rule:

```bash
rtk gh run watch <run-id> --exit-status
```

Do not merge until CI is completed successfully or the repository has no required checks.

## Limits

Default:

```text
max_review_rounds: 5
max_elapsed_hours: 24
```

When exceeded, set `status:needs-human` and stop.

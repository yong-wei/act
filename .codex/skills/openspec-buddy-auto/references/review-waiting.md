# PR Review Waiting

Use a heartbeat automation for each five-minute wait. Do not busy-loop.

## State To Remember

Before waiting, record:

```text
pr_number
head_sha
last_seen_review_ids
last_seen_review_thread_ids
last_seen_comment_ids
review_round
```

## Wake-Up Check

On wake:

```bash
gh pr view <pr> --json state,mergeable,reviewDecision,reviews,comments,commits,statusCheckRollup
gh api graphql ... # use when unresolved review thread detail is needed
```

Check:

```text
new review comments
new requested changes
unresolved review threads
CI/check failures
mergeability
new commits not created by this run
```

If there is actionable feedback, fix it, reply, resolve corresponding review threads, push, and schedule another five-minute heartbeat.

If there is no new actionable feedback and all merge gates pass, merge.

## Limits

Default:

```text
max_review_rounds: 5
max_elapsed_hours: 24
```

When exceeded, set `status:needs-human` and stop.

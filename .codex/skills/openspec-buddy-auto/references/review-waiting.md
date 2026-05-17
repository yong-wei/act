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
```

## Post-Wait Check

After the foreground wait finishes:

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

If there is actionable feedback, fix it, reply, resolve corresponding review threads, push, and perform another serial foreground five-minute wait before checking again.

If there is no new actionable feedback and all merge gates pass, merge.

## Limits

Default:

```text
max_review_rounds: 5
max_elapsed_hours: 24
```

When exceeded, set `status:needs-human` and stop.

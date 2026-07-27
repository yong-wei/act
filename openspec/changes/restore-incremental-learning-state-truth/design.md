## Context

`LearningFact` is the durable evidence source. The repository already provides incremental portrait-v2 materialization, compatibility student snapshots, class snapshots, and a durable class materialization outbox. The gap is orchestration: ordinary event ingestion does not schedule affected learners, and ordinary learner materialization does not promptly schedule the affected class. Separately, active-student discovery includes age-only candidates that can generate a compatibility no-recent-evidence replacement.

## Decisions

### 1. Event ingestion is the normal trigger

After `LearningFact.createMany({ skipDuplicates: true })`, the worker schedules one existing `snapshot-student` job per distinct candidate user in that batch. Repeated scheduling is safe because the portrait cursor and unchanged-state check make downstream writes idempotent. The scheduled active-student coordinator remains a bounded recovery mechanism, but it no longer selects learners solely because a snapshot has aged.

### 2. Portrait state change gates all dependent writes

The portrait materializer returns `written: false` when it finds no newly mapped state-changing evidence. In that case the worker returns without creating a portrait or compatibility learner snapshot, class outbox row, cache/summary/risk/growth work, or replacement no-recent-evidence state. A later state-changing fact is still read with the existing cursor semantics and produces one updated state.

The full-rebuild and explicit revocation paths retain their existing contracts. This change does not turn absence of evidence into a revocation.

### 3. A changed learner schedules only the affected class

When a normal learner snapshot is written, the same materialization transaction stages the existing class snapshot outbox for the learner's current class. After commit, the worker immediately enqueues the existing class job using the learner snapshot identity; the outbox provides retry/recovery if enqueueing or the worker fails. No class work is staged for context-only, duplicate, or unchanged learner state.

## Verification

- A newly ingested fact enqueues its learner without waiting for the coordinator.
- A context-only or duplicate input does not append learner/class state or dependent work.
- A state-changing learner update stages and enqueues only its class; the existing student and teacher readers observe the resulting snapshots.
- An aged snapshot alone is not rediscovered as an active-student candidate.

## Context

The existing remediation orchestrator stores one immutable, learner-owned task per wrong-answer attribution and orchestrator version. Its available task already pins resource versions and a governed validation-question content hash, and its read path fails closed when that source snapshot becomes inaccessible or drifts. Issue #1159 must record a learner's bounded work on that task without treating the work as adaptive-assessment evidence or changing a formal learning path.

The client cannot assert a pass result, choose a different question, attach arbitrary catalog references, or choose the learner session. It can only provide an idempotency key, bounded timing/hint facts, and a selected option for the validation question selected by the task; the service binds the session from the owning wrong-answer attribution.

## Goals / Non-Goals

**Goals:**

- Create a server-assigned intervention ID before any work event is accepted.
- Preserve append-only independent intervention histories while converging network retries for the same event key.
- Bind each event and outcome to the stored task snapshot, attribution, selected resources, validation item version/content hash, and caller-supplied learner session identifier.
- Revalidate the task immediately before start and validation; evaluate the selected governed runtime question only on the server.
- Produce a learner-safe recommendation with an explicit evidence-basis summary and no automatic learning-state mutation.

**Non-Goals:**

- Updating adaptive mastery, ability estimates, learning facts, or learning paths.
- Creating a new assessment question, selecting a client-provided question, or exposing answer keys/explanations.
- Combining interventions across learner sessions, adding teacher/class aggregation, or inferring effectiveness beyond one intervention instance.
- Inventing a transfer practice or prerequisite relationship when governed data does not provide one.

## Decisions

### Use append-only intervention instances and idempotent event keys

`MicroInterventionOutcome` is created by a start request after the authoritative orchestration result projects as available. It captures the source identifiers and immutable task snapshot, plus the learner session ID owned by the linked wrong-answer attribution. `MicroInterventionEvent` stores resource-use, hint, and completion facts; the one-to-one validation outcome records the validated answer fact. A unique `(interventionId, eventKey)` index makes delivery retries idempotent; a new start request deliberately creates a new instance. The service compares the existing immutable event or validation payload before returning a retry result: the same key and semantics returns the original result, while a substituted payload, a second validation key, or a concurrent write that resolves to a different first payload returns a conflict without changing stored evidence.

Alternative considered: one mutable result row with counters and a final status. Rejected because it loses event attribution, makes retries ambiguous, and cannot preserve independent attempts.

### Keep validation scoring inside the outcome service

Before accepting an answer, the service reloads and revalidates the source task. It verifies the stored item reference, content hash, version, and runtime question identity, then obtains the answer outcome from the server-only question representation. The outcome record contains only selected-option key, correctness, timing, and version-bound identifiers; it never writes `AdaptiveAssessmentAnswer` or calls the adaptive persistence flow.

Alternative considered: delegate to `/api/assessment/submit-answer`. Rejected because that endpoint records adaptive assessment evidence and may update mastery or paths, violating the issue boundary.

### Recommend only governed, pre-existing next steps

For a passing validation, the service searches the current planning projection for a learner-visible, path-eligible higher-order transfer practice explicitly connected to the task's knowledge node. A candidate must have both a reviewed `transfers-to` relation and a positive governed `crossDomainTransfer` ability impact; a generic resource on that relation is not enough. If none remains available, it returns `TRANSFER_PRACTICE_UNAVAILABLE` while preserving the pass outcome. For a failed validation, it returns governed prerequisite nodes in deterministic order; if none exists, it returns a controlled tutoring/manual-practice recommendation. These records are suggestions only and never modify mastery or the formal path.

Alternative considered: generated or heuristic recommendations. Rejected because the evidence chain would be unverifiable.

### Project stored evidence separately for learners

The stored snapshot may retain internal attribution/node and source-version IDs needed for audit. The learner projection whitelists intervention timing, progress summary, validation correctness, recommendation type, action title/path, prerequisite-node name, and a human-readable evidence-basis summary. It excludes learner-session IDs, raw resource/node IDs, raw selected-answer text, correct options, explanations, source-question ID, misconception tag, candidate lists, teacher-private metadata, and unaccepted event payloads.

## Risks / Trade-offs

- [Current catalog or resource authority changes after an intervention begins] → Revalidate before writes; return a controlled unavailable result without rewriting historical evidence.
- [A runtime question is unavailable even though the catalog item exists] → Reject validation submission and retain the started intervention without fabricating a result.
- [No governed transfer or prerequisite relation exists] → Return an explicit unavailable/manual path recommendation rather than guessing.
- [Event delivery is retried or reordered] → Require stable event keys and store immutable events; duplicate keys return the original result.

## Migration Plan

1. Add additive intervention and event tables, foreign keys, and idempotency indexes. The result foreign key uses `RESTRICT`, so retention of intervention evidence blocks deletion of its orchestration result rather than cascading away the history.
2. Deploy the outcome service and nested remediation API endpoints; new rows are created only on learner action, so no backfill is needed.
3. Rollback removes the routes and service usage first. The additive tables remain inert until a later, separately approved cleanup migration; retained outcome rows require an explicit governed retention decision before the orchestration result can be deleted.

## Open Questions

None.

## Context

Phase B persists planner candidate batches with stable `batchId` and `candidateId` values. The adaptive path center can read those batches and focus a candidate, while Konling already emits governed structured actions. Phase C connects those existing boundaries so a student's conversational choice can select a persisted candidate without making assistant prose or a new model inference authoritative.

The candidate snapshot is immutable. Selection must remain owner-scoped, goal-scoped, auditable, idempotent, and separate from path execution.

## Goals / Non-Goals

**Goals:**

- Resolve a student's choice only within one authorized persisted candidate batch.
- Commit exactly one resolved candidate through the existing path-choice write path.
- Return bounded, structured alternatives when a choice is ambiguous.
- Synchronize the adaptive path center to the same batch and candidate after selection.
- Prove that selection never starts learning automatically.

**Non-Goals:**

- Changing planner policy, candidate count, order, names, snapshots, or recommendation provenance.
- Inferring candidate identity from assistant prose, display order alone, or an unpersisted candidate.
- Adding a second path-selection persistence mechanism.
- Starting or advancing path execution after selection.

## Decisions

### Persisted candidate identity is the sole authority

The selection action carries `batchId` and either an explicit `candidateId` or the student's utterance. The server loads the exact owner-authorized batch and resolves only against its immutable candidates. A model-provided title, ordinal, or rewritten candidate payload cannot authorize a write.

This keeps authorization and identity at the server boundary. Allowing the model to submit a title or reconstructed option would make display text an unstable write key.

### Resolution and commit use an explicit two-phase result

The resolver returns one of `selected`, `clarification_required`, `unresolved`, or `unavailable`. A uniquely resolved candidate is projected to the model as `pending_commit` until the existing path-choice mutation succeeds. Only the governed mutation may complete the AgentToolRun with `selected`. `clarification_required` contains only candidate IDs and student-safe labels from the persisted batch plus a bounded question. All non-selected outcomes are side-effect free.

This separates language interpretation from mutation, prevents the model from reporting a selection before persistence, and makes ambiguity testable. Automatically taking the first or recommended option would silently change student intent.

### Selection reuses the existing path-choice mutation

After unique resolution, the governed action invokes the existing path-choice service or route contract with the verified candidate identity and a stable idempotency key. It does not write a LearningPath through a parallel implementation. Existing ownership, LearningGoal, source-path, audit, and idempotency checks remain authoritative.

### Conversation and path center share one batch context

The successful structured action exposes the verified `batchId` and `candidateId`. Client synchronization navigates or refreshes the adaptive path center using those same identifiers. The page reloads the authorized batch and derives selected UI state from server data rather than trusting message text.

### Selection and execution remain separate

The selection action updates governed choice state only. It does not call the execute route, create node execution state, or advance the current node. Learning starts only through the existing explicit student action.

## Risks / Trade-offs

- **Natural-language references can match more than one candidate** -> Return bounded alternatives and require clarification with zero mutation.
- **Stale or cross-scope batch identifiers can be replayed** -> Reload the exact batch under current actor, goal, and route scope and fail closed.
- **Repeated messages can duplicate mutations** -> Derive and persist a stable idempotency key for the confirmed batch/candidate action.
- **The browser closes or loses the mutation response after resolution** -> Keep the ToolRun running and expose only `pending_commit`; retry the same governed mutation with the same identity and idempotency key.
- **Conversation UI can drift from path-center state** -> Treat the successful server result as a refresh hint, then reload authoritative path data.
- **Resolver heuristics can become an implicit reranker** -> Preserve batch order and candidate labels; matching only determines uniqueness and never changes recommendation order.

## Migration Plan

No data migration is required. Deploy the server resolver and governed action before enabling client refresh handling. Rollback removes the new action and refresh behavior while leaving Phase B candidate batches and existing path-choice records valid.

## Open Questions

None. Phase C uses the existing candidate-batch, structured-action, path-choice, and path-center contracts.

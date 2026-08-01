## Context

Adaptive answers already have durable answer and item-reference records, while Konling conversations have server-owned runtime scope. The missing seam is a durable, authenticated answer-time snapshot that can be attached to one diagnosis conversation without becoming global page state. Historical answers created before this change do not contain that snapshot.

## Goals / Non-Goals

**Goals:**

- Make question, option, misconception, and reviewed remediation facts immutable at answer time.
- Resolve diagnosis context only for the authenticated student and persisted session.
- Detect repeated misconceptions from at most three same-session snapshots.
- Keep each conversation bound to its own mode and controlled server-context hints.
- Return an explicit unavailable state for legacy or invalid snapshots.

**Non-Goals:**

- Backfilling historical answers from mutable question catalogs.
- Writing new learning facts, changing ability estimates, or adjusting paths from diagnosis output.
- Adding a database table or migration.

## Decisions

1. **Store diagnosis facts in `AdaptiveAssessmentItemRef.metadata`.** The item reference is already versioned by question id, algorithm version, and content hash. The full diagnosis snapshot participates in that hash, and an existing item reference is never overwritten. Reconstructing old questions from the live catalog was rejected because it breaks answer-time truth.
2. **Fail closed for incomplete history.** The current answer and each selected recent attempt must have a valid supported snapshot. If ownership, session membership, correct-answer consistency, or a required snapshot cannot be verified, the diagnosis context is unavailable. Guessing from current catalogs was rejected.
3. **Use reviewed catalog decisions for remediation.** Remediation references are accepted only from approved human-review decisions and resolved through the resource registry to canonical titles and targets. URL synthesis from semantic ids is forbidden.
4. **Bind context to the conversation.** The dedicated diagnosis conversation persists its teaching-assistant mode and controlled `answerId` hint. Selecting another conversation restores that conversation's binding. A page-global mode is used only to initiate a new conversation, not as the authority for subsequent turns.
5. **Keep diagnosis advisory.** The prompt may explain the verified attempt and offer a short self-check, but it cannot write learning facts, change ability, or adjust the learning path.

## Risks / Trade-offs

- **Legacy answers cannot be diagnosed immediately** → Return a specific unavailable response and let the learner complete a new attempt; do not fabricate a snapshot.
- **A malformed recent snapshot blocks diagnosis** → Prefer a visible retry/new-attempt path over silently omitting evidence that could change repeated-misconception interpretation.
- **Registry entries can be retired** → Persist the canonical title and target resolved at answer time so historical diagnosis remains reproducible.

## Migration Plan

Deploy without a schema migration. New submissions write versioned snapshots. Existing answers without `adaptive-question-snapshot.v1` remain readable for ordinary assessment history but the new diagnosis entry returns the explicit unavailable boundary. Rollback removes the entry and reader while leaving inert metadata in place.

## Open Questions

None for this change.

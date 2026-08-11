## Context

Issue #1102 introduced immutable adaptive-question snapshots and an authenticated same-session context reader. Those snapshots intentionally contain raw instructional material, while issue #1157 needs a smaller governed result that later micro-tutoring steps can consume without inheriting raw answers or private context.

The reviewed adaptive item-reference snapshot already records the item content hash, graph-node identifiers, misconception tags, review state, and immutability relationship. The attribution can therefore be deterministic and does not require a model call.

## Goals / Non-Goals

**Goals:**

- Bind one result to the current student, answer, session, item reference, and content hash.
- Preserve reviewed graph-node and misconception references without copying raw question content.
- Make insufficient and ambiguous evidence explicit.
- Provide an idempotent persistence boundary and privacy-safe public projection.

**Non-Goals:**

- Selecting remediation resources or validation questions.
- Reading cross-session history.
- Mutating mastery, learning paths, or teacher-level diagnosis.
- Inferring free-text misconception labels.

## Decisions

### Use a dedicated immutable attribution record

The database stores one record per `(answerId, attributionVersion)`. The record denormalizes the verified student, session, item reference, question, and content hash identities for audit, and relates back to the original answer for lifecycle cleanup.

Writing into item-reference metadata was rejected because item references are shared content, not student facts. Reusing teacher diagnosis reports was rejected because their authorization and lifecycle differ. Recomputing on every read was rejected because it loses an auditable rule version.

### Consume only reviewed answer-time metadata

The service loads the answer by `answerId` and `authenticatedUserId`, verifies that the session owner and foreign-key identities agree, and validates the immutable question snapshot against the answer and item content hash. It reads graph nodes and misconception tags only from the answer-time `adaptiveAssessmentItemRef` metadata.

Malformed identity, snapshot, version, or ownership data returns no attribution and performs no write.

### Use deterministic confidence states

- Exactly one reviewed graph node and one controlled misconception tag produces `ATTRIBUTED`, confidence `1`, and no follow-up action.
- Multiple non-empty candidates produce `UNCERTAIN`, confidence `0.5`, and `MANUAL_REVIEW`.
- A traceable reviewed snapshot with a missing graph-node or misconception binding produces `UNCERTAIN`, confidence `0`, and `REPEAT_PRACTICE`.

This confidence describes mapping determinacy, not student mastery.

### Separate stored candidates from factual public projection

The record stores candidate identifiers for audit. The public projection exposes a factual `attribution` object only in the `ATTRIBUTED` state. Uncertain results expose candidates, limitations, confidence, and next action with `attribution: null`.

Evidence summaries and references use a fixed schema and identifiers. They never copy prompt, selected or correct answer, option text, explanations, parser text, conversation content, or arbitrary metadata.

## Risks / Trade-offs

- [Reviewed mappings can still be pedagogically wrong] → Persist the rule version and evidence references so later versions can coexist without rewriting history.
- [A unique constraint race can occur] → Use an upsert with an empty update so repeated requests return the same immutable record.
- [Content metadata can drift internally] → Validate the persisted item-version hash, the distinct catalog-source hash, and the immutable snapshot relationship before attribution.

## Migration Plan

1. Add the attribution table, unique constraint, answer foreign key, and lookup indexes.
2. Deploy the service without backfilling historical answers.
3. Create records lazily for eligible wrong answers.

Rollback removes the service call before dropping the new table. No existing assessment data is rewritten.

## Open Questions

None for issue #1157.

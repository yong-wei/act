## Context

Learner-state and path planning need a durable knowledge-mastery source. The report specifically warns that memory-only assessment data cannot support XH-202620 evidence claims.

## Decisions

### Persist inputs before computing state

Assessment sessions, answer records, item references, ability estimates, mastery updates, and algorithm versions must be persisted so results are reproducible after restart and auditable during governance review.

### Use assessment-backed BKT-compatible mastery

Knowledge-node mastery uses a versioned BKT-compatible posterior or equivalent assessment-backed state. Non-assessment evidence can adjust context confidence but cannot by itself create high-confidence mastery.

### Keep API compatibility

Existing assessment API response shapes remain compatible during migration. New durable IDs and algorithm metadata can be added without breaking callers.

## Risks / Trade-offs

- Full IRT calibration can be deferred; the first implementation needs reproducible records and versioned mastery updates.
- Raw question text and answer bodies require restricted scopes, so LearningFacts should carry safe references and derived scores.

## Migration Plan

1. Add persistence tables and contracts.
2. Write through assessment submissions to durable records.
3. Emit governed facts and mastery updates.
4. Keep old response shapes while new storage becomes authoritative.

## Implementation Contract

### Ownership and ER boundary

`AdaptiveAssessmentAlgorithmVersion` is the versioned algorithm root. `AdaptiveAssessmentSession` owns a learner/session attempt stream, `AdaptiveAssessmentItemRef` stores privacy-safe item metadata, `AdaptiveAssessmentAnswer` stores one submitted answer using option keys rather than answer text, `AdaptiveAssessmentAbilityEstimate` stores the per-answer ability snapshot, and `AdaptiveMasteryUpdate` stores per-knowledge-tag BKT-compatible posterior updates. `LearningFact` remains the governed downstream evidence surface.

The source of truth for adaptive assessment replay is:

`AdaptiveAssessmentSession -> AdaptiveAssessmentAnswer -> AdaptiveAssessmentItemRef`

Mastery state is reproducible from persisted `AdaptiveAssessmentAnswer` rows plus the referenced `AdaptiveAssessmentAlgorithmVersion`. `AdaptiveMasteryUpdate` is a materialized audit record, not the only source needed for rebuild. The assessment submission endpoint and assessment summary endpoints use the persisted answer stream as the authoritative history while the persistence flag is enabled; the legacy in-memory engine remains the explicit fallback only when the flag is disabled.

### Data dictionary and privacy

| Field family | Source | Privacy class | Notes |
| --- | --- | --- | --- |
| `sessionKey`, `answerId`, `questionId`, `questionRefId` | assessment persistence | student-visible / teacher-scoped by subject | Stable references only. |
| `selectedOptionKey`, `correctOptionKey` | assessment persistence | student-visible for own response, teacher-scoped in class context | Stores safe option keys such as `A`, not raw answer bodies. |
| `knowledgeTags`, `difficulty`, `questionType`, `domains` | item reference | student-visible / teacher-scoped | Does not store full question text. |
| `abilityEstimate`, `confidenceLow`, `confidenceHigh` | ability estimate | student-visible for own state, teacher-scoped in class context | Derived score only. |
| `priorMastery`, `posteriorMastery`, `confidence`, `prerequisiteState` | mastery update | student-visible summary / teacher-scoped detail | Derived state; prerequisite evidence exposes missing/stale tags, not raw payloads. |
| `parameters` | algorithm version | audit-only | Versioned BKT-compatible parameters for reproducibility. |
| `LearningFact.contextJson.adaptiveAssessment` | governed evidence | student-visible summary / teacher-scoped detail | Carries safe refs, knowledge tags, score, ability estimate, confidence, privacy level, and algorithm version. |

Raw answer bodies and full question text are not written to normal learner-state payloads or `LearningFact.contextJson`.

### Evaluation event example

```json
{
  "eventType": "answer_submit",
  "actor": "student-1",
  "sourceCapability": "adaptive-assessment-persistence",
  "payloadVersion": "adaptive-assessment-bkt-v1",
  "occurredAt": "2026-05-26T02:30:00.000Z",
  "privacyLevel": "restricted",
  "confidence": 0.82,
  "relatedRefs": {
    "assessmentAttemptId": "durable-session-1",
    "answerId": "answer-1",
    "questionRefId": "item-ref-1"
  }
}
```

### Feature flag and rollback

The write-through path is controlled by `ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED`, defaulting to enabled. Setting it to `false` keeps the existing `/api/assessment/submit-answer` response path available through the legacy in-memory engine and omits durable ids. Rollback requires disabling the flag and reverting the migration only if the deployment must remove unused tables; existing `LearningFact` consumers remain compatible because durable ids are optional additions.

### Consistency and failure handling

Assessment submission persistence runs in a single Prisma transaction covering algorithm version, session, item reference, answer, ability estimate, mastery update, and governed `LearningFact` materialization. If a late write such as `LearningFact` creation fails, the transaction rejects as a unit instead of leaving a partially counted answer. The API therefore avoids duplicate mastery pollution from retrying after a partially written submission.

### Rebuild parameters and prerequisite state

The BKT-compatible rebuild accepts the persisted algorithm parameter snapshot. Replaying the same persisted answers with the same `algorithmVersion` and parameter payload yields the same mastery posterior and confidence metadata. The rebuild also records prerequisite evidence using default control-domain prerequisite tags and supports stale prerequisite detection for older prerequisite evidence.

## Open Questions

- None.

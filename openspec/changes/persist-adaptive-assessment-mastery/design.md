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

## Open Questions

- None.

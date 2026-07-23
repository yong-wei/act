## 1. Restore the minimal incremental path

- [x] 1.1 Narrow this change to existing LearningFact, portrait-v2, learner snapshot, class snapshot, and outbox paths; remove journal, role, selector, repair, and cutover requirements.
- [x] 1.2 Enqueue each affected learner after an ingestion batch persists candidate facts, with stable existing queue semantics.
- [x] 1.3 Make portrait `written` state prevent context-only, duplicate, unchanged, and time-only work from appending learner or dependent projections.
- [x] 1.4 Stage and immediately enqueue only the affected class after a learner state update, retaining the current outbox for recovery.

## 2. Verify usability

- [x] 2.1 Cover event-to-learner scheduling, context-only/duplicate no-op, changed learner-to-class propagation, and no age-only candidate discovery in focused tests.
- [x] 2.2 Run typecheck, focused data-governance plus student/teacher route tests, strict OpenSpec validation, and data-governance/independent review.

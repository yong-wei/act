# LearningFact producer denominator

Capture revision: `unify-learning-fact-ingestion-and-projection-trigger` after implementation.

| Producer | Path | Transport today | Fact writer | Projection trigger | Direct+outbox | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Interactive events | `src/app/api/interactive/events/route.ts` | `ingestLearningFact` direct for materializable; `routeEvent` for non-fact secondary | canonical API | EvidenceOutbox trigger intent | no | Vertical slice compared against 41c956295 baseline |
| Redis secondary worker | `claimSecondaryEvents` → `processEventIngestionJob` | Redis claim/lease then batch outcomes | canonical API | ingest trigger + `enqueueStudentSnapshot` | no | Ack after ingest |
| Assessment submit | `persistAdaptiveAssessmentSubmission` | same Prisma transaction | canonical API | trigger intent in that transaction | direct only | Official scoring owner unchanged |
| Personalization micro-intervention | events/validation routes | EvidenceOutbox staging | worker projector | shared trigger helper after written facts | forbidden by guard | Worker-only materializer from #1566 |
| Document grading approve | `src/app/api/teacher/document-grading/approve/route.ts` | same transaction | `writeKnowledgeScopedLearningFacts` | shared trigger helper + reconciliation | direct only | Fact row shape unchanged |
| Arena evidence writeback | `src/features/arena/evidence-writeback-persistence.ts` | EvidenceOutbox required | not this change | n/a | outbox | Arena official authority unchanged |
| Historical backfill | `historical-evidence-materialization.ts` | batch apply | legacy knowledge-scoped writer | shared trigger helper | n/a | No production backfill |

Baseline defects closed:

1. Interactive core facts persist through canonical ingest with a durable projection trigger.
2. Worker claims Redis with `RPOPLPUSH` and acks after fact+trigger.
3. Interactive no longer independently combines `routeEvent` and `persistCoreLearningFact` for the same logical input.
4. Assessment, Personalization, document grading and historical apply share `projectionTriggerKey`.

# Producer migration ledger

Capture revision: `unify-learning-fact-ingestion-and-projection-trigger` working tree after vertical + remaining producer cutover.

| Producer | Mode | Transport | Fact writer | Trigger | Direct+outbox | Retirement |
| --- | --- | --- | --- | --- | --- | --- |
| Interactive materializable events | migrated | `direct` `ingestLearningFact` | canonical API → `persistCoreLearningFact` | EvidenceOutbox `learning-fact-projection-trigger` | no; sampled `workspace_param_change` no longer buffers | `routeEvent` only for non-fact secondary |
| Interactive non-fact secondary | retained buffer | Redis claim/lease | none | none | no | RPOP retired; ack after worker ingest |
| Redis leftover materializable JSON | migrated | `outbox-apply` via worker claim | canonical API | ingest result then `enqueueStudentSnapshot` | no | drain in-flight lists via recoverExpired |
| Assessment submit | migrated | `direct` same transaction | canonical API | trigger intent in same tx | no | official scoring owner unchanged |
| Personalization micro-intervention | migrated trigger | worker-only outbox apply | existing projector + shared trigger helper | `recordProjectionTriggerIntent` after written facts | still forbidden by LR guard | no second fact writer |
| Document grading approve | migrated trigger | direct existing writer | `writeKnowledgeScopedLearningFacts` | shared trigger helper + existing reconciliation | no | fact row shape unchanged |
| Historical backfill | migrated trigger | batch apply | `writeLegacyKnowledgeScopedLearningFacts` | shared trigger helper per affected user | no | no production backfill executed |
| Arena writeback | unchanged | EvidenceOutbox | not this change | n/a | n/a | official authority unchanged |

Replay / sanitizer / retention receipts:

- Staging payloads are allowlisted; forbidden/unknown/exception-echo fail closed before persist.
- Successful Redis payloads are acknowledged only after fact+trigger outcomes are recorded; expiry uses event-contract caps (successful payload 24h, failure receipt 30/90d).
- Raw artifacts remain disabled; queue/fact-consumer roles cannot inherit replay or raw access.

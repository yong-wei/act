# Learning Record event contract characterization

Capture revision: `define-learning-record-event-contract` working tree.

| Surface | Owner | Current authority | Contract role | Deletion condition |
| --- | --- | --- | --- | --- |
| `src/lib/data-governance/event-types.ts` | data-governance | event type metadata | projected into versioned registry; no longer protocol truth | delete after all producers resolve via registry and EventDictionary projection is the only DB copy |
| `src/lib/data-governance/event-protocol.ts` | data-governance | legacy LearningEvent shape | compatibility input to legacy adapter | delete after ingestion change consumes envelopes |
| `src/app/api/interactive/events/route.ts` | interactive | classroom submission producer | `lesson_submit` is the first migrated producer through `acceptLearningRecordEvent` | remaining action types stay on `toLearningEvent` until later producer slices |
| Redis event buffer / worker | data-governance | core vs secondary routing | consumer of legacy LearningEvent; not rewritten | retire when buffer accepts envelopes |
| `LearningEventBatch` / `EventDictionary` | data-governance | queryable dictionary | dictionary is a checked projection of the registry | drift fails closed in tests |
| Assessment outbox | assessment | official assessment authority | registered as `assessment-producer`; ownership unchanged | no plugin/outbox rewrite in this change |
| Personalization outbox | personalization | recommendation/intervention authority | registered as `personalization-producer`; ownership unchanged | no plugin rewrite |
| Arena evaluation | arena | official Arena authority | registered as `arena-producer`; ownership unchanged | no Arena contract rewrite |
| ground-evidence-copilot | AI context | server-authorized context | permitted consumer of teacher-scoped/public projections only | must not inherit raw/replay |
| Backfills / reports | data-governance | historical JSON | must pass sanitizer/allowlist; no new raw JSON restored | deletion receipts owned by later retention jobs |
| Tests | this change | contract suite | registry, scope, dedupe, privacy, replay, retention | keep with the contract module |

Internal same-transaction Learning Record API calls are not required to emit events.

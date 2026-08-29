# Migration ledger — control-correction Learning Record adapter

| Caller | Mode after this change | Replacement | Retirement gate |
| --- | --- | --- | --- |
| `src/features/arena/evidence-writeback-persistence.ts` | adapter-mapped vertical slice | `resolvePersonalizationGoalContext({ taskId })` + `mapCourseLearningRecordEvidence` | generic `'control-correction'` literals gone |
| `src/features/arena/evidence-writeback.ts` / `submissions/evidence-status.ts` | plugin-resolved official target | `plugin.arenaOfficialTarget` via taskId | `task-second-order-lead-pid` and `ARENA_OFFICIAL_TARGET` gone |
| Generic `ingestLearningFact` | course-agnostic dispatcher | `mapCourseLearningRecordEvidence` only when explicit goal/plugin present | no course ID literals in ingest |
| learner-state reducer | plugin-scoped facts | official Arena via `contextJson.arena.official`; no evidence-match import | `CONTROL_CORRECTION_COURSE_ID_VALUES` absent from `internal.ts` |
| Personalization plugin evidence port | retained historical read | explicit goal + legacy course match stay in plugin `db-evidence.ts` | delete legacy match after production facts all carry explicit `goalId` (out of scope) |
| Learning Record snapshots / current read ports / consumers | unchanged, course-agnostic | none | n/a |
| `control-correction-teacher-report`, demo packages, resource seed | course product owners | keep | not generic LR |
| Konling / path-planning | already on plugin public API (#1569) | keep | n/a |
| Arena official outbox / evaluation | Arena authority | unchanged score path | adapter failure must not rewrite official result |
| Ingestion sanitizer / retention / replay / raw ACL | reused by adapter | `event-contract` + `ingestion/retention` | adapter does not own a second store |
| Postgres/Redis/queue persistence | existing LearningFact + EvidenceOutbox | adapter is pure; ingest/outbox remain the durable path | covered by ingest + Arena writeback tests |

## Deletion proof

Generic Learning Record ingest, course-adapter dispatcher, current read ports, Arena writeback projector and persistence no longer contain `unit-3-6-zero-design-workshop`, `task-second-order-lead-pid`, `'3-6'`, or hardcoded `'control-correction'` course literals. Plugin `mappings.ts` remains the sole ID table.

## Retention / sanitizer / raw receipts

Adapter reuses Learning Record retention caps (replay ≤7d, successful payload 24h, failure ≤90d, approved raw ≤7d), recursive forbidden-field inspection, independent raw ACL, two-person replay authorization, and terminal-before-delete unreadability checks. Failure receipts are redacted fingerprints only.

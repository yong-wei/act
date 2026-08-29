# Retirement ledger

Capture / freeze baseline: `integration` squash of #1586 (`beb80a691`).
Owner: Learning Record ingestion / projection / consumer ports.
This ledger is the only deletion gate. Unclosed rows fail closed.

## 1. Denominator

| id | kind | path / surface | replacement | owner | disposition | deletion condition |
| --- | --- | --- | --- | --- | --- | --- |
| producer.interactive.direct | producer | `src/app/api/interactive/events/route.ts` | `ingestLearningFact` transport=`direct` | interactive | current-replacement | n/a |
| producer.redis.secondary-buffer | producer | `event-buffer.bufferSecondaryEvent` | claim/lease + worker `outbox-apply` | data-governance-worker | retained-authorized | secondary non-fact buffer; not a fact writer |
| producer.assessment | producer | Assessment submit | Assessment owner + same-tx ingest | assessment | current-replacement | n/a; official scoring unchanged |
| producer.personalization.micro-intervention | producer | Personalization outbox apply | plugin-owned projector + shared trigger | personalization | current-replacement | n/a |
| producer.arena.official | producer | Arena official result | Arena submission authority | arena | retained-authorized | never retired here |
| producer.historical.backfill | backfill | `writeLegacyKnowledgeScopedLearningFacts` | historical/migration only | data-governance | retained-authorized | no production backfill in this change |
| worker.secondary.drain | worker | `processEventIngestionJob` | ingest + per-message receipt + ack confirmed only | data-governance-worker | current-replacement | ack only applied/deduplicated/terminal_failed |
| queue.rpop.destructive | queue | `client.rpop` | `rpoplpush` claim/lease | data-governance | code-retired | zero `client.rpop` in production sources |
| queue.ltrim.destructive | queue | `client.ltrim` on secondary list | reject writes at capacity | data-governance | code-retired | no silent drop of unconfirmed messages |
| materializer.session-fact-replay | materializer | `session-fact-replay.ts` | `ingestLearningFact` | interactive + closure | code-retired | `persistCoreLearningFact` only from ingest |
| materializer.persist-core.ingest-only | materializer | `learning-fact-materialization.ts` | called only by ingest | ingestion | current-replacement | not a public second writer |
| consumer.student.port | consumer | student evidence / competency-snapshot route | `readStudentEvidencePort` | learning-record consumers | current-replacement | n/a |
| consumer.teacher.port | consumer | class/student insights | teacher ports | learning-record consumers | current-replacement | n/a |
| consumer.ai.port | consumer | AI / Personalization safe feature | `readAuthorizedCumulativePortrait` | learning-record consumers | current-replacement | n/a |
| consumer.copilot | consumer | ground-evidence-copilot | existing `resolveEvidenceCopilotContext` | copilot | retained-authorized | no retirement regression |
| consumer.personalization.plugin | consumer | plugin registry + LR adapter | plugin ownership | personalization | retained-authorized | no course-id guessing restored |
| aggregator.interaction-log.profile | report | profile activity stream | none | profile | retained-authorized | not current-score aggregator |
| aggregator.interaction-log.session-reports | report | session reports | none | session-reports | retained-authorized | reports, not current scores |
| aggregator.interaction-log.admin-audit | report | admin data-governance | operator audit | admin | retained-authorized | purpose/revision required |
| projection.student-competency-snapshot | consumer | Personalization compatibility / feature cache | keep table + compatibility adapter | personalization | retained-authorized | historical evidence; not deleted |
| privacy.sanitizer-allowlist | test | ingest/projection/consumer sanitizers | versioned allowlist | ingestion | current-replacement | n/a |
| privacy.raw-artifact | test | `authorizeRawArtifact` / replay | dual-control audit only | ingestion | current-replacement | student/teacher/queue cannot inherit |

## 2. Migration / replay / watermark

- Interactive core events: canonical ingest; `sourceEventId` unique + skipDuplicates.
- Duplicate classroom receipts: replay persisted `StudentStepResponse` through ingest, not a second writer.
- Redis leftover JSON: worker claim → ingest `outbox-apply` → `LearningEventBatch.events` receipt per message → ack only confirmed statuses; `retryable_failed` stays in processing until lease expiry then `recoverExpiredSecondaryClaims`.
- Comparison keys: LearningFact identity (`sourceEventId` + capture revision), accepted/deduplicated/failed counts in batch `events`, projection trigger key, input digest, portrait state watermark from existing current pointer.
- Qualified current rollback: restore prior current pointer / code; do not rewrite facts, snapshots, outbox, Arena official rows.

## 3. Gated deletion evidence

- RPOP: already absent after #1583; this change keeps the characterization and forbids reintroduction.
- `LTRIM`: removed. Capacity is fail-closed (`llen >= 10000` rejects new secondary writes).
- Duplicate `persistCoreLearningFact` from session replay: deleted.
- Page-level raw score aggregators: none reached zero required callers as current-score sources; remaining InteractionLog uses are retained-authorized.
- Historical `LearningFact`, competency snapshots, transitions, outbox, official Arena/Assessment results: preserved.

## 4. Privacy / retention (decision B)

Reuse `INGESTION_RETENTION` / event-contract caps: successful payload 24h, failure 30/90d, transport replay 72h/7d, approved raw 24h/7d, public audit 90d. Deletion requires terminal receipt. Raw artifact is independently authorized; queue/fact-consumer/student/teacher roles cannot inherit. Rollback cannot restore broad raw JSON/ACL.

## 5. Contract non-regression

- Copilot: still `resolveEvidenceCopilotContext` / `readLearnerState`; no copied permission resolver.
- Arena official: adapter cannot override official score.
- Assessment: direct fact owner unchanged.
- Personalization: plugin registry remains the course mapping owner.

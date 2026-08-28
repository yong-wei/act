# Characterization

## Direct core path (after cutover)

`POST /api/interactive/events` still accepts `lesson_submit` through `acceptLearningRecordEvent`, then builds a legacy `LearningEvent`. Materializable events call `ingestLearningFact({ transport: 'direct' })` only. Non-fact secondary events call `routeEvent` only. Sampled `workspace_param_change` no longer dual-writes fact plus Redis.

## Secondary Redis path (after cutover)

`bufferSecondaryEvent` still LPUSHes JSON onto `event:buffer:secondary:<date>`. Claim uses `RPOPLPUSH` onto `event:processing:secondary:<date>` with a lease hash. Ack `LREM`s the processing copy after ingest+trigger. Expired leases are requeued. `processEventIngestionJob` writes `LearningEventBatch` after per-item canonical ingest outcomes, then acks.

## Existing durable pieces reused

- Event contract: `acceptLearningRecordEvent`, allowlist, digests, anchors, retention.
- Identity writer inside `persistCoreLearningFact`.
- EvidenceOutbox: staged=`pending`, applied=`projected`, deduplicated=`superseded`.
- Shared `recordProjectionTriggerIntent` / `projectionTriggerKey` for Assessment, Personalization, document grading and historical apply.

## Canonical API contract (task 1.3)

`ingestLearningFact` is the only application entry for LearningEvent producers. Cross-process producers call `stageLearningFactIngestion`; workers call `applyStagedLearningFactIngestions` or Redis claim + `ingestLearningFact({ transport: 'outbox-apply' })`.

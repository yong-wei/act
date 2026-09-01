import { WriteBoundaryError, type WriteBoundaryRow, type WriteDisposition, type WriteTransport } from './types';

function row(
  id: string,
  producer: string,
  entry: string,
  owner: string,
  transport: WriteTransport,
  canonicalEntry: string,
  dedupeIdentity: string,
  anchors: string,
  trustedTimes: string,
  privacyClass: string,
  projectionTrigger: string,
  consumer: string,
  evidence: string,
  deletionCondition: string,
  disposition: WriteDisposition,
): WriteBoundaryRow {
  return {
    id,
    producer,
    entry,
    owner,
    transport,
    canonicalEntry,
    dedupeIdentity,
    anchors,
    trustedTimes,
    privacyClass,
    projectionTrigger,
    consumer,
    evidence,
    deletionCondition,
    disposition,
  };
}

export const WRITE_BOUNDARY_ROWS: readonly WriteBoundaryRow[] = [
  row('producer.canonical.ingest', 'canonical-ingest-api', 'src/features/learning-record/ingestion/ingest.ts', 'ingestion', 'direct', 'ingestLearningFact', 'sourceEventId+captureRevision', 'event/envelope anchors', 'trustedOccurredAt + receivedAt + materializedAt', 'student-private', 'recordProjectionTriggerIntent', 'all supported producers', 'ingest-learning-fact.test.ts', 'single application write boundary', 'canonical'),
  row('producer.interactive.direct', 'interactive-events', 'src/app/api/interactive/events/route.ts', 'interactive', 'direct', 'ingestLearningFact', 'sourceEventId+captureRevision', 'eventId/sourceLogId/revision', 'server receivedAt + trustedOccurredAt', 'student-private', 'recordProjectionTriggerIntent', 'projection-trigger outbox', 'ingest-learning-fact.test.ts + events/route.test.ts', 'keep-until-interactive-owner-changes', 'canonical'),
  row('producer.assessment.adaptive', 'assessment-attempt', 'src/features/assessment/adaptive-persistence.ts', 'assessment', 'direct', 'ingestLearningFact', 'sourceEventId+captureRevision', 'assessment answer/session anchors', 'server occurredAt', 'restricted', 'recordProjectionTriggerIntent', 'assessment + projection', 'adaptive-persistence.test.ts', 'C6 migrates remaining adapter only', 'canonical'),
  row('producer.session.replay', 'closure-replay', 'src/lib/data-governance/session-fact-replay.ts', 'interactive', 'correction-replay', 'ingestLearningFact', 'clientEventId as sourceEventId', 'persisted StudentStepResponse', 'submittedAt', 'student-private', 'ingest trigger if applied', 'session-closure worker', 'retirement.test.ts', 'old persistCore path already code-retired', 'canonical'),
  row('producer.outbox.apply', 'staged-ingestion', 'src/features/learning-record/ingestion/apply-staged.ts', 'ingestion', 'staged-outbox', 'ingestLearningFact transport=outbox-apply', 'ingestionDedupeKey', 'staged payload anchors', 'trustedOccurredAt from stage', 'student-private', 'ingest trigger', 'data-governance-worker', 'ingest-learning-fact.test.ts', 'keep-as-cross-process-path', 'canonical'),
  row('producer.outbox.stage', 'staged-ingestion', 'src/features/learning-record/ingestion/stage.ts', 'ingestion', 'staged-outbox', 'stageLearningFactIngestion', 'ingestionDedupeKey', 'eventId + captureRevision', 'receivedAt at stage', 'student-private', 'none until apply', 'apply-staged worker', 'ingest-learning-fact.test.ts', 'must-not-write-LearningFact', 'canonical'),
  row('producer.redis.secondary-worker', 'secondary-buffer', 'scripts/workers/data-governance-worker.ts', 'data-governance-worker', 'staged-outbox', 'ingestLearningFact after claim/lease', 'sourceEventId+captureRevision', 'claimed LearningEvent', 'worker receivedAt', 'student-private', 'ingest trigger', 'snapshots via trigger', 'data-governance-worker-materialization.test.ts', 'duplicate identities isolated by ingest dedupe, never ACK-skipped', 'isolated-duplicate'),
  row('producer.personalization.micro-intervention', 'micro-intervention', 'src/features/assessment/micro-intervention-learning-evidence.ts', 'personalization', 'staged-outbox', 'writeKnowledgeScopedLearningFacts after outbox', 'interventionId dedupe', 'intervention anchors', 'server times', 'restricted', 'personalization outbox projector', 'personalization plugin', 'outbox-port.test.ts', 'C6 adapter migration; no parallel direct+outbox', 'exception-c6-c7'),
  row('producer.personalization.outbox.stage', 'micro-intervention-stage', 'src/features/learning-record/personalization-ports/outbox.ts', 'personalization', 'staged-outbox', 'stageMicroInterventionEvidenceOutbox', 'interventionId', 'intervention id', 'stage time', 'restricted', 'none at stage', 'applyStagedMicroInterventionEvidence', 'outbox-port.test.ts', 'rejectDirectAndOutboxDoubleWrite', 'canonical'),
  row('producer.arena.official', 'arena-official-writeback', 'src/features/arena/evidence-writeback-persistence.ts', 'arena', 'direct', 'writeKnowledgeScopedLearningFacts', 'arena-official: prefix', 'official submission identity', 'server evaluation time', 'teacher-scoped', 'arena writeback only', 'arena ranking/evidence', 'arena-evidence-writeback-persistence.test.ts', 'C7 migrates adapter; not deleted here', 'exception-c6-c7'),
  row('producer.teacher.document-rubric', 'document-rubric', 'src/lib/data-governance/document-rubric-grading-workbench.ts', 'teacher', 'direct', 'writeKnowledgeScopedLearningFacts', 'grading: prefix', 'document grading identity', 'teacher approved time', 'teacher-scoped', 'none in this change', 'teacher grading', 'document-rubric-grading-workbench.test.ts', 'C7 migrates adapter', 'exception-c6-c7'),
  row('producer.teacher.document-approve', 'document-grading-approve', 'src/app/api/teacher/document-grading/approve/route.ts', 'teacher', 'direct', 'writeKnowledgeScopedLearningFacts', 'adaptive-assessment:document-rubric-grading', 'approve route identity', 'server approve time', 'teacher-scoped', 'none in this change', 'teacher grading', 'document-rubric-grading-routes.test.ts', 'C7 migrates adapter', 'exception-c6-c7'),
  row('producer.control-correction.path', 'path-rounds', 'src/features/personalization/path-planning/control-correction-path-rounds.ts', 'personalization', 'direct', 'writeKnowledgeScopedLearningFacts', 'control-correction-path:/learning-path:', 'path choice identity', 'server choice time', 'student-private', 'none in this change', 'control-correction plugin', 'control-correction-path-rounds.test.ts', 'migrated to personalization path-planning', 'canonical'),
  row('producer.simulation.agent', 'simulation-agent', 'src/lib/data-governance/simulation-agent-evidence-materialization.ts', 'simulation', 'direct', 'writeKnowledgeScopedLearningFacts', 'simulation-agent-evidence:', 'run/trace identity', 'server run time', 'student-private', 'optional outbox', 'konling/simulation', 'simulation-agent tests', 'retained until simulation owner change', 'retained-authorized'),
  row('producer.simulation.task-metric', 'simulation-task', 'src/lib/data-governance/simulation-task-learning-fact.ts', 'simulation', 'direct', 'learningFact.createMany', 'task metric sourceEventId', 'task run identity', 'server run time', 'student-private', 'none', 'portrait task metrics', 'non-knowledge-scoped inventory', 'must-not-stamp-knowledge-identity', 'retained-authorized'),
  row('sink.persist-core', 'ingest-physical-sink', 'src/lib/data-governance/learning-fact-materialization.ts', 'ingestion', 'direct', 'persistCoreLearningFact via ingest only', 'sourceEventId', 'event anchors', 'ingest times', 'student-private', 'caller records trigger', 'ingestLearningFact', 'retirement.test.ts ingest-only scan', 'zero extra production callers', 'adapter-sink'),
  row('sink.canonical.writer', 'identity-adapter', 'src/lib/canonical-learning-fact-identity/writer.ts', 'ingestion', 'direct', 'writeKnowledgeScopedLearningFacts', 'sourceEventId + knowledgeRevisionRef', 'authority selector', 'write time', 'student-private', 'none', 'all governed producers', 'canonical-learning-fact-identity.test.ts', 'adapter-implementation', 'adapter-sink'),
  row('sink.canonical.shadow', 'identity-shadow', 'src/lib/canonical-learning-fact-identity/shadow.ts', 'ingestion', 'direct', 'writeKnowledgeScopedLearningFacts', 'shadow validation identity', 'selector', 'n/a', 'student-private', 'none', 'admission shadow', 'canonical-learning-fact-identity.test.ts', 'not an online producer', 'adapter-sink'),
  row('backfill.historical-evidence', 'historical-materialization', 'src/lib/data-governance/historical-evidence-materialization.ts', 'data-governance', 'explicit-backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'historical:source:id', 'frozen source anchors', 'source occurredAt', 'student-private', 'none — must not mimic online trigger', 'authorized historical apply', 'historical-evidence-materialization.test.ts', 'dry-run default; apply needs operationId', 'retained-authorized'),
  row('backfill.historical.script', 'historical-cli', 'scripts/db/materialize-historical-learning-facts.ts', 'data-governance', 'explicit-backfill', 'applyHistoricalEvidenceMaterializationPlan', 'plan generatedAt + source ids', 'frozen plan', 'plan generatedAt', 'student-private', 'none', 'operator CLI', 'script --apply --authorize', 'default dry-run', 'retained-authorized'),
  row('backfill.event-batches', 'event-batch-backfill', 'scripts/db/backfill-learning-facts-from-event-batches.ts', 'data-governance', 'explicit-backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'sourceEventId skipDuplicates', 'batch event id', 'event occurredAt', 'student-private', 'enqueue-snapshots removed', 'operator CLI', 'dry-run flag', 'default dry-run; no online pointer', 'retained-authorized'),
  row('backfill.interaction-logs', 'interaction-log-backfill', 'scripts/db/backfill-learning-facts-from-interaction-logs.ts', 'data-governance', 'explicit-backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'sourceEventId', 'log id', 'log time', 'student-private', 'enqueue-snapshots removed', 'operator CLI', 'dry-run flag', 'default dry-run', 'retained-authorized'),
  row('backfill.unit-4-1', 'unit-4-1-growth', 'scripts/db/backfill-unit-4-1-growth-governance.ts', 'data-governance', 'explicit-backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'unit-4-1 source ids', 'lesson anchors', 'source time', 'student-private', 'none', 'operator CLI', 'script inventory', 'historical-or-backfill', 'retained-authorized'),
  row('backfill.migrate-to-facts', 'legacy-migration', 'scripts/migrations/002-migrate-to-learning-facts.ts', 'data-governance', 'explicit-backfill', 'writeLegacyKnowledgeScopedLearningFacts', 'migrated sourceEventId', 'legacy row id', 'legacy time', 'student-private', 'none', 'one-shot migration', 'migration script', 'do-not-rerun-as-online', 'retained-authorized'),
  row('backfill.course-evidence', 'course-evidence-enrich', 'src/lib/data-governance/course-evidence-backfill.ts', 'data-governance', 'explicit-backfill', 'learningFact.update existing only', 'existing fact id', 'original fact identity unchanged', 'original times', 'student-private', 'report regen is separate command', 'operator CLI', 'course-evidence-backfill.test.ts', 'dry-run plan; no new fact identity', 'retained-authorized'),
  row('backfill.scoring-recompute', 'interactive-score-recompute', 'src/lib/data-governance/interactive-evidence-scoring-recompute.ts', 'data-governance', 'explicit-backfill', 'learningFact.update existing only', 'existing fact id', 'original identity', 'original times', 'student-private', 'none', 'operator CLI', 'interactive scoring tests', 'dry-run plan; no current pointer', 'retained-authorized'),
  row('fixture.yangfan', 'yangfan-fixture', 'src/lib/data-governance/yangfan-diagnostic-fixture.ts', 'data-governance', 'explicit-backfill', 'learningFact.createMany fixture', 'fixture sourceEventId', 'fixture ids', 'fixture times', 'student-private', 'none', 'local diagnostic', 'yangfan-diagnostic-fixture.test.ts', 'fixture-only', 'test-fixture'),
];

export const WRITE_BOUNDARY_DELETION_LEDGER = [
  { id: 'queue.rpop.destructive', status: 'already-code-retired', replacement: 'rpoplpush claim/lease' },
  { id: 'queue.ltrim.destructive', status: 'already-code-retired', replacement: 'Lua occupancy + LREM recover' },
  { id: 'materializer.persist-core.bypass', status: 'already-code-retired', replacement: 'ingestLearningFact only' },
  { id: 'historical.online-projection-trigger', status: 'isolated-this-change', replacement: 'facts only; snapshots stay explicit cumulative backfill' },
  { id: 'redis.core-shouldMaterialize', status: 'isolated-this-change', replacement: 'worker still ingestLearningFact; dedupe/collision isolate duplicates without ACK-skip' },
] as const;

export function getWriteBoundaryRow(id: string): WriteBoundaryRow {
  const found = WRITE_BOUNDARY_ROWS.find((item) => item.id === id);
  if (!found) {
    throw new WriteBoundaryError('write-boundary-unclassified', `Unknown write-boundary row: ${id}`);
  }
  return found;
}

export function assertWriteBoundaryRowComplete(item: WriteBoundaryRow): WriteBoundaryRow {
  const required: Array<keyof WriteBoundaryRow> = [
    'id', 'producer', 'entry', 'owner', 'transport', 'canonicalEntry',
    'dedupeIdentity', 'anchors', 'trustedTimes', 'privacyClass',
    'projectionTrigger', 'consumer', 'evidence', 'deletionCondition', 'disposition',
  ];
  for (const key of required) {
    if (!item[key]) {
      throw new WriteBoundaryError('write-boundary-incomplete', `Write-boundary row missing ${key}: ${item.id}`);
    }
  }
  return item;
}

export function listWriteBoundaryEntries(): string[] {
  return [...new Set(WRITE_BOUNDARY_ROWS.map((item) => item.entry))].sort();
}

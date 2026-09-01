/**
 * Closed runtime LearningFact sink classification (#1116).
 *
 * Every non-test LearningFact create/upsert sink must be either:
 * - a governed knowledge-scoped producer (adapter-required), or
 * - an explicit non-knowledge-scoped / historical / fixture classification.
 *
 * Historical migration/backfill writers must route through the Legacy adapter
 * so they cannot mint NULL/unversioned facts outside the authority selector.
 */

export type LearningFactSinkClassification =
  | {
      kind: 'governed-knowledge-scoped';
      id: string;
      path: string;
      adapter: 'canonical-selector';
      sourcePrefixes: readonly string[];
      notes: string;
    }
  | {
      kind: 'non-knowledge-scoped-runtime';
      id: string;
      path: string;
      reason: string;
      forbiddenIdentityMarkers: readonly string[];
    }
  | {
      kind: 'historical-or-backfill';
      id: string;
      path: string;
      reason: string;
      /** Must call Legacy adapter so new rows stamp LEGACY + knowledgeRevisionRef. */
      requiresLegacyAdapter: true;
    }
  | {
      kind: 'fixture-or-test';
      id: string;
      path: string;
      reason: string;
    }
  | {
      kind: 'adapter-implementation';
      id: string;
      path: string;
      reason: string;
    };

/**
 * Closed inventory of known LearningFact sink owners. The static gate discovers
 * additional create/upsert call sites and fails if any executable sink is missing.
 */
export const LEARNING_FACT_SINK_INVENTORY: readonly LearningFactSinkClassification[] = [
  {
    kind: 'adapter-implementation',
    id: 'canonical-learning-fact-writer',
    path: 'src/lib/canonical-learning-fact-identity/writer.ts',
    reason: 'controlled-adapter-sink',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'core-event-materialization',
    path: 'src/lib/data-governance/learning-fact-materialization.ts',
    adapter: 'canonical-selector',
    // Core materialization persists LearningEvent.eventId as sourceEventId (raw).
    // Post-cutover Canonical admission will use producer-specific allowed prefixes.
    sourcePrefixes: [],
    notes: 'Core LearningEvent materialization; sourceEventId = event.eventId (unprefixed).',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'data-governance-worker-event-ingestion',
    path: 'scripts/workers/data-governance-worker.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: [],
    notes: 'Realtime event ingestion job; same sourceEventId contract as core materialization.',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'arena-official-writeback',
    path: 'src/features/arena/evidence-writeback-persistence.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: ['arena-official'],
    notes: 'Official Arena writeback; sourceEventId = arena-official:… dedupe key.',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'control-correction-path-rounds',
    path: 'src/features/personalization/path-planning/control-correction-path-rounds.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: ['control-correction-path', 'learning-path'],
    notes: 'Path choice evidence; sourceEventId = {dedupePrefix}:choice:…',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'document-rubric-grading-workbench',
    path: 'src/lib/data-governance/document-rubric-grading-workbench.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: ['grading'],
    notes: 'Teacher-approved document rubric facts; sourceEventId = grading:…',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'document-grading-approve-route',
    path: 'src/app/api/teacher/document-grading/approve/route.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: ['adaptive-assessment', 'document-rubric-grading'],
    notes: 'Approve route; pipeline facts use adaptive-assessment:document-rubric-grading:…',
  },
  {
    kind: 'governed-knowledge-scoped',
    id: 'simulation-agent-evidence',
    path: 'src/lib/data-governance/simulation-agent-evidence-materialization.ts',
    adapter: 'canonical-selector',
    sourcePrefixes: ['simulation-agent-evidence'],
    notes: 'Simulation agent evidence; sourceEventId = simulation-agent-evidence:…',
  },
  {
    kind: 'non-knowledge-scoped-runtime',
    id: 'simulation-task-learning-fact',
    path: 'src/lib/data-governance/simulation-task-learning-fact.ts',
    reason: 'task-metric-evidence-without-knowledge-object-identity',
    forbiddenIdentityMarkers: [
      'knowledgeIdentityNamespace',
      'canonicalObjectId',
      'aggregateReleaseSetId',
      'knowledgeNodeIds',
      'knowledgeRevisionRef',
    ],
  },
  {
    kind: 'historical-or-backfill',
    id: 'historical-evidence-materialization',
    path: 'src/lib/data-governance/historical-evidence-materialization.ts',
    reason: 'historical-backfill',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'course-evidence-backfill',
    path: 'src/lib/data-governance/course-evidence-backfill.ts',
    reason: 'historical-backfill',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'interactive-scoring-recompute',
    path: 'src/lib/data-governance/interactive-evidence-scoring-recompute.ts',
    reason: 'score-recompute-update-only',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'backfill-learning-facts-from-event-batches',
    path: 'scripts/db/backfill-learning-facts-from-event-batches.ts',
    reason: 'executable-package-script-db-backfill-facts',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'backfill-learning-facts-from-interaction-logs',
    path: 'scripts/db/backfill-learning-facts-from-interaction-logs.ts',
    reason: 'executable-historical-interaction-log-backfill',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'backfill-unit-4-1-growth-governance',
    path: 'scripts/db/backfill-unit-4-1-growth-governance.ts',
    reason: 'executable-package-script-db-backfill-unit-4-1-growth',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'historical-or-backfill',
    id: 'migrate-to-learning-facts',
    path: 'scripts/migrations/002-migrate-to-learning-facts.ts',
    reason: 'executable-package-script-migrate-facts',
    requiresLegacyAdapter: true,
  },
  {
    kind: 'fixture-or-test',
    id: 'yangfan-diagnostic-fixture',
    path: 'src/lib/data-governance/yangfan-diagnostic-fixture.ts',
    reason: 'fixture-only',
  },
] as const;

/** @deprecated use listGovernedKnowledgeScopedProducers */
export const KNOWLEDGE_SCOPED_LEARNING_FACT_PRODUCERS = LEARNING_FACT_SINK_INVENTORY
  .filter((item): item is Extract<LearningFactSinkClassification, { kind: 'governed-knowledge-scoped' }> => (
    item.kind === 'governed-knowledge-scoped'
  ))
  .map((item) => ({
    id: item.id,
    path: item.path,
    adapter: item.adapter,
    sourcePrefixes: item.sourcePrefixes,
    notes: item.notes,
  }));

export const NON_FORMAL_LEARNING_FACT_WRITERS = LEARNING_FACT_SINK_INVENTORY
  .filter((item) => (
    item.kind === 'non-knowledge-scoped-runtime'
    || item.kind === 'historical-or-backfill'
    || item.kind === 'fixture-or-test'
  ))
  .map((item) => ({
    id: item.id,
    path: item.path,
    reason: item.reason,
  }));

export function listGovernedKnowledgeScopedProducers() {
  return LEARNING_FACT_SINK_INVENTORY.filter(
    (item): item is Extract<LearningFactSinkClassification, { kind: 'governed-knowledge-scoped' }> => (
      item.kind === 'governed-knowledge-scoped'
    ),
  );
}

export function listHistoricalBackfillWriters() {
  return LEARNING_FACT_SINK_INVENTORY.filter(
    (item): item is Extract<LearningFactSinkClassification, { kind: 'historical-or-backfill' }> => (
      item.kind === 'historical-or-backfill'
    ),
  );
}

export function listKnowledgeScopedLearningFactProducerPaths(): string[] {
  return listGovernedKnowledgeScopedProducers().map((item) => item.path).sort();
}

export function findInventoryEntryByPath(
  filePath: string,
): LearningFactSinkClassification | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  return LEARNING_FACT_SINK_INVENTORY.find(
    (item) => item.path === normalized || normalized.endsWith(item.path),
  );
}

export function isNonFormalLearningFactWriter(path: string): boolean {
  const entry = findInventoryEntryByPath(path);
  return Boolean(
    entry
    && entry.kind !== 'governed-knowledge-scoped'
    && entry.kind !== 'adapter-implementation',
  );
}

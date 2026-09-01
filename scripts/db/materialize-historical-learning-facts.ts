import { createPrismaClient } from '../../src/lib/prisma-client';

import {
  applyHistoricalEvidenceMaterializationPlan,
  buildHistoricalEvidenceMaterializationPlan,
  type HistoricalEvidenceMaterializationApplyResult,
  type HistoricalEvidenceMaterializationCandidate,
  type HistoricalEvidenceMaterializationPlan,
  type HistoricalEvidenceMaterializationSkip,
} from '@/lib/data-governance/historical-evidence-materialization';
import {
  getEvidenceSourceCatalog,
  type EvidenceCoverageRow,
  type EvidenceSourceId,
} from '@/lib/data-governance/evidence-source-catalog';

const prisma = createPrismaClient();
const DEFAULT_BATCH_SIZE = 1000;
const SOURCE_PROCESSING_ORDER: EvidenceSourceId[] = [
  'StudentStepResponse',
  'InteractionLog',
  'SimulationLog',
  'UserAnswer',
  'AbilityAssessment',
  'PromptAssessment',
  'DesignSession',
  'ArenaSubmission',
  'ArenaEvaluationRun',
  'LearningFact',
];

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readArg(name: string) {
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(`${name}=`.length).trim();
  const index = process.argv.indexOf(name);
  if (index >= 0) return (process.argv[index + 1] ?? '').trim();
  return '';
}

function readBatchSize() {
  const value = process.argv.find((argument) => argument.startsWith('--batch-size='));
  if (!value) return DEFAULT_BATCH_SIZE;

  const parsed = Number(value.slice('--batch-size='.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_BATCH_SIZE;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function compactSourceLabel(...values: unknown[]): string | null {
  return values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .find(Boolean) ?? null;
}

function printTextReport(
  plan: HistoricalEvidenceMaterializationPlan,
  applyResult: HistoricalEvidenceMaterializationApplyResult | null,
) {
  console.log(`Historical evidence materialization report (${plan.generatedAt})`);
  console.log(`Mode: ${applyResult ? 'apply' : 'dry-run'}`);
  console.log('');
  console.log(`Total rows: ${plan.totals.totalRows}`);
  console.log(`Candidate rows: ${plan.totals.candidateRows}`);
  console.log(`New fact rows: ${plan.totals.newFactRows}`);
  console.log(`Already materialized rows: ${plan.totals.alreadyMaterializedRows}`);
  console.log(`Excluded rows: ${plan.totals.excludedRows}`);
  console.log(`Unsupported rows: ${plan.totals.unsupportedRows}`);
  console.log(`Low-confidence rows: ${plan.totals.lowConfidenceRows}`);
  console.log(`Affected users: ${plan.totals.affectedUsers}`);

  if (applyResult) {
    console.log(`Requested create rows: ${applyResult.requestedCreateRows}`);
    console.log(`Created rows: ${applyResult.createdRows}`);
  }

  for (const source of plan.sources) {
    if (source.totalRows === 0) continue;
    console.log('');
    console.log(source.sourceId);
    console.log(`  rows: ${source.totalRows}, candidates: ${source.candidateRows}, new: ${source.newFactRows}, already: ${source.alreadyMaterializedRows}`);
    console.log(`  excluded: ${source.excludedRows}, unsupported: ${source.unsupportedRows}, low-confidence: ${source.lowConfidenceRows}`);
    console.log(`  users: ${source.affectedUsers}, window: ${source.firstObservedAt ?? '-'} -> ${source.lastObservedAt ?? '-'}`);
    console.log(`  samples: ${source.sampleTraceReferences.join(', ') || '-'}`);
  }

  if (plan.skipped.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const item of plan.skipped) {
      reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1);
    }
    console.log('');
    console.log('Skipped reasons:');
    for (const [reason, count] of [...reasonCounts.entries()].sort((left, right) => right[1] - left[1])) {
      console.log(`  ${reason}: ${count}`);
    }
  }
}

type IdPageArgs = {
  take: number;
  orderBy: { id: 'asc' };
  cursor?: { id: string };
  skip?: number;
};

interface SourcePlanSummaryAccumulator {
  sourceId: EvidenceSourceId;
  totalRows: number;
  candidateRows: number;
  newFactRows: number;
  alreadyMaterializedRows: number;
  excludedRows: number;
  unsupportedRows: number;
  lowConfidenceRows: number;
  affectedUsers: Set<string>;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  sampleTraceReferences: string[];
}

interface AggregatePlanState {
  generatedAt: string;
  candidates: HistoricalEvidenceMaterializationCandidate[];
  skipped: HistoricalEvidenceMaterializationSkip[];
  sourceSummaries: Map<EvidenceSourceId, SourcePlanSummaryAccumulator>;
  plannedSourceEventIds: Set<string>;
}

function emptySourceAccumulator(sourceId: EvidenceSourceId): SourcePlanSummaryAccumulator {
  return {
    sourceId,
    totalRows: 0,
    candidateRows: 0,
    newFactRows: 0,
    alreadyMaterializedRows: 0,
    excludedRows: 0,
    unsupportedRows: 0,
    lowConfidenceRows: 0,
    affectedUsers: new Set(),
    firstObservedAt: null,
    lastObservedAt: null,
    sampleTraceReferences: [],
  };
}

function createAggregatePlanState(): AggregatePlanState {
  return {
    generatedAt: new Date().toISOString(),
    candidates: [],
    skipped: [],
    sourceSummaries: new Map(
      getEvidenceSourceCatalog().map((source) => [source.id, emptySourceAccumulator(source.id)]),
    ),
    plannedSourceEventIds: new Set(),
  };
}

function getSourceAccumulator(state: AggregatePlanState, sourceId: EvidenceSourceId) {
  const existing = state.sourceSummaries.get(sourceId);
  if (existing) return existing;

  const created = emptySourceAccumulator(sourceId);
  state.sourceSummaries.set(sourceId, created);
  return created;
}

function updateSourceWindow(
  summary: SourcePlanSummaryAccumulator,
  firstObservedAt: string | null,
  lastObservedAt: string | null,
) {
  if (firstObservedAt && (!summary.firstObservedAt || firstObservedAt < summary.firstObservedAt)) {
    summary.firstObservedAt = firstObservedAt;
  }
  if (lastObservedAt && (!summary.lastObservedAt || lastObservedAt > summary.lastObservedAt)) {
    summary.lastObservedAt = lastObservedAt;
  }
}

function addCandidateToSummary(
  summary: SourcePlanSummaryAccumulator,
  candidate: HistoricalEvidenceMaterializationCandidate,
) {
  summary.candidateRows += 1;
  if (candidate.alreadyMaterialized) {
    summary.alreadyMaterializedRows += 1;
  } else {
    summary.newFactRows += 1;
  }
  summary.affectedUsers.add(candidate.userId);
}

function addSkipToSummary(
  summary: SourcePlanSummaryAccumulator,
  skipped: HistoricalEvidenceMaterializationSkip,
) {
  if (skipped.eligibility === 'unsupported') {
    summary.unsupportedRows += 1;
  } else if (skipped.reason === 'unknown_provenance') {
    summary.lowConfidenceRows += 1;
  } else {
    summary.excludedRows += 1;
  }
}

function duplicateSkipFromCandidate(
  candidate: HistoricalEvidenceMaterializationCandidate,
): HistoricalEvidenceMaterializationSkip {
  return {
    sourceId: candidate.sourceId,
    sourceRecordId: candidate.sourceRecordId,
    traceReference: candidate.traceReference,
    reason: 'duplicate_canonical_source',
    provenance: candidate.provenance,
    eligibility: candidate.eligibility,
    valueLevel: candidate.valueLevel,
    userId: candidate.userId,
    canonicalEventType: candidate.canonicalEventType,
  };
}

function mergeBatchPlan(
  state: AggregatePlanState,
  batchPlan: HistoricalEvidenceMaterializationPlan,
) {
  for (const sourceSummary of batchPlan.sources) {
    if (sourceSummary.totalRows === 0) continue;

    const summary = getSourceAccumulator(state, sourceSummary.sourceId);
    summary.totalRows += sourceSummary.totalRows;
    updateSourceWindow(summary, sourceSummary.firstObservedAt, sourceSummary.lastObservedAt);
    for (const sample of sourceSummary.sampleTraceReferences) {
      if (summary.sampleTraceReferences.length >= 5) break;
      summary.sampleTraceReferences.push(sample);
    }
  }

  for (const candidate of batchPlan.candidates) {
    const summary = getSourceAccumulator(state, candidate.sourceId);
    if (state.plannedSourceEventIds.has(candidate.stableSourceIdentity)) {
      const skipped = duplicateSkipFromCandidate(candidate);
      state.skipped.push(skipped);
      addSkipToSummary(summary, skipped);
      continue;
    }

    state.plannedSourceEventIds.add(candidate.stableSourceIdentity);
    state.candidates.push(candidate);
    addCandidateToSummary(summary, candidate);
  }

  for (const skipped of batchPlan.skipped) {
    const summary = getSourceAccumulator(state, skipped.sourceId);
    state.skipped.push(skipped);
    addSkipToSummary(summary, skipped);
  }
}

interface ExistingMaterializedCandidateKeys {
  sourceEventIds: Set<string>;
  sourceLogIds: Set<string>;
}

async function collectExistingMaterializedKeysForCandidates(
  candidates: HistoricalEvidenceMaterializationCandidate[],
  batchSize: number,
) {
  const uniqueSourceEventIds = [...new Set(
    candidates.map((candidate) => candidate.stableSourceIdentity),
  )].filter((value) => value.length > 0);
  const uniqueSourceLogIds = [...new Set(
    candidates
      .map((candidate) => readString(candidate.fact.sourceLogId))
      .filter((value): value is string => Boolean(value)),
  )];
  const existingKeys: ExistingMaterializedCandidateKeys = {
    sourceEventIds: new Set<string>(),
    sourceLogIds: new Set<string>(),
  };

  for (let offset = 0; offset < uniqueSourceEventIds.length; offset += batchSize) {
    const existingFacts = await prisma.learningFact.findMany({
      where: {
        sourceEventId: {
          in: uniqueSourceEventIds.slice(offset, offset + batchSize),
        },
      },
      select: { sourceEventId: true },
    });
    for (const fact of existingFacts) {
      if (fact.sourceEventId) existingKeys.sourceEventIds.add(fact.sourceEventId);
    }
  }

  for (let offset = 0; offset < uniqueSourceLogIds.length; offset += batchSize) {
    const existingFacts = await prisma.learningFact.findMany({
      where: {
        sourceLogId: {
          in: uniqueSourceLogIds.slice(offset, offset + batchSize),
        },
      },
      select: { sourceLogId: true },
    });
    for (const fact of existingFacts) {
      if (fact.sourceLogId) existingKeys.sourceLogIds.add(fact.sourceLogId);
    }
  }

  return existingKeys;
}

function markAlreadyMaterializedCandidates(
  plan: HistoricalEvidenceMaterializationPlan,
  existingKeys: ExistingMaterializedCandidateKeys,
): HistoricalEvidenceMaterializationPlan {
  if (existingKeys.sourceEventIds.size === 0 && existingKeys.sourceLogIds.size === 0) {
    return plan;
  }

  return {
    ...plan,
    candidates: plan.candidates.map((candidate) => {
      const sourceLogId = readString(candidate.fact.sourceLogId);
      return {
        ...candidate,
        alreadyMaterialized: existingKeys.sourceEventIds.has(candidate.stableSourceIdentity)
          || (sourceLogId ? existingKeys.sourceLogIds.has(sourceLogId) : false),
      };
    }),
  };
}

function finalizeAggregatePlan(state: AggregatePlanState): HistoricalEvidenceMaterializationPlan {
  const sources = getEvidenceSourceCatalog().map((source) => {
    const summary = getSourceAccumulator(state, source.id);
    return {
      sourceId: source.id,
      totalRows: summary.totalRows,
      candidateRows: summary.candidateRows,
      newFactRows: summary.newFactRows,
      alreadyMaterializedRows: summary.alreadyMaterializedRows,
      excludedRows: summary.excludedRows,
      unsupportedRows: summary.unsupportedRows,
      lowConfidenceRows: summary.lowConfidenceRows,
      affectedUsers: summary.affectedUsers.size,
      firstObservedAt: summary.firstObservedAt,
      lastObservedAt: summary.lastObservedAt,
      sampleTraceReferences: summary.sampleTraceReferences,
    };
  });
  const affectedUsers = new Set(state.candidates.map((candidate) => candidate.userId));
  const totals = sources.reduce(
    (accumulator, source) => ({
      totalRows: accumulator.totalRows + source.totalRows,
      candidateRows: accumulator.candidateRows + source.candidateRows,
      newFactRows: accumulator.newFactRows + source.newFactRows,
      alreadyMaterializedRows: accumulator.alreadyMaterializedRows + source.alreadyMaterializedRows,
      excludedRows: accumulator.excludedRows + source.excludedRows,
      unsupportedRows: accumulator.unsupportedRows + source.unsupportedRows,
      lowConfidenceRows: accumulator.lowConfidenceRows + source.lowConfidenceRows,
      affectedUsers: affectedUsers.size,
    }),
    {
      totalRows: 0,
      candidateRows: 0,
      newFactRows: 0,
      alreadyMaterializedRows: 0,
      excludedRows: 0,
      unsupportedRows: 0,
      lowConfidenceRows: 0,
      affectedUsers: 0,
    },
  );

  return {
    generatedAt: state.generatedAt,
    mode: 'dry-run',
    candidates: state.candidates,
    skipped: state.skipped,
    sources,
    totals,
  };
}

async function* paginateCoverageRows<T extends { id: string }>(
  fetchPage: (pagination: IdPageArgs) => Promise<T[]>,
  mapRow: (row: T) => EvidenceCoverageRow,
  batchSize: number,
): AsyncGenerator<EvidenceCoverageRow[]> {
  let cursor: string | undefined;

  while (true) {
    const rows = await fetchPage({
      take: batchSize,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (rows.length === 0) return;
    yield rows.map(mapRow);

    cursor = rows[rows.length - 1]?.id;
    if (rows.length < batchSize || !cursor) return;
  }
}

async function* readSourceRowBatches(
  sourceId: EvidenceSourceId,
  batchSize: number,
  frozenCutoff: Date,
): AsyncGenerator<EvidenceCoverageRow[]> {
  if (sourceId === 'InteractionLog') {
    yield* paginateCoverageRows(
      (pagination) => prisma.interactionLog.findMany({
        ...pagination,
        where: { createdAt: { lte: frozenCutoff } },
        select: {
          id: true,
          userId: true,
          resourceId: true,
          resourceKey: true,
          sessionId: true,
          lessonKey: true,
          stepId: true,
          attemptKey: true,
          eventType: true,
          clientEventId: true,
          learningContext: true,
          invalidContextReason: true,
          eventData: true,
          clientEventAt: true,
          createdAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.clientEventAt ?? row.createdAt,
        ingestedAt: row.createdAt,
        eventType: row.eventType,
        eventData: row.eventData,
        resourceId: row.resourceId,
        resourceKey: row.resourceKey,
        sessionId: row.sessionId,
        lessonKey: row.lessonKey,
        stepId: row.stepId,
        attemptKey: row.attemptKey,
        clientEventId: row.clientEventId,
        learningContext: row.learningContext,
        invalidContextReason: row.invalidContextReason,
        sourceLabel: compactSourceLabel(
          readRecord(row.eventData).source,
          readRecord(row.eventData).sourceType,
          readRecord(row.eventData).sourceSystem,
        ),
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'StudentStepResponse') {
    yield* paginateCoverageRows(
      (pagination) => prisma.studentStepResponse.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          sessionId: true,
          lessonKey: true,
          stepId: true,
          attemptKey: true,
          sourceLogId: true,
          clientEventId: true,
          submittedAt: true,
          responseData: true,
        },
      }),
      (row): EvidenceCoverageRow => {
        const responseData = readRecord(row.responseData);
        return {
          id: row.id,
          userId: row.userId,
          occurredAt: row.submittedAt,
          eventData: {
            ...responseData,
            sessionId: row.sessionId,
            lessonKey: row.lessonKey,
            stepId: row.stepId,
            attemptKey: row.attemptKey ?? readString(responseData.attemptKey),
            sourceLogId: row.sourceLogId ?? readString(responseData.sourceLogId),
            clientEventId: row.clientEventId ?? readString(responseData.clientEventId),
          },
        };
      },
      batchSize,
    );
    return;
  }

  if (sourceId === 'SimulationLog') {
    yield* paginateCoverageRows(
      (pagination) => prisma.simulationLog.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          missionId: true,
          sessionId: true,
          inputParams: true,
          metrics: true,
          score: true,
          duration: true,
          createdAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.createdAt,
        eventData: {
          ...readRecord(row.inputParams),
          ...readRecord(row.metrics),
          missionId: row.missionId,
          sessionId: row.sessionId,
          score: row.score,
          durationSeconds: row.duration,
        },
        sourceLabel: compactSourceLabel(
          readRecord(row.inputParams).source,
          readRecord(row.metrics).source,
        ),
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'UserAnswer') {
    yield* paginateCoverageRows(
      (pagination) => prisma.userAnswer.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          questionId: true,
          isCorrect: true,
          timeSpent: true,
          answerGiven: true,
          createdAt: true,
          question: {
            select: {
              source: true,
            },
          },
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.createdAt,
        eventData: {
          questionId: row.questionId,
          isCorrect: row.isCorrect,
          score: row.isCorrect ? 100 : 0,
          timeSpent: row.timeSpent,
          answerGiven: row.answerGiven,
        },
        sourceLabel: row.question.source,
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'AbilityAssessment') {
    yield* paginateCoverageRows(
      (pagination) => prisma.abilityAssessment.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          computationalTheta: true,
          crossDomainTheta: true,
          designTheta: true,
          assessedAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.assessedAt,
        eventData: {
          computationalTheta: row.computationalTheta,
          crossDomainTheta: row.crossDomainTheta,
          designTheta: row.designTheta,
        },
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'PromptAssessment') {
    yield* paginateCoverageRows(
      (pagination) => prisma.promptAssessment.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          sessionId: true,
          structuredData: true,
          overallScore: true,
          createdAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.createdAt,
        eventData: {
          ...readRecord(row.structuredData),
          sessionId: row.sessionId,
          overallScore: row.overallScore,
          score: row.overallScore,
        },
        sourceLabel: compactSourceLabel(row.sessionId, readRecord(row.structuredData).source),
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'DesignSession') {
    yield* paginateCoverageRows(
      (pagination) => prisma.designSession.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          taskType: true,
          designActions: true,
          finalResult: true,
          consistencyScore: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.completedAt ?? row.startedAt,
        eventData: {
          taskType: row.taskType,
          designActions: row.designActions,
          finalResult: row.finalResult,
          consistencyScore: row.consistencyScore,
          score: row.consistencyScore,
        },
        sourceLabel: row.taskType,
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'ArenaSubmission') {
    yield* paginateCoverageRows(
      (pagination) => prisma.arenaSubmission.findMany({
        ...pagination,
        select: {
          id: true,
          userId: true,
          taskId: true,
          classId: true,
          seasonId: true,
          publicationId: true,
          method: true,
          score: true,
          valid: true,
          submittedAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        userId: row.userId,
        occurredAt: row.submittedAt,
        eventData: {
          taskId: row.taskId,
          classId: row.classId,
          seasonId: row.seasonId,
          publicationId: row.publicationId,
          method: row.method,
          score: row.score,
          valid: row.valid,
        },
        sourceLabel: compactSourceLabel(row.publicationId ? 'classroom-publication' : null, row.classId, row.seasonId, row.taskId),
      }),
      batchSize,
    );
    return;
  }

  if (sourceId === 'ArenaEvaluationRun') {
    yield* paginateCoverageRows(
      (pagination) => prisma.arenaEvaluationRun.findMany({
        ...pagination,
        select: {
          id: true,
          taskId: true,
          metadata: true,
          completedAt: true,
        },
      }),
      (row): EvidenceCoverageRow => ({
        id: row.id,
        occurredAt: row.completedAt,
        eventData: row.metadata,
        sourceLabel: compactSourceLabel(readRecord(row.metadata).source, row.taskId),
      }),
      batchSize,
    );
    return;
  }

  yield* paginateCoverageRows(
    (pagination) => prisma.learningFact.findMany({
      ...pagination,
      select: {
        id: true,
        userId: true,
        factType: true,
        sourceEventId: true,
        contextJson: true,
        startedAt: true,
      },
    }),
    (row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.startedAt,
      eventData: row.contextJson,
      sourceLabel: compactSourceLabel(row.factType, row.sourceEventId ?? undefined),
    }),
    batchSize,
  );
}

async function buildPlanFromSourceBatches(
  batchSize: number,
) {
  const state = createAggregatePlanState();
  const frozenCutoff = new Date(state.generatedAt);

  for (const sourceId of SOURCE_PROCESSING_ORDER) {
    for await (const rows of readSourceRowBatches(sourceId, batchSize, frozenCutoff)) {
      const batchPlan = buildHistoricalEvidenceMaterializationPlan({
        generatedAt: state.generatedAt,
        existingSourceEventIds: new Set(),
        rowsBySource: { [sourceId]: rows },
      });
      const existingKeys = await collectExistingMaterializedKeysForCandidates(
        batchPlan.candidates,
        batchSize,
      );
      mergeBatchPlan(state, markAlreadyMaterializedCandidates(batchPlan, existingKeys));
    }
  }

  return finalizeAggregatePlan(state);
}

async function main() {
  const isApply = hasFlag('--apply');
  const batchSize = readBatchSize();
  const plan = await buildPlanFromSourceBatches(batchSize);
  const applyResult = isApply
    ? await applyHistoricalEvidenceMaterializationPlan(prisma, plan, {
      batchSize,
      operationId: readArg('--operation-id'),
      authorizedBy: readArg('--authorize'),
      frozenCutoff: plan.generatedAt,
    })
    : null;

  if (hasFlag('--json')) {
    console.log(JSON.stringify({ plan, applyResult }, null, hasFlag('--compact') ? 0 : 2));
    return;
  }

  printTextReport(plan, applyResult);
}

main()
  .catch((error) => {
    console.error('[HistoricalEvidenceMaterialization] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

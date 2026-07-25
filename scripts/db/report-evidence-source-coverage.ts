import { createPrismaClient } from '../../src/lib/prisma-client';

import {
  buildEvidenceSourceCoverageReport,
  type EvidenceCoverageRow,
  type EvidenceSourceCoverageReport,
} from '@/lib/data-governance/evidence-source-catalog';

const prisma = createPrismaClient();

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactSourceLabel(...values: unknown[]): string | null {
  return values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .find(Boolean) ?? null;
}

function printTextReport(report: EvidenceSourceCoverageReport) {
  console.log(`Evidence source coverage report (${report.generatedAt})`);
  console.log(`Catalog version: ${report.catalogVersion}`);
  console.log('');
  console.log(`Total rows: ${report.totals.totalRows}`);
  console.log(`Eligible rows: ${report.totals.eligibleRows}`);
  console.log(`Excluded rows: ${report.totals.excludedRows}`);
  console.log(`Unsupported rows: ${report.totals.unsupportedRows}`);
  console.log(`Affected users: ${report.totals.affectedUsers}`);
  console.log('');

  for (const source of report.sources) {
    console.log(`${source.sourceId}`);
    console.log(`  scope: ${source.learningScope}`);
    console.log(`  rows: ${source.totalRows}, eligible: ${source.eligibleRows}, excluded: ${source.excludedRows}, unsupported: ${source.unsupportedRows}`);
    console.log(`  users: ${source.affectedUsers}, window: ${source.firstObservedAt ?? '-'} -> ${source.lastObservedAt ?? '-'}`);
    console.log(`  provenance: ${JSON.stringify(source.provenanceCounts)}`);
    console.log(`  samples: ${source.sampleSourceReferences.join(', ') || '-'}`);
  }

  if (report.exclusions.length > 0) {
    console.log('');
    console.log('Exclusions');
    for (const exclusion of report.exclusions) {
      console.log(`  ${exclusion.sourceId} ${exclusion.reason}: rows=${exclusion.rowCount}, users=${exclusion.affectedUsers}, sample=${exclusion.sampleSourceReference ?? '-'}`);
    }
  }
}

async function collectRows() {
  const [
    interactionLogs,
    studentStepResponses,
    simulationSessions,
    simulationRuns,
    simulationLogs,
    userAnswers,
    abilityAssessments,
    promptAssessments,
    designSessions,
    arenaBlackBoxExperiments,
    arenaVirtualSimulationRuns,
    arenaSubmissions,
    arenaEvaluationRuns,
    learningFacts,
  ] = await Promise.all([
    prisma.interactionLog.findMany({
      select: {
        id: true,
        userId: true,
        eventType: true,
        eventData: true,
        clientEventAt: true,
        createdAt: true,
      },
    }),
    prisma.studentStepResponse.findMany({
      select: {
        id: true,
        userId: true,
        submittedAt: true,
      },
    }),
    prisma.simulationSession.findMany({
      select: {
        id: true,
        userId: true,
        module: true,
        simType: true,
        inputParams: true,
        artifacts: true,
        createdAt: true,
      },
    }),
    prisma.simulationRun.findMany({
      select: {
        id: true,
        ownerUserId: true,
        resourceId: true,
        taskSpecId: true,
        taskSpecSnapshot: true,
        sourceDomain: true,
        sourceRefId: true,
        summary: true,
        completedAt: true,
      },
    }),
    prisma.simulationLog.findMany({
      select: {
        id: true,
        userId: true,
        inputParams: true,
        metrics: true,
        createdAt: true,
      },
    }),
    prisma.userAnswer.findMany({
      select: {
        id: true,
        userId: true,
        createdAt: true,
        question: {
          select: {
            source: true,
          },
        },
      },
    }),
    prisma.abilityAssessment.findMany({
      select: {
        id: true,
        userId: true,
        assessedAt: true,
      },
    }),
    prisma.promptAssessment.findMany({
      select: {
        id: true,
        userId: true,
        sessionId: true,
        structuredData: true,
        createdAt: true,
      },
    }),
    prisma.designSession.findMany({
      select: {
        id: true,
        userId: true,
        taskType: true,
        designActions: true,
        startedAt: true,
      },
    }),
    prisma.arenaBlackBoxExperiment.findMany({
      select: {
        id: true,
        userId: true,
        taskId: true,
        signalType: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.arenaVirtualSimulationRun.findMany({
      select: {
        id: true,
        userId: true,
        taskId: true,
        datasetHash: true,
        controllerHash: true,
        scenarioId: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.arenaSubmission.findMany({
      select: {
        id: true,
        userId: true,
        taskId: true,
        classId: true,
        seasonId: true,
        publicationId: true,
        submittedAt: true,
      },
    }),
    prisma.arenaEvaluationRun.findMany({
      select: {
        id: true,
        taskId: true,
        metadata: true,
        completedAt: true,
      },
    }),
    prisma.learningFact.findMany({
      select: {
        id: true,
        userId: true,
        factType: true,
        sourceEventId: true,
        contextJson: true,
        startedAt: true,
      },
    }),
  ]);

  return {
    InteractionLog: interactionLogs.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.clientEventAt ?? row.createdAt,
      eventType: row.eventType,
      eventData: row.eventData,
      sourceLabel: compactSourceLabel(
        readRecord(row.eventData).source,
        readRecord(row.eventData).sourceType,
        readRecord(row.eventData).sourceSystem,
      ),
    })),
    StudentStepResponse: studentStepResponses.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.submittedAt,
    })),
    SimulationSession: simulationSessions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: {
        module: row.module,
        simType: row.simType,
        inputParams: row.inputParams,
        artifacts: row.artifacts,
      },
      sourceLabel: compactSourceLabel(
        readRecord(row.inputParams).source,
        readRecord(row.artifacts).source,
        row.module,
        row.simType,
      ),
    })),
    SimulationRun: simulationRuns.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.ownerUserId,
      occurredAt: row.completedAt,
      eventData: {
        resourceId: row.resourceId,
        taskSpecId: row.taskSpecId,
        taskSpecSnapshot: row.taskSpecSnapshot,
        summary: row.summary,
      },
      sourceLabel: compactSourceLabel(row.sourceDomain, row.sourceRefId, row.resourceId),
    })),
    SimulationLog: simulationLogs.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: {
        inputParams: row.inputParams,
        metrics: row.metrics,
      },
      sourceLabel: compactSourceLabel(
        readRecord(row.inputParams).source,
        readRecord(row.metrics).source,
      ),
    })),
    UserAnswer: userAnswers.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      sourceLabel: row.question.source,
    })),
    AbilityAssessment: abilityAssessments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.assessedAt,
    })),
    PromptAssessment: promptAssessments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: row.structuredData,
      sourceLabel: compactSourceLabel(row.sessionId, readRecord(row.structuredData).source),
    })),
    DesignSession: designSessions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.startedAt,
      eventData: { designActions: row.designActions },
      sourceLabel: row.taskType,
    })),
    ArenaBlackBoxExperiment: arenaBlackBoxExperiments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: row.payload,
      sourceLabel: compactSourceLabel(readRecord(row.payload).source, row.signalType, row.taskId),
    })),
    ArenaVirtualSimulationRun: arenaVirtualSimulationRuns.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: row.payload,
      sourceLabel: compactSourceLabel(
        readRecord(row.payload).source,
        row.scenarioId,
        row.taskId,
        row.datasetHash,
        row.controllerHash,
      ),
    })),
    ArenaSubmission: arenaSubmissions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.submittedAt,
      sourceLabel: compactSourceLabel(row.publicationId ? 'classroom-publication' : null, row.classId, row.seasonId, row.taskId),
    })),
    ArenaEvaluationRun: arenaEvaluationRuns.map((row): EvidenceCoverageRow => ({
      id: row.id,
      occurredAt: row.completedAt,
      eventData: row.metadata,
      sourceLabel: compactSourceLabel(readRecord(row.metadata).source, row.taskId),
    })),
    LearningFact: learningFacts.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.startedAt,
      eventData: row.contextJson,
      sourceLabel: compactSourceLabel(row.factType, row.sourceEventId ?? undefined),
    })),
  };
}

async function main() {
  const rowsBySource = await collectRows();
  const report = buildEvidenceSourceCoverageReport({ rowsBySource });

  if (hasFlag('--text')) {
    printTextReport(report);
  } else {
    console.log(JSON.stringify(report, null, hasFlag('--compact') ? 0 : 2));
  }
}

main()
  .catch((error) => {
    console.error('[EvidenceSourceCoverage] Report failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

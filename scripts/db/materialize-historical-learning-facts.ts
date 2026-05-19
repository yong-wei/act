import { PrismaClient } from '@prisma/client';

import {
  applyHistoricalEvidenceMaterializationPlan,
  buildHistoricalEvidenceMaterializationPlan,
  type HistoricalEvidenceMaterializationApplyResult,
  type HistoricalEvidenceMaterializationPlan,
} from '@/lib/data-governance/historical-evidence-materialization';
import type { EvidenceCoverageRow } from '@/lib/data-governance/evidence-source-catalog';

const prisma = new PrismaClient();

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

async function collectExistingSourceEventIds() {
  const existingFacts = await prisma.learningFact.findMany({
    where: { sourceEventId: { startsWith: 'historical:' } },
    select: { sourceEventId: true },
  });
  return new Set(
    existingFacts
      .map((fact) => fact.sourceEventId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
}

async function collectRows() {
  const [
    interactionLogs,
    studentStepResponses,
    simulationLogs,
    userAnswers,
    abilityAssessments,
    promptAssessments,
    designSessions,
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
    prisma.simulationLog.findMany({
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
    prisma.userAnswer.findMany({
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
    prisma.abilityAssessment.findMany({
      select: {
        id: true,
        userId: true,
        computationalTheta: true,
        crossDomainTheta: true,
        designTheta: true,
        assessedAt: true,
      },
    }),
    prisma.promptAssessment.findMany({
      select: {
        id: true,
        userId: true,
        sessionId: true,
        structuredData: true,
        overallScore: true,
        createdAt: true,
      },
    }),
    prisma.designSession.findMany({
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
    prisma.arenaSubmission.findMany({
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
      eventData: {
        ...readRecord(row.responseData),
        sessionId: row.sessionId,
        lessonKey: row.lessonKey,
        stepId: row.stepId,
        attemptKey: row.attemptKey,
        sourceLogId: row.sourceLogId,
        clientEventId: row.clientEventId,
      },
    })),
    SimulationLog: simulationLogs.map((row): EvidenceCoverageRow => ({
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
    })),
    UserAnswer: userAnswers.map((row): EvidenceCoverageRow => ({
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
    })),
    AbilityAssessment: abilityAssessments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.assessedAt,
      eventData: {
        computationalTheta: row.computationalTheta,
        crossDomainTheta: row.crossDomainTheta,
        designTheta: row.designTheta,
      },
    })),
    PromptAssessment: promptAssessments.map((row): EvidenceCoverageRow => ({
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
    })),
    DesignSession: designSessions.map((row): EvidenceCoverageRow => ({
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
    })),
    ArenaSubmission: arenaSubmissions.map((row): EvidenceCoverageRow => ({
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
  const isApply = hasFlag('--apply');
  const rowsBySource = await collectRows();
  const existingSourceEventIds = await collectExistingSourceEventIds();
  const plan = buildHistoricalEvidenceMaterializationPlan({
    rowsBySource,
    existingSourceEventIds,
  });
  const applyResult = isApply
    ? await applyHistoricalEvidenceMaterializationPlan(prisma, plan)
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

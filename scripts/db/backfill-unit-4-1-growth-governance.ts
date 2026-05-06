import { PrismaClient, type Prisma } from '@prisma/client';

import {
  calculateCompetencyVector,
  calculateTrendVector,
  generateEvidenceSummary,
} from '@/lib/data-governance/competency-engine';
import {
  COMPETENCY_DIMENSIONS,
  calculateOverallScore,
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import { refreshStudentGrowthEvaluation } from '@/lib/data-governance/growth-evaluation';
import { buildUNIT41SubmissionTelemetry } from '@/lib/data-governance/unit-4-1-submission-telemetry';

const prisma = new PrismaClient();
const DEFAULT_SESSION_ID = 'cmotfl8jz000ulndce351rym9';
const LESSON_KEY = 'unit-4-1-design-task-expression-v1';
const isDryRun = process.argv.includes('--dry-run');
const forceSnapshots = process.argv.includes('--force-snapshots');

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  if (index >= 0) {
    return process.argv[index + 1] ?? null;
  }

  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readAnswers(value: unknown): Record<string, string> | null {
  const record = readRecord(value);
  const entries = Object.entries(record)
    .filter(([, answer]) => typeof answer === 'string')
    .map(([key, answer]) => [key, answer as string]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function readUnit41Responses(stateData: unknown) {
  const data = readRecord(stateData);
  if (data.kind !== 'unit41_student_state') {
    return {};
  }

  const responses = readRecord(data.responses);
  return Object.fromEntries(Object.entries(responses).flatMap(([stepId, value]) => {
    const response = readRecord(value);
    const submittedAt = readNumber(response.submittedAt);
    const answers = readAnswers(response.answers);
    if (!submittedAt || !answers) {
      return [];
    }
    return [[stepId, { stepId, submittedAt, answers }]];
  }));
}

function buildEvidenceDetails(logs: Array<{ id: string; stepId: string | null; eventData: unknown }>) {
  return Object.fromEntries(logs.map((log) => {
    const eventData = readRecord(log.eventData);
    const questionSummaries = Array.isArray(eventData.questionSummaries)
      ? eventData.questionSummaries.filter((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
      : undefined;
    return [log.id, {
      evidenceTitle: readString(eventData.evidenceTitle),
      stepId: log.stepId ?? readString(eventData.stepId),
      questionSummaries,
    }];
  }));
}

async function refreshStudentSnapshot(userId: string, evidenceDetails: ReturnType<typeof buildEvidenceDetails>) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const facts = await prisma.learningFact.findMany({
    where: {
      userId,
      startedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { startedAt: 'desc' },
  });
  const competencyVector = calculateCompetencyVector(facts, '1m');
  const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: 'desc' },
  });
  const latestFactCreatedAt = facts.reduce<Date | null>((latest, fact) => {
    if (!latest || fact.createdAt.getTime() > latest.getTime()) {
      return fact.createdAt;
    }
    return latest;
  }, null);

  if (facts.length === 0) {
    return { snapshotId: null, factCount: 0, skipped: 'no_facts' };
  }

  if (
    !forceSnapshots &&
    previousSnapshot &&
    previousSnapshot.factCount === facts.length &&
    latestFactCreatedAt &&
    latestFactCreatedAt.getTime() <= previousSnapshot.snapshotAt.getTime()
  ) {
    return { snapshotId: null, factCount: facts.length, skipped: 'unchanged_facts' };
  }

  if (previousSnapshot) {
    const trendVector = calculateTrendVector(
      competencyVector,
      previousSnapshot.competencyVector as unknown as CompetencyVector,
    );
    for (const dimension of COMPETENCY_DIMENSIONS) {
      competencyVector[dimension].trend = trendVector[dimension];
    }
  }

  if (isDryRun) {
    return { snapshotId: null, factCount: facts.length, skipped: null };
  }

  const snapshotAt = new Date();
  const snapshot = await prisma.studentCompetencySnapshot.create({
    data: {
      userId,
      snapshotAt,
      competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
      evidenceSummary: generateEvidenceSummary(facts, 3, evidenceDetails) as unknown as Prisma.InputJsonValue,
      riskFlags: [],
      factCount: facts.length,
    },
  });

  await refreshStudentGrowthEvaluation(prisma, {
    snapshot: {
      id: snapshot.id,
      userId,
      snapshotAt,
      factCount: facts.length,
      competencyVector,
      evidenceSummary: snapshot.evidenceSummary,
    },
  });

  return { snapshotId: snapshot.id, factCount: facts.length, skipped: null };
}

function calculateClassAggregate(snapshots: Array<{ competencyVector: unknown }>) {
  const vectors = snapshots.map((snapshot) => snapshot.competencyVector as CompetencyVector);
  const aggregate: Record<string, { mean: number; stdDev: number }> = {};

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const scores = vectors.map((vector) => vector[dimension].score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    aggregate[dimension] = {
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    };
  }

  return aggregate;
}

function calculateLevelDistribution(snapshots: Array<{ competencyVector: unknown }>) {
  const levels = { excellent: 0, good: 0, average: 0, needsImprovement: 0, atRisk: 0 };
  for (const snapshot of snapshots) {
    const avg = calculateOverallScore(snapshot.competencyVector as CompetencyVector);
    if (avg >= 85) levels.excellent += 1;
    else if (avg >= 70) levels.good += 1;
    else if (avg >= 55) levels.average += 1;
    else if (avg >= 40) levels.needsImprovement += 1;
    else levels.atRisk += 1;
  }
  return levels;
}

function calculateClassTrend(
  current: Record<string, { mean: number; stdDev: number }>,
  previous: unknown,
) {
  const previousAggregate = readRecord(previous);
  return Object.fromEntries(Object.entries(current).map(([dimension, value]) => {
    const previousValue = readRecord(previousAggregate[dimension]);
    const previousMean = typeof previousValue.mean === 'number' ? previousValue.mean : value.mean;
    const delta = Math.round((value.mean - previousMean) * 10) / 10;
    return [dimension, {
      previousMean,
      currentMean: value.mean,
      delta,
      direction: delta > 3 ? 'up' : delta < -3 ? 'down' : 'stable',
    }];
  }));
}

function isSameClassAggregate(
  current: Record<string, { mean: number; stdDev: number }>,
  previous: unknown,
) {
  const previousAggregate = readRecord(previous);
  return Object.entries(current).every(([dimension, value]) => {
    const previousValue = readRecord(previousAggregate[dimension]);
    return previousValue.mean === value.mean && previousValue.stdDev === value.stdDev;
  });
}

async function refreshClassSnapshot(classId: string, userIds: string[]) {
  const snapshots = await Promise.all(userIds.map((userId) =>
    prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    }),
  ));
  const validSnapshots = snapshots.filter((snapshot) => Boolean(snapshot) && snapshot!.factCount > 0) as Array<{ competencyVector: unknown; riskFlags: unknown }>;
  if (validSnapshots.length === 0 || isDryRun) {
    return { snapshotId: null, studentCount: validSnapshots.length };
  }

  const aggregate = calculateClassAggregate(validSnapshots);
  const distribution = calculateLevelDistribution(validSnapshots);
  const previousSnapshot = await prisma.classCompetencySnapshot.findFirst({
    where: { classId },
    orderBy: { snapshotAt: 'desc' },
  });
  if (previousSnapshot && isSameClassAggregate(aggregate, previousSnapshot.aggregateJson)) {
    return { snapshotId: previousSnapshot.id, studentCount: validSnapshots.length, skipped: 'unchanged_aggregate' };
  }
  const snapshot = await prisma.classCompetencySnapshot.create({
    data: {
      classId,
      snapshotAt: new Date(),
      aggregateJson: aggregate as unknown as Prisma.InputJsonValue,
      distributionJson: distribution as unknown as Prisma.InputJsonValue,
      trendJson: calculateClassTrend(aggregate, previousSnapshot?.aggregateJson) as Prisma.InputJsonValue,
      riskSummaryJson: {} as Prisma.InputJsonValue,
      levelDistribution: distribution as unknown as Prisma.InputJsonValue,
      activeStudentCount: validSnapshots.length,
      totalStudentCount: userIds.length,
    },
  });
  return { snapshotId: snapshot.id, studentCount: validSnapshots.length };
}

async function main() {
  const sessionId = getArgValue('--session-id') ?? DEFAULT_SESSION_ID;
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true },
  });
  if (!session) {
    throw new Error(`ClassSession not found: ${sessionId}`);
  }

  const states = await prisma.studentState.findMany({
    where: {
      sessionId,
      stateKey: 'course',
    },
    select: { userId: true, data: true },
  });
  const responsesByUser = new Map(states.map((state) => [state.userId, readUnit41Responses(state.data)]));
  const userIds = Array.from(responsesByUser.keys());

  const logs = await prisma.interactionLog.findMany({
    where: {
      sessionId,
      lessonKey: LESSON_KEY,
      actorRole: 'student',
      OR: [
        { eventData: { path: ['eventType'], equals: 'lesson_submit' } },
        { eventData: { path: ['eventType'], equals: 'lesson_resubmit' } },
      ],
    },
    orderBy: { clientEventAt: 'asc' },
    select: {
      id: true,
      userId: true,
      stepId: true,
      lessonKey: true,
      eventData: true,
      clientEventAt: true,
      createdAt: true,
    },
  });
  const existingFacts = await prisma.learningFact.findMany({
    where: { sessionId },
  });
  const factsBySourceLogId = new Map(
    existingFacts
      .filter((fact) => fact.sourceLogId)
      .map((fact) => [fact.sourceLogId as string, fact]),
  );
  const factsBySourceEventId = new Map(
    existingFacts
      .filter((fact) => fact.sourceEventId)
      .map((fact) => [fact.sourceEventId as string, fact]),
  );

  let logsToUpdate = 0;
  let factsToUpdate = 0;
  let factsToCreate = 0;
  let missingResponse = 0;
  let missingFactsToDowngrade = 0;

  for (const log of logs) {
    const eventData = readRecord(log.eventData);
    const stepId = log.stepId ?? readString(eventData.stepId);
    const response = stepId ? responsesByUser.get(log.userId)?.[stepId] : undefined;
    const sourceEventId = readString(eventData.clientEventId) ?? `interaction-log:${log.id}`;
    const existingFact = factsBySourceLogId.get(log.id) ?? factsBySourceEventId.get(sourceEventId);

    if (!stepId || !response) {
      missingResponse += 1;
      if (!stepId || !existingFact) {
        continue;
      }

      logsToUpdate += 1;
      missingFactsToDowngrade += 1;
      if (isDryRun) {
        continue;
      }

      await prisma.interactionLog.update({
        where: { id: log.id },
        data: {
          eventData: {
            ...eventData,
            moduleId: stepId,
            evidenceTitle: `4-1 ${stepId} 提交（缺少作答明细）`,
          } as Prisma.InputJsonValue,
        },
      });
      await prisma.learningFact.update({
        where: { id: existingFact.id },
        data: {
          moduleId: stepId,
          outcome: 'partial',
          score: null,
          timeSpent: null,
          competencyContribution: { selfDirectedLearning: 0.05 } as Prisma.InputJsonValue,
          sourceLogId: log.id,
          lessonId: log.lessonKey ?? LESSON_KEY,
        },
      });
      continue;
    }

    const telemetry = buildUNIT41SubmissionTelemetry(response);
    const enrichedEventData = {
      ...eventData,
      ...telemetry,
      stepId,
    };
    const factData = {
      moduleId: telemetry.moduleId,
      outcome: telemetry.outcome,
      score: telemetry.score,
      timeSpent: telemetry.timeSpent ?? null,
      competencyContribution: telemetry.competencyContribution as Prisma.InputJsonValue,
      sourceLogId: log.id,
      lessonId: log.lessonKey ?? LESSON_KEY,
    };

    logsToUpdate += 1;
    if (existingFact) {
      factsToUpdate += 1;
    } else {
      factsToCreate += 1;
    }

    if (isDryRun) {
      continue;
    }

    await prisma.interactionLog.update({
      where: { id: log.id },
      data: { eventData: enrichedEventData as Prisma.InputJsonValue },
    });

    if (existingFact) {
      await prisma.learningFact.update({
        where: { id: existingFact.id },
        data: factData,
      });
      continue;
    }

    await prisma.learningFact.create({
      data: {
        userId: log.userId,
        factType: 'question',
        sessionId,
        startedAt: new Date(response.submittedAt),
        finishedAt: new Date(response.submittedAt),
        sourceEventId,
        courseId: null,
        ...factData,
      },
    });
  }

  const updatedLogs = await prisma.interactionLog.findMany({
    where: { id: { in: logs.map((log) => log.id) } },
    select: { id: true, stepId: true, eventData: true },
  });
  const evidenceDetails = buildEvidenceDetails(updatedLogs);

  let snapshotsCreated = 0;
  let snapshotsSkippedNoFacts = 0;
  let snapshotsSkippedUnchanged = 0;
  for (const userId of userIds) {
    const result = await refreshStudentSnapshot(userId, evidenceDetails);
    if (result.snapshotId) {
      snapshotsCreated += 1;
    } else if (result.skipped === 'no_facts') {
      snapshotsSkippedNoFacts += 1;
    } else if (result.skipped === 'unchanged_facts') {
      snapshotsSkippedUnchanged += 1;
    }
  }
  const classSnapshot = session.classId
    ? await refreshClassSnapshot(session.classId, userIds)
    : { snapshotId: null, studentCount: 0 };

  console.log(JSON.stringify({
    sessionId,
    dryRun: isDryRun,
    students: userIds.length,
    logs: logs.length,
    logsToUpdate,
    factsToUpdate,
    factsToCreate,
    missingResponse,
    missingFactsToDowngrade,
    snapshotsCreated,
    snapshotsSkippedNoFacts,
    snapshotsSkippedUnchanged,
    classSnapshot,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[BackfillUnit41GrowthGovernance] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

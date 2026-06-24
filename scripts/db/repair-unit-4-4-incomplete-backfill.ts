import { createPrismaClient } from '../../src/lib/prisma-client';
import { type Prisma } from '@prisma/client';

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
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';

const prisma = createPrismaClient();
const SESSION_ID = 'cmp1vz3l3001ue3jfwnwwvzio';
const shouldApply = process.argv.includes('--apply');

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function hasNullAnswerDigest(value: unknown): boolean {
  const record = readRecord(value);
  const answerDigest = readRecord(record.answerDigest);
  return Object.values(answerDigest).some((answer) => answer === null);
}

function buildEvidenceDetails(logs: Array<{ id: string; stepId: string | null; eventData: unknown }>) {
  return Object.fromEntries(logs.map((log) => {
    const eventData = readRecord(log.eventData);
    const questionSummaries = Array.isArray(eventData.questionSummaries)
      ? eventData.questionSummaries.filter((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
      : undefined;
    return [log.id, {
      evidenceTitle: typeof eventData.evidenceTitle === 'string' ? eventData.evidenceTitle : undefined,
      stepId: log.stepId ?? (typeof eventData.stepId === 'string' ? eventData.stepId : undefined),
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
  if (facts.length === 0) {
    return null;
  }

  const competencyVector = calculateCompetencyVector(facts, '1m');
  const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: 'desc' },
  });
  if (previousSnapshot) {
    const trendVector = calculateTrendVector(
      competencyVector,
      previousSnapshot.competencyVector as unknown as CompetencyVector,
    );
    for (const dimension of COMPETENCY_DIMENSIONS) {
      competencyVector[dimension].trend = trendVector[dimension];
    }
  }

  const snapshot = await prisma.studentCompetencySnapshot.create({
    data: {
      userId,
      snapshotAt: new Date(),
      competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
      evidenceSummary: generateEvidenceSummary(facts, 3, evidenceDetails) as unknown as Prisma.InputJsonValue,
      riskFlags: [],
      factCount: facts.length,
    },
  });
  return snapshot.id;
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

async function refreshClassSnapshot(classId: string) {
  const students = await prisma.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
  });
  const snapshots = await Promise.all(students.map((student) =>
    prisma.studentCompetencySnapshot.findFirst({
      where: { userId: student.userId },
      orderBy: { snapshotAt: 'desc' },
    }),
  ));
  const validSnapshots = snapshots.filter((snapshot) => Boolean(snapshot) && snapshot!.factCount > 0) as Array<{ competencyVector: unknown; riskFlags: unknown }>;
  const aggregate = calculateClassAggregate(validSnapshots);
  const distribution = calculateLevelDistribution(validSnapshots);
  const previousSnapshot = await prisma.classCompetencySnapshot.findFirst({
    where: { classId },
    orderBy: { snapshotAt: 'desc' },
  });
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
      totalStudentCount: students.length,
    },
  });
  return { snapshotId: snapshot.id, studentCount: validSnapshots.length };
}

async function main() {
  if (!shouldApply) {
    throw new Error('Refusing to repair without --apply.');
  }

  const incompleteResponses = await prisma.studentStepResponse.findMany({
    where: {
      sessionId: SESSION_ID,
      stepId: 'step-13',
    },
    select: {
      id: true,
      userId: true,
      sourceLogId: true,
      responseData: true,
    },
  });
  const polluted = incompleteResponses.filter((response) => hasNullAnswerDigest(response.responseData));
  const sourceLogIds = polluted
    .map((response) => response.sourceLogId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const logs = sourceLogIds.length > 0
    ? await prisma.interactionLog.findMany({
      where: { id: { in: sourceLogIds } },
      select: { id: true, stepId: true, eventData: true },
    })
    : [];
  const evidenceDetails = buildEvidenceDetails(logs);

  for (const response of polluted) {
    await prisma.studentStepResponse.delete({ where: { id: response.id } });
  }

  for (const sourceLogId of sourceLogIds) {
    const log = logs.find((item) => item.id === sourceLogId);
    const eventData = readRecord(log?.eventData);
    const cleanedEventData = {
      stepId: eventData.stepId,
      actorRole: eventData.actorRole,
      eventType: eventData.eventType,
      lessonKey: eventData.lessonKey,
      sessionId: eventData.sessionId,
      attemptKey: eventData.attemptKey,
      resourceId: eventData.resourceId,
      resourceKey: eventData.resourceKey,
      clientEventAt: eventData.clientEventAt,
      clientEventId: eventData.clientEventId,
      learningContext: eventData.learningContext,
    };

    await prisma.interactionLog.update({
      where: { id: sourceLogId },
      data: { eventData: cleanedEventData as Prisma.InputJsonValue },
    });
    await prisma.learningFact.updateMany({
      where: {
        sessionId: SESSION_ID,
        sourceLogId,
      },
      data: {
        score: null,
        outcome: 'success',
        competencyContribution: {
          controlModeling: 0.4,
          selfDirectedLearning: 0.4,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const affectedUserIds = Array.from(new Set(polluted.map((response) => response.userId))).sort();
  let snapshotsCreated = 0;
  for (const userId of affectedUserIds) {
    const snapshotId = await refreshStudentSnapshot(userId, evidenceDetails);
    if (snapshotId) snapshotsCreated += 1;
  }
  const session = await prisma.classSession.findUnique({
    where: { id: SESSION_ID },
    select: { classId: true },
  });
  const classSnapshot = session?.classId
    ? await refreshClassSnapshot(session.classId)
    : { snapshotId: null, studentCount: 0 };
  const reportRefresh = await generateSessionSummaryReports(prisma as never, SESSION_ID);

  console.log(JSON.stringify({
    removedStudentStepResponses: polluted.length,
    restoredFacts: sourceLogIds.length,
    affectedStudents: affectedUserIds.length,
    snapshotsCreated,
    classSnapshot,
    reportRefresh,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[RepairUnit44IncompleteBackfill] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

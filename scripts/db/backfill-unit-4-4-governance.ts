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
import {
  UNIT_4_4_LESSON_KEY,
  buildUnit44BackfillPlan,
} from '@/lib/data-governance/unit-4-4-backfill';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';

const prisma = new PrismaClient();
const DEFAULT_SESSION_ID = 'cmp1vz3l3001ue3jfwnwwvzio';

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((item) => item.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const options = {
  sessionId: getArgValue('--session-id') ?? DEFAULT_SESSION_ID,
  dryRun: process.argv.includes('--dry-run'),
  apply: process.argv.includes('--apply'),
  forceSnapshots: process.argv.includes('--force-snapshots'),
  refreshGrowthEvaluations: process.argv.includes('--refresh-growth-evaluations'),
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
    return { snapshotId: null, factCount: 0, skipped: 'no_facts' };
  }

  const competencyVector = calculateCompetencyVector(facts, '1m');
  const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: 'desc' },
  });
  const latestFactCreatedAt = facts.reduce<Date | null>((latest, fact) => {
    if (!latest || fact.createdAt.getTime() > latest.getTime()) return fact.createdAt;
    return latest;
  }, null);

  if (
    !options.forceSnapshots &&
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

  if (options.dryRun) {
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

  if (options.refreshGrowthEvaluations) {
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
  }

  return {
    snapshotId: snapshot.id,
    factCount: facts.length,
    skipped: null,
  };
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

  if (validSnapshots.length === 0 || options.dryRun) {
    return { snapshotId: null, studentCount: validSnapshots.length };
  }

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
  if (!options.dryRun && !options.apply) {
    throw new Error('Refusing to write without --apply. Use --dry-run to inspect the plan first.');
  }

  const session = await prisma.classSession.findUnique({
    where: { id: options.sessionId },
    select: { id: true, classId: true },
  });
  if (!session) {
    throw new Error(`ClassSession not found: ${options.sessionId}`);
  }

  const [states, logs, existingResponses] = await Promise.all([
    prisma.studentState.findMany({
      where: {
        sessionId: options.sessionId,
        stateKey: 'course',
        lessonKey: UNIT_4_4_LESSON_KEY,
      },
      select: { userId: true, data: true },
    }),
    prisma.interactionLog.findMany({
      where: {
        sessionId: options.sessionId,
        lessonKey: UNIT_4_4_LESSON_KEY,
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
        clientEventId: true,
        attemptKey: true,
        clientEventAt: true,
        createdAt: true,
        eventData: true,
      },
    }),
    prisma.studentStepResponse.findMany({
      where: { sessionId: options.sessionId },
      select: { sourceLogId: true },
    }),
  ]);

  const existingSourceLogIds = new Set(
    existingResponses
      .map((item) => item.sourceLogId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const plan = buildUnit44BackfillPlan({
    sessionId: options.sessionId,
    states,
    logs,
    existingSourceLogIds,
  });
  const sourceLogIds = plan.rows.map((row) => row.sourceLogId);
  const existingFacts = sourceLogIds.length > 0
    ? await prisma.learningFact.findMany({
      where: {
        sessionId: options.sessionId,
        sourceLogId: { in: sourceLogIds },
      },
      select: { id: true, sourceLogId: true },
    })
    : [];
  const factsBySourceLogId = new Map(
    existingFacts
      .filter((fact) => fact.sourceLogId)
      .map((fact) => [fact.sourceLogId as string, fact.id]),
  );
  const rowsWithFacts = plan.rows.filter((row) => factsBySourceLogId.has(row.sourceLogId));
  const rowsMissingFacts = plan.rows.length - rowsWithFacts.length;

  if (!options.dryRun && plan.rows.length > 0) {
    await prisma.studentStepResponse.createMany({
      data: plan.rows.map((row) => ({
        userId: row.userId,
        sessionId: row.sessionId,
        lessonKey: row.lessonKey,
        stepId: row.stepId,
        attemptKey: row.attemptKey,
        sourceLogId: row.sourceLogId,
        clientEventId: row.clientEventId,
        submittedAt: row.submittedAt,
        responseData: row.responseData,
      })),
      skipDuplicates: true,
    });

    for (const row of rowsWithFacts) {
      await prisma.interactionLog.update({
        where: { id: row.sourceLogId },
        data: { eventData: row.eventData },
      });
      await prisma.learningFact.update({
        where: { id: factsBySourceLogId.get(row.sourceLogId) },
        data: {
          moduleId: row.moduleId,
          outcome: row.outcome,
          score: row.score,
          competencyContribution: row.competencyContribution,
          lessonId: row.lessonKey,
          sourceLogId: row.sourceLogId,
        },
      });
    }
  }

  const updatedLogs = sourceLogIds.length > 0
    ? await prisma.interactionLog.findMany({
      where: { id: { in: sourceLogIds } },
      select: { id: true, stepId: true, eventData: true },
    })
    : [];
  const evidenceDetails = buildEvidenceDetails(updatedLogs);
  const affectedUserIds = Array.from(new Set(rowsWithFacts.map((row) => row.userId))).sort();

  let snapshotsCreated = 0;
  let snapshotsSkippedNoFacts = 0;
  let snapshotsSkippedUnchanged = 0;
  for (const userId of affectedUserIds) {
    const result = await refreshStudentSnapshot(userId, evidenceDetails);
    if (result.snapshotId) snapshotsCreated += 1;
    else if (result.skipped === 'no_facts') snapshotsSkippedNoFacts += 1;
    else if (result.skipped === 'unchanged_facts') snapshotsSkippedUnchanged += 1;
  }
  const classSnapshot = session.classId
    ? await refreshClassSnapshot(session.classId)
    : { snapshotId: null, studentCount: 0 };
  const reportRefresh = options.dryRun
    ? { classReports: 0, studentReports: 0, skipped: true }
    : await generateSessionSummaryReports(prisma as never, options.sessionId);

  console.log(JSON.stringify({
    sessionId: options.sessionId,
    dryRun: options.dryRun,
    apply: options.apply,
    forceSnapshots: options.forceSnapshots,
    refreshGrowthEvaluations: options.refreshGrowthEvaluations,
    ...plan.summary,
    rowsWithFacts: rowsWithFacts.length,
    rowsMissingFacts,
    affectedStudents: affectedUserIds.length,
    snapshotsCreated,
    snapshotsSkippedNoFacts,
    snapshotsSkippedUnchanged,
    classSnapshot,
    reportRefresh,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[BackfillUnit44Governance] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

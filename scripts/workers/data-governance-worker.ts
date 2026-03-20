/**
 * Data Governance Worker Service
 *
 * Standalone worker service for processing:
 * - Event ingestion (secondary events from Redis)
 * - Student competency snapshots
 * - Class competency snapshots
 *
 * Run with: ts-node scripts/workers/data-governance-worker.ts
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  calculateCompetencyVector,
  calculateTrendVector,
  generateEvidenceSummary,
  identifyStrengths,
  identifyWeaknesses,
} from '@/lib/data-governance/competency-engine';
import {
  detectRisks,
  getRiskLevelDescription,
  getRecommendedScaffolding,
} from '@/lib/data-governance/risk-detector';
import { fetchSecondaryEvents, markEventsProcessed } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import {
  deriveFactOutcome,
  deriveFactScore,
  deriveFactTimeSpent,
  mapActionTypeToFactType,
  resolveCompetencyContribution,
} from '@/lib/data-governance/event-normalization';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import type { EventIngestionJob, StudentSnapshotJob, ClassSnapshotJob } from './types';

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);

// Initialize clients
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

// Track worker status
let isShuttingDown = false;

// ============================================
// Worker 1: Event Ingestion
// ============================================

const eventIngestionWorker = new Worker(
  'event-ingestion',
  async (job: Job<EventIngestionJob>) => {
    const batchDate = resolveBatchDate(job.data.batchDate);
    console.log(`[EventIngestion] Processing batch for ${batchDate}`);

    // Fetch events from Redis buffer
    const events = await fetchSecondaryEvents(batchDate, 100);

    if (events.length === 0) {
      console.log(`[EventIngestion] No events to process for ${batchDate}`);
      return { processed: 0, factsCreated: 0 };
    }

    // Store batch
    await prisma.learningEventBatch.create({
      data: {
        batchDate: new Date(batchDate),
        events: events as unknown as Prisma.InputJsonValue,
        eventCount: events.length,
        processedAt: new Date(),
      },
    });

    // Transform core events to LearningFacts
    const coreEvents = events.filter((e) => isCoreEvent(e.actionType));
    const facts = coreEvents.map(eventToFact).filter(Boolean);

    // Upsert facts (skip duplicates)
    if (facts.length > 0) {
      await prisma.learningFact.createMany({
        data: facts as Prisma.LearningFactCreateManyInput[],
        skipDuplicates: true,
      });
    }

    // Update stats
    await markEventsProcessed(events.length);

    console.log(`[EventIngestion] Processed ${events.length} events, created ${facts.length} facts`);

    return {
      processed: events.length,
      factsCreated: facts.length,
    };
  },
  { connection: redis, concurrency: WORKER_CONCURRENCY }
);

function resolveBatchDate(batchDate?: string, now = new Date()): string {
  if (batchDate && batchDate.trim().length > 0) {
    return batchDate;
  }

  return now.toISOString().split('T')[0];
}

function eventToFact(event: LearningEvent) {
  // Map event to LearningFact structure
  const competencyMapping = getCompetencyMappingForEvent(event);

  return {
    userId: event.userId,
    factType: mapActionTypeToFactType(event.actionType),
    moduleId: event.moduleId,
    sessionId: event.sessionId,
    startedAt: new Date(event.occurredAt),
    finishedAt: new Date(event.occurredAt),
    outcome: deriveFactOutcome(event.actionType, event.payload),
    score: deriveFactScore(event.payload),
    timeSpent: deriveFactTimeSpent(event.payload),
    competencyContribution: competencyMapping,
    sourceEventId: event.eventId,
    sourceLogId: event.payload.sourceLogId as string | undefined,
    courseId: event.courseId,
    lessonId: event.lessonId,
  };
}

function getCompetencyMappingForEvent(event: LearningEvent): Record<string, number> {
  return resolveCompetencyContribution(
    event.actionType,
    event.payload,
    event.derivedMetrics,
  );
}

// ============================================
// Worker 2: Student Snapshot
// ============================================

const studentSnapshotWorker = new Worker(
  'snapshot-student',
  async (job: Job<StudentSnapshotJob>) => {
    const { userId } = job.data;
    console.log(`[StudentSnapshot] Calculating snapshot for ${userId}`);
    const snapshotAt = new Date();

    // Fetch recent learning facts
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const facts = await prisma.learningFact.findMany({
      where: {
        userId,
        startedAt: { gte: thirtyDaysAgo },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate competency vector
    const competencyVector = calculateCompetencyVector(facts, '1m');

    // Get previous snapshot for trend calculation
    const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

    // Calculate trend
    if (previousSnapshot) {
      const previousVector = previousSnapshot.competencyVector as unknown as CompetencyVector;
      const trendVector = calculateTrendVector(competencyVector, previousVector);

      // Update trends in vector
      for (const dim of Object.keys(trendVector)) {
        competencyVector[dim as keyof CompetencyVector].trend = trendVector[dim as keyof CompetencyVector];
      }
    }

    // Detect risks
    const risks = detectRisks({
      userId,
      facts,
      competencyVector,
      previousSnapshot: previousSnapshot?.competencyVector as unknown as CompetencyVector,
    });

    // Create snapshot
    const snapshot = await prisma.studentCompetencySnapshot.create({
      data: {
        userId,
        snapshotAt,
        competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
        evidenceSummary: generateEvidenceSummary(facts) as unknown as Prisma.InputJsonValue,
        riskFlags: risks.map((r) => r.type),
        factCount: facts.length,
      },
    });

    // Update or create profile summary
    await updateProfileSummary(userId, competencyVector, risks, facts);

    await prisma.studentRiskFlag.updateMany({
      where: {
        userId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: snapshotAt,
        resolutionNote: 'Superseded by latest competency snapshot',
      },
    });

    if (risks.length > 0) {
      await prisma.studentRiskFlag.createMany({
        data: risks.map((risk) => ({
          userId,
          flagType: risk.type,
          severity: risk.severity,
          description: risk.description,
          evidenceJson: risk.evidence as Prisma.InputJsonValue,
          triggeredAt: risk.triggeredAt,
        })),
      });
    }

    console.log(`[StudentSnapshot] Created snapshot ${snapshot.id} with ${risks.length} risks`);

    return {
      snapshotId: snapshot.id,
      factCount: facts.length,
      riskCount: risks.length,
    };
  },
  { connection: redis, concurrency: WORKER_CONCURRENCY }
);

async function updateProfileSummary(
  userId: string,
  vector: CompetencyVector,
  risks: ReturnType<typeof detectRisks>,
  facts: Array<{ factType: string; outcome: string; startedAt: Date }>
) {
  const strengths = identifyStrengths(vector);
  const weaknesses = identifyWeaknesses(vector);
  const riskLevel = getRiskLevelDescription(risks.length);

  // Get recent activity (last 5)
  const recentActivity = facts.slice(0, 5).map((f) => ({
    type: f.factType,
    outcome: f.outcome,
    date: f.startedAt.toISOString(),
  }));

  // Calculate trend description
  const trendDirection = calculateOverallTrend(vector);
  const trendDescriptions: Record<string, string> = {
    up: '近两周稳步提升',
    stable: '近期表现平稳',
    down: '近期出现下滑',
  };

  await prisma.studentProfileSummary.upsert({
    where: { userId },
    update: {
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map((r) => r.description) as Prisma.InputJsonValue,
      riskLevel,
      recommendedScaffolding: getRecommendedScaffolding(risks),
      recentActivityJson: recentActivity as Prisma.InputJsonValue,
      cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
    create: {
      userId,
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map((r) => r.description) as Prisma.InputJsonValue,
      riskLevel,
      recommendedScaffolding: getRecommendedScaffolding(risks),
      recentActivityJson: recentActivity as Prisma.InputJsonValue,
      cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
}

function getOverallLevel(vector: CompetencyVector): string {
  const avg = calculateOverallScore(vector);
  if (avg >= 85) return '优秀';
  if (avg >= 70) return '良好';
  if (avg >= 55) return '中等偏上';
  if (avg >= 40) return '需提升';
  return '需关注';
}

function calculateOverallScore(vector: CompetencyVector): number {
  const scores = Object.values(vector).map((v) => v.score);
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function calculateOverallTrend(vector: CompetencyVector): 'up' | 'stable' | 'down' {
  const trends = Object.values(vector).map((v) => v.trend);
  const upCount = trends.filter((t) => t === 'up').length;
  const downCount = trends.filter((t) => t === 'down').length;

  if (upCount > downCount + 1) return 'up';
  if (downCount > upCount + 1) return 'down';
  return 'stable';
}

// ============================================
// Worker 3: Class Snapshot
// ============================================

const classSnapshotWorker = new Worker(
  'snapshot-class',
  async (job: Job<ClassSnapshotJob>) => {
    const { classId } = job.data;
    console.log(`[ClassSnapshot] Calculating snapshot for class ${classId}`);

    // Get all students in class
    const students = await prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });

    // Get latest snapshots for all students
    const snapshots = await Promise.all(
      students.map((s) =>
        prisma.studentCompetencySnapshot.findFirst({
          where: { userId: s.userId },
          orderBy: { snapshotAt: 'desc' },
        })
      )
    );

    const validSnapshots = snapshots.filter(Boolean);

    if (validSnapshots.length === 0) {
      console.log(`[ClassSnapshot] No student snapshots for class ${classId}`);
      return { studentCount: 0, snapshotId: null };
    }

    // Calculate aggregates
    const aggregate = calculateClassAggregate(validSnapshots);
    const distribution = calculateLevelDistribution(validSnapshots);
    const riskSummary = calculateRiskSummary(validSnapshots);

    // Create class snapshot
    const snapshot = await prisma.classCompetencySnapshot.create({
      data: {
        classId,
        snapshotAt: new Date(),
        aggregateJson: aggregate as unknown as Prisma.InputJsonValue,
        distributionJson: distribution as unknown as Prisma.InputJsonValue,
        trendJson: {} as Prisma.InputJsonValue, // TODO: Compare with previous
        riskSummaryJson: riskSummary as unknown as Prisma.InputJsonValue,
        levelDistribution: distribution as unknown as Prisma.InputJsonValue,
        activeStudentCount: validSnapshots.length,
        totalStudentCount: students.length,
      },
    });

    console.log(
      `[ClassSnapshot] Created snapshot ${snapshot.id} for ${validSnapshots.length}/${students.length} students`
    );

    return {
      snapshotId: snapshot.id,
      studentCount: validSnapshots.length,
    };
  },
  { connection: redis, concurrency: 1 } // Lower concurrency for heavier work
);

function calculateClassAggregate(snapshots: Array<{ competencyVector: unknown }>) {
  const vectors = snapshots.map((s) => s.competencyVector as CompetencyVector);
  const dimensions = Object.keys(vectors[0]) as Array<keyof CompetencyVector>;

  const aggregate: Record<string, { mean: number; stdDev: number }> = {};

  for (const dim of dimensions) {
    const scores = vectors.map((v) => v[dim].score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    aggregate[dim] = {
      mean: Math.round(mean * 10) / 10,
      stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    };
  }

  return aggregate;
}

function calculateLevelDistribution(snapshots: Array<{ competencyVector: unknown }>) {
  const vectors = snapshots.map((s) => s.competencyVector as CompetencyVector);

  const levels = { excellent: 0, good: 0, average: 0, needsImprovement: 0, atRisk: 0 };

  for (const vector of vectors) {
    const avg = calculateOverallScore(vector);
    if (avg >= 85) levels.excellent++;
    else if (avg >= 70) levels.good++;
    else if (avg >= 55) levels.average++;
    else if (avg >= 40) levels.needsImprovement++;
    else levels.atRisk++;
  }

  return levels;
}

function calculateRiskSummary(snapshots: Array<{ riskFlags: unknown }>) {
  const allFlags = snapshots.flatMap((s) => s.riskFlags as string[]);

  const summary: Record<string, number> = {};
  for (const flag of allFlags) {
    summary[flag] = (summary[flag] || 0) + 1;
  }

  return summary;
}

// ============================================
// Event Handlers & Shutdown
// ============================================

// Log worker events
eventIngestionWorker.on('completed', (job) => {
  console.log(`[EventIngestion] Job ${job.id} completed`, job.returnvalue);
});

eventIngestionWorker.on('failed', (job, err) => {
  console.error(`[EventIngestion] Job ${job?.id} failed:`, err.message);
});

studentSnapshotWorker.on('completed', (job) => {
  console.log(`[StudentSnapshot] Job ${job.id} completed`, job.returnvalue);
});

studentSnapshotWorker.on('failed', (job, err) => {
  console.error(`[StudentSnapshot] Job ${job?.id} failed:`, err.message);
});

classSnapshotWorker.on('completed', (job) => {
  console.log(`[ClassSnapshot] Job ${job.id} completed`, job.returnvalue);
});

classSnapshotWorker.on('failed', (job, err) => {
  console.error(`[ClassSnapshot] Job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[Worker] Shutting down...');

  await Promise.all([
    eventIngestionWorker.close(),
    studentSnapshotWorker.close(),
    classSnapshotWorker.close(),
  ]);

  await prisma.$disconnect();
  await redis.quit();

  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Worker] Data governance worker started');
console.log(`[Worker] Concurrency: ${WORKER_CONCURRENCY}`);

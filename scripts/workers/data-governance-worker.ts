import { createPrismaClient } from '../../src/lib/prisma-client';
/**
 * Data Governance Worker Service
 *
 * Standalone worker service for processing:
 * - Nightly secondary-event ingestion
 * - Hourly snapshots for active students
 * - Daily class competency snapshots
 *
 * Run with: ts-node scripts/workers/data-governance-worker.ts
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Job, Queue, Worker } from 'bullmq';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  calculateCompetencyVector,
  calculateTrendVector,
  generateEvidenceSummary,
  identifyStrengths,
  identifyWeaknesses,
} from '@/lib/data-governance/competency-engine';
import { refreshStudentGrowthEvaluation } from '@/lib/data-governance/growth-evaluation';
import { fetchSecondaryEvents, markEventsProcessed } from '@/lib/data-governance/event-buffer';
import {
  eventToLearningFactInput,
} from '@/lib/data-governance/learning-fact-materialization';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import {
  rebuildStudentEvidenceFeatureCache,
  refreshStudentEvidenceFeatureCache,
} from '@/lib/data-governance/student-evidence-feature-cache';
import { materializeIncrementalPortraitV2 } from '@/lib/data-governance/portrait-v2-materialization';
import {
  aggregatePortraitV2,
  resolvePrimaryPortraitV2,
  summarizePortraitV2,
} from '@/lib/data-governance/portrait-v2-consumer';
import type {
  PortraitV2ClassAggregate,
} from '@/lib/data-governance/portrait-v2-consumer';
import type { PortraitV2PayloadShape } from '@/lib/data-governance/portrait-v2-model';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import {
  detectRisks,
  getRecommendedScaffolding,
  getRiskLevelDescription,
} from '@/lib/data-governance/risk-detector';
import type {
  ClassSnapshotJob,
  EventIngestionJob,
  EvidenceFeatureCacheJob,
  SessionReportJob,
  StudentSnapshotJob,
} from './types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '2', 10);
const EVENT_BATCH_SIZE = parseInt(process.env.EVENT_INGESTION_BATCH_SIZE || '100', 10);
const ACTIVE_WINDOW_MINUTES = parseInt(process.env.ACTIVE_STUDENT_WINDOW_MINUTES || '90', 10);
const COOLDOWN_MS = parseInt(process.env.DATA_GOVERNANCE_WORKER_COOLDOWN_MS || '900000', 10);
const LOG_WINDOW_MS = parseInt(process.env.DATA_GOVERNANCE_WORKER_LOG_WINDOW_MS || '60000', 10);
const COOLDOWN_FILE =
  process.env.DATA_GOVERNANCE_WORKER_COOLDOWN_FILE ||
  path.join(os.tmpdir(), 'act-obe-data-governance-worker.cooldown.json');

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
} as const;

const logWindow = new Map<
  string,
  {
    windowStart: number;
    summaryCount: number;
  }
>();

let redis: Redis | null = null;
let prisma: PrismaClient | null = null;
let eventQueue: Queue<EventIngestionJob> | null = null;
let studentQueue: Queue<StudentSnapshotJob> | null = null;
let classQueue: Queue<ClassSnapshotJob> | null = null;
let reportQueue: Queue<SessionReportJob> | null = null;
let evidenceFeatureCacheQueue: Queue<EvidenceFeatureCacheJob> | null = null;
let eventIngestionWorker: Worker<EventIngestionJob> | null = null;
let studentSnapshotWorker: Worker<StudentSnapshotJob> | null = null;
let classSnapshotWorker: Worker<ClassSnapshotJob> | null = null;
let sessionReportWorker: Worker<SessionReportJob> | null = null;
let evidenceFeatureCacheWorker: Worker<EvidenceFeatureCacheJob> | null = null;
let isShuttingDown = false;
let infrastructureFailureHandled = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRedisClient(): Redis {
  if (!redis) {
    throw new Error('Redis client is not initialized');
  }
  return redis;
}

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error('Prisma client is not initialized');
  }
  return prisma;
}

function logWithThrottle(
  key: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  error?: unknown,
) {
  const now = Date.now();
  const entry = logWindow.get(key);

  if (!entry || now - entry.windowStart >= LOG_WINDOW_MS) {
    if (entry && entry.summaryCount > 0) {
      writeLog(
        level,
        `[Worker][${key}] suppressed ${entry.summaryCount} similar messages in the previous ${Math.round(LOG_WINDOW_MS / 1000)}s`,
      );
    }

    logWindow.set(key, { windowStart: now, summaryCount: 0 });
    writeLog(level, message, error);
    return;
  }

  entry.summaryCount += 1;
  logWindow.set(key, entry);

  if (entry.summaryCount === 1 || entry.summaryCount % 20 === 0) {
    writeLog(level, `${message} (suppressed duplicates: ${entry.summaryCount})`);
  }
}

function writeLog(level: 'info' | 'warn' | 'error', message: string, error?: unknown) {
  if (level === 'error') {
    if (error) {
      console.error(message, formatError(error));
      return;
    }
    console.error(message);
    return;
  }

  if (level === 'warn') {
    if (error) {
      console.warn(message, formatError(error));
      return;
    }
    console.warn(message);
    return;
  }

  if (error) {
    console.log(message, formatError(error));
    return;
  }

  console.log(message);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isInfrastructureError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();

  return [
    'oom command not allowed',
    'maxmemory',
    'readonly',
    'read only',
    'econnrefused',
    'etimedout',
    'connection is closed',
    'connection closed',
    'socket closed',
    'connection lost',
    'ready check failed',
    'redis connection',
    'bullmq',
  ].some((token) => message.includes(token));
}

async function readCooldownState(): Promise<{ cooldownUntil: number; reason?: string } | null> {
  try {
    const raw = await fs.readFile(COOLDOWN_FILE, 'utf8');
    return JSON.parse(raw) as { cooldownUntil: number; reason?: string };
  } catch {
    return null;
  }
}

async function clearCooldown(): Promise<void> {
  await fs.rm(COOLDOWN_FILE, { force: true });
}

async function armCooldown(reason: string): Promise<void> {
  const payload = {
    cooldownUntil: Date.now() + COOLDOWN_MS,
    reason,
    armedAt: new Date().toISOString(),
  };

  await fs.writeFile(COOLDOWN_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

async function respectCooldown(): Promise<void> {
  for (;;) {
    const state = await readCooldownState();
    if (!state) {
      return;
    }

    const remaining = state.cooldownUntil - Date.now();
    if (remaining <= 0) {
      await clearCooldown();
      return;
    }

    logWithThrottle(
      'cooldown',
      'warn',
      `[Worker] cooldown active for another ${Math.ceil(remaining / 1000)}s (${state.reason || 'infrastructure failure'})`,
    );

    await sleep(Math.min(remaining, 30000));
  }
}

async function handleInfrastructureFailure(source: string, error: unknown) {
  if (isShuttingDown || infrastructureFailureHandled) {
    return;
  }

  infrastructureFailureHandled = true;
  const reason = `${source}: ${formatError(error)}`;

  logWithThrottle(
    'infrastructure:error',
    'error',
    `[Worker] infrastructure failure detected, entering cooldown before restart`,
    error,
  );

  await armCooldown(reason);
  await shutdown(1);
}

async function handleFatalProcessError(source: string, error: unknown) {
  if (isInfrastructureError(error)) {
    await handleInfrastructureFailure(source, error);
    return;
  }

  logWithThrottle(`fatal:${source}`, 'error', `[Worker] fatal process error from ${source}`, error);
  await shutdown(1);
}

function registerWorkerHandlers<T>(name: string, worker: Worker<T>) {
  worker.on('completed', (job) => {
    logWithThrottle(`${name}:completed`, 'info', `[${name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    if (isInfrastructureError(err)) {
      void handleInfrastructureFailure(`${name}:failed:${job?.id ?? 'unknown'}`, err);
      return;
    }

    logWithThrottle(`${name}:failed`, 'error', `[${name}] Job ${job?.id ?? 'unknown'} failed`, err);
  });

  worker.on('error', (err) => {
    if (isInfrastructureError(err)) {
      void handleInfrastructureFailure(`${name}:worker-error`, err);
      return;
    }

    logWithThrottle(`${name}:error`, 'error', `[${name}] Worker error`, err);
  });
}

async function scheduleEventIngestionBatch(date: string, batchIndex: number, triggerId: string) {
  if (!eventQueue) {
    throw new Error('event queue is not initialized');
  }

  await eventQueue.add(
    `event-ingestion-${date}-${batchIndex}`,
    { batchDate: date },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      jobId: `event-ingestion-${date}-${triggerId}-${batchIndex}`,
      ...JOB_HISTORY_OPTIONS,
    },
  );
}

async function enqueueStudentSnapshot(userId: string, triggerId: string) {
  if (!studentQueue) {
    throw new Error('student queue is not initialized');
  }

  await studentQueue.add(
    `student-snapshot-${userId}`,
    { userId },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      jobId: `student-snapshot-${userId}-${triggerId}`,
      ...JOB_HISTORY_OPTIONS,
    },
  );
}

async function enqueueClassSnapshot(classId: string, triggerId: string) {
  if (!classQueue) {
    throw new Error('class queue is not initialized');
  }

  await classQueue.add(
    `class-snapshot-${classId}`,
    { classId },
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      jobId: `class-snapshot-${classId}-${triggerId}`,
      ...JOB_HISTORY_OPTIONS,
    },
  );
}

async function listBufferedDates(): Promise<Array<{ date: string; count: number }>> {
  const client = getRedisClient();
  const keys = await client.keys('event:buffer:secondary:*');

  if (keys.length === 0) {
    return [];
  }

  const counts = await Promise.all(keys.map((key) => client.llen(key)));

  return keys
    .map((key, index) => ({
      date: key.replace('event:buffer:secondary:', ''),
      count: counts[index],
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getActiveStudentIds(): Promise<string[]> {
  const db = getPrismaClient();
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);

  const [interactionUsers, factUsers] = await Promise.all([
    db.interactionLog.findMany({
      where: {
        createdAt: { gte: activeSince },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
    db.learningFact.findMany({
      where: {
        startedAt: { gte: activeSince },
      },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const candidateIds = Array.from(
    new Set([...interactionUsers.map((item) => item.userId), ...factUsers.map((item) => item.userId)]),
  );

  if (candidateIds.length === 0) {
    return [];
  }

  const studentProfiles = await db.studentProfile.findMany({
    where: { userId: { in: candidateIds } },
    select: { userId: true },
  });

  return studentProfiles.map((item) => item.userId);
}

async function processEventIngestionJob(job: Job<EventIngestionJob>) {
  if (job.data.coordinator) {
    const bufferedDates = await listBufferedDates();
    if (bufferedDates.length === 0) {
      logWithThrottle('event-ingestion:coordinator', 'info', '[EventIngestion] No buffered event batches to schedule');
      return { scheduled: 0, pendingDates: 0 };
    }

    let scheduled = 0;
    const triggerId = `${job.id ?? 'manual'}-${Date.now()}`;
    for (const entry of bufferedDates) {
      const batchCount = Math.ceil(entry.count / EVENT_BATCH_SIZE);
      for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
        await scheduleEventIngestionBatch(entry.date, batchIndex + 1, triggerId);
        scheduled += 1;
      }
    }

    logWithThrottle(
      'event-ingestion:coordinator',
      'info',
      `[EventIngestion] Scheduled ${scheduled} one-off ingestion jobs across ${bufferedDates.length} buffered dates`,
    );

    return {
      scheduled,
      pendingDates: bufferedDates.length,
    };
  }

  const db = getPrismaClient();
  const batchDate = resolveBatchDate(job.data.batchDate);
  logWithThrottle('event-ingestion:job', 'info', `[EventIngestion] Processing batch for ${batchDate}`);

  const events = await fetchSecondaryEvents(batchDate, EVENT_BATCH_SIZE);
  if (events.length === 0) {
    return { processed: 0, factsCreated: 0 };
  }

  await db.learningEventBatch.create({
    data: {
      batchDate: new Date(batchDate),
      events: events as unknown as Prisma.InputJsonValue,
      eventCount: events.length,
      processedAt: new Date(),
    },
  });

  const facts = events
    .map(eventToLearningFactInput)
    .filter((fact): fact is Prisma.LearningFactCreateManyInput => Boolean(fact));

  let factsCreated = 0;
  if (facts.length > 0) {
    const result = await db.learningFact.createMany({
      data: facts as Prisma.LearningFactCreateManyInput[],
      skipDuplicates: true,
    });
    factsCreated = result.count;
  }

  await markEventsProcessed(events.length, batchDate);

  return {
    processed: events.length,
    factsCreated,
  };
}

function resolveBatchDate(batchDate?: string, now = new Date()): string {
  if (batchDate && batchDate.trim().length > 0) {
    return batchDate;
  }

  return now.toISOString().split('T')[0];
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readQuestionSummaries(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => item as Record<string, unknown>)
    : undefined;
}

async function loadEvidenceDetails(
  db: PrismaClient,
  facts: Array<{ sourceLogId: string | null }>,
) {
  const sourceLogIds = Array.from(new Set(
    facts
      .map((fact) => fact.sourceLogId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  ));
  if (sourceLogIds.length === 0) {
    return {};
  }

  const logs = await db.interactionLog.findMany({
    where: { id: { in: sourceLogIds } },
    select: {
      id: true,
      stepId: true,
      eventData: true,
    },
  });

  return Object.fromEntries(logs.map((log) => {
    const eventData = readRecord(log.eventData);
    return [log.id, {
      evidenceTitle: readString(eventData.evidenceTitle),
      stepId: log.stepId ?? readString(eventData.stepId),
      questionSummaries: readQuestionSummaries(eventData.questionSummaries),
    }];
  }));
}

async function processStudentSnapshotJob(job: Job<StudentSnapshotJob>) {
  if (job.data.coordinator) {
    const activeStudentIds = await getActiveStudentIds();
    if (activeStudentIds.length === 0) {
      logWithThrottle('student-snapshot:coordinator', 'info', '[StudentSnapshot] No active students in the last 90 minutes');
      return { scheduled: 0 };
    }

    const triggerId = new Date().toISOString().slice(0, 13);
    for (const userId of activeStudentIds) {
      await enqueueStudentSnapshot(userId, triggerId);
    }

    logWithThrottle(
      'student-snapshot:coordinator',
      'info',
      `[StudentSnapshot] Scheduled ${activeStudentIds.length} active student snapshot jobs`,
    );

    return { scheduled: activeStudentIds.length };
  }

  if (!job.data.userId) {
    throw new Error('snapshot-student job requires userId unless it is a coordinator job');
  }

  const db = getPrismaClient();
  const { userId } = job.data;
  const snapshotAt = new Date();

  const portraitV2 = await materializeIncrementalPortraitV2(db, userId, { now: snapshotAt });
  if (portraitV2.mappingIssues.length > 0) {
    logWithThrottle(
      `student-snapshot:${userId}:portrait-v2-mapping`,
      'warn',
      `[StudentSnapshot] Portrait v2 mapping issues for ${userId}: ${portraitV2.mappingIssues.join(', ')}`,
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const facts = await db.learningFact.findMany({
    where: {
      userId,
      startedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { startedAt: 'desc' },
  });

  const previousSnapshot = await db.studentCompetencySnapshot.findFirst({
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
    await refreshStudentEvidenceFeatureCache(db, userId, { now: snapshotAt });
    logWithThrottle(`student-snapshot:${userId}:no-facts`, 'info', `[StudentSnapshot] Skip ${userId}: no learning facts in current window`);
    return { skipped: true, reason: 'no_facts', userId, featureCacheRefreshed: true, portraitV2 };
  }

  if (
    previousSnapshot &&
    previousSnapshot.factCount === facts.length &&
    latestFactCreatedAt &&
    latestFactCreatedAt.getTime() <= previousSnapshot.snapshotAt.getTime()
  ) {
    await refreshStudentEvidenceFeatureCache(db, userId, { now: snapshotAt });
    logWithThrottle(`student-snapshot:${userId}:unchanged`, 'info', `[StudentSnapshot] Skip ${userId}: no new facts since latest snapshot`);
    return { skipped: true, reason: 'unchanged_facts', userId, featureCacheRefreshed: true, portraitV2 };
  }

  const evidenceDetails = await loadEvidenceDetails(db, facts);

  const competencyVector = calculateCompetencyVector(facts, '1m');

  if (previousSnapshot) {
    const previousVector = previousSnapshot.competencyVector as unknown as CompetencyVector;
    const trendVector = calculateTrendVector(competencyVector, previousVector);

    for (const dimension of Object.keys(trendVector)) {
      competencyVector[dimension as keyof CompetencyVector].trend =
        trendVector[dimension as keyof CompetencyVector];
    }
  }

  const risks = detectRisks({
    userId,
    facts,
    competencyVector,
    previousSnapshot: previousSnapshot?.competencyVector as unknown as CompetencyVector,
  });

  const snapshot = await db.studentCompetencySnapshot.create({
    data: {
      userId,
      snapshotAt,
      competencyVector: competencyVector as unknown as Prisma.InputJsonValue,
      evidenceSummary: generateEvidenceSummary(facts, 3, evidenceDetails) as unknown as Prisma.InputJsonValue,
      riskFlags: risks.map((risk) => risk.type),
      factCount: facts.length,
    },
  });

  await updateProfileSummary(userId, competencyVector, risks, facts);
  await refreshStudentGrowthEvaluation(db, {
    snapshot: {
      id: snapshot.id,
      userId,
      snapshotAt,
      factCount: facts.length,
      competencyVector,
      evidenceSummary: snapshot.evidenceSummary,
    },
  });
  await refreshStudentEvidenceFeatureCache(db, userId, { now: snapshotAt });

  await db.studentRiskFlag.updateMany({
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
    await db.studentRiskFlag.createMany({
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

  return {
    snapshotId: snapshot.id,
    factCount: facts.length,
    riskCount: risks.length,
    featureCacheRefreshed: true,
    portraitV2,
  };
}

async function updateProfileSummary(
  userId: string,
  vector: CompetencyVector,
  risks: ReturnType<typeof detectRisks>,
  facts: Array<{ factType: string; outcome: string; startedAt: Date }>,
) {
  const db = getPrismaClient();
  const strengths = identifyStrengths(vector);
  const weaknesses = identifyWeaknesses(vector);
  const riskLevel = getRiskLevelDescription(risks.length);

  const recentActivity = facts.slice(0, 5).map((fact) => ({
    type: fact.factType,
    outcome: fact.outcome,
    date: fact.startedAt.toISOString(),
  }));

  const trendDirection = calculateOverallTrend(vector);
  const trendDescriptions: Record<string, string> = {
    up: '近两周稳步提升',
    stable: '近期表现平稳',
    down: '近期出现下滑',
  };

  await db.studentProfileSummary.upsert({
    where: { userId },
    update: {
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map((risk) => risk.description) as Prisma.InputJsonValue,
      riskLevel,
      recommendedScaffolding: getRecommendedScaffolding(risks),
      recentActivityJson: recentActivity as Prisma.InputJsonValue,
      cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    create: {
      userId,
      overallLevel: getOverallLevel(vector),
      overallScore: calculateOverallScore(vector),
      strengthsJson: strengths as Prisma.InputJsonValue,
      weaknessesJson: weaknesses as Prisma.InputJsonValue,
      recentTrend: trendDescriptions[trendDirection],
      trendDirection,
      riskFlagsJson: risks.map((risk) => risk.description) as Prisma.InputJsonValue,
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
  const scores = Object.values(vector).map((value) => value.score);
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function calculateOverallTrend(vector: CompetencyVector): 'up' | 'stable' | 'down' {
  const trends = Object.values(vector).map((value) => value.trend);
  const upCount = trends.filter((item) => item === 'up').length;
  const downCount = trends.filter((item) => item === 'down').length;

  if (upCount > downCount + 1) return 'up';
  if (downCount > upCount + 1) return 'down';
  return 'stable';
}

async function processClassSnapshotJob(job: Job<ClassSnapshotJob>) {
  if (job.data.coordinator) {
    const db = getPrismaClient();
    const classes = await db.class.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const triggerId = new Date().toISOString().slice(0, 10);
    for (const cls of classes) {
      await enqueueClassSnapshot(cls.id, triggerId);
    }

    logWithThrottle(
      'class-snapshot:coordinator',
      'info',
      `[ClassSnapshot] Scheduled ${classes.length} class snapshot jobs`,
    );

    return { scheduled: classes.length };
  }

  if (!job.data.classId) {
    throw new Error('snapshot-class job requires classId unless it is a coordinator job');
  }

  const db = getPrismaClient();
  const { classId } = job.data;

  const students = await db.studentProfile.findMany({
    where: { classId },
    select: { userId: true },
  });

  const snapshots = await Promise.all(
    students.map((student) =>
      db.studentCompetencySnapshot.findFirst({
        where: { userId: student.userId },
        orderBy: { snapshotAt: 'desc' },
      }),
    ),
  );

  const validStudentSnapshots = students
    .map((student, index) => ({ student, snapshot: snapshots[index] }))
    .filter((row): row is { student: { userId: string }; snapshot: NonNullable<typeof row.snapshot> } =>
      Boolean(row.snapshot) && row.snapshot.factCount > 0
    );
  const portraitResolutions = await Promise.all(students.map((student, index) =>
    resolvePrimaryPortraitV2(db, student.userId, 'reviewer', {
      legacySnapshot: snapshots[index] as Record<string, unknown> | null,
    })
  ));
  const portraitRows = students
    .map((student, index) => ({
      snapshot: snapshots[index] ?? null,
      payload: portraitResolutions[index].primaryPortrait,
    }))
    .filter(({ snapshot, payload }) => Boolean(snapshot?.factCount) || payload.dimensions.some((dimension) => dimension.evidenceSummary.totalCount > 0));
  if (portraitRows.length === 0) {
    return { studentCount: 0, snapshotId: null };
  }
  const aggregate = aggregatePortraitV2(portraitRows.map((row) => row.payload));
  const distribution = calculatePortraitLevelDistribution(portraitRows.map((row) => row.payload));
  const riskSummary = calculateRiskSummary(validStudentSnapshots.map((row) => row.snapshot));
  const previousClassSnapshot = await db.classCompetencySnapshot.findFirst({
    where: { classId },
    orderBy: { snapshotAt: 'desc' },
  });
  if (previousClassSnapshot && isSameClassAggregate(aggregate, previousClassSnapshot.aggregateJson)) {
    return {
      snapshotId: previousClassSnapshot.id,
      studentCount: portraitRows.length,
      skipped: true,
      reason: 'unchanged_aggregate',
    };
  }
  const trend = calculateClassTrend(aggregate, previousClassSnapshot?.aggregateJson);

  const snapshot = await db.classCompetencySnapshot.create({
    data: {
      classId,
      snapshotAt: new Date(),
      aggregateJson: aggregate as unknown as Prisma.InputJsonValue,
      distributionJson: distribution as unknown as Prisma.InputJsonValue,
      trendJson: trend as Prisma.InputJsonValue,
      riskSummaryJson: riskSummary as unknown as Prisma.InputJsonValue,
      levelDistribution: distribution as unknown as Prisma.InputJsonValue,
      activeStudentCount: portraitRows.length,
      totalStudentCount: students.length,
    },
  });

  return {
    snapshotId: snapshot.id,
    studentCount: portraitRows.length,
  };
}

function calculatePortraitLevelDistribution(payloads: PortraitV2PayloadShape[]) {
  const levels = { excellent: 0, good: 0, average: 0, needsImprovement: 0, atRisk: 0 };

  for (const payload of payloads) {
    const overallScore = summarizePortraitV2(payload).overallScore;
    if (overallScore >= 85) levels.excellent += 1;
    else if (overallScore >= 70) levels.good += 1;
    else if (overallScore >= 55) levels.average += 1;
    else if (overallScore >= 40) levels.needsImprovement += 1;
    else levels.atRisk += 1;
  }

  return levels;
}

function calculateRiskSummary(snapshots: Array<{ riskFlags: unknown }>) {
  const allFlags = snapshots.flatMap((snapshot) => snapshot.riskFlags as string[]);
  const summary: Record<string, number> = {};

  for (const flag of allFlags) {
    summary[flag] = (summary[flag] || 0) + 1;
  }

  return summary;
}

function calculateClassTrend(
  current: PortraitV2ClassAggregate,
  previous: unknown,
) {
  const previousAggregate = readRecord(previous);
  const previousDimensions = Object.keys(readRecord(previousAggregate.dimensions)).length > 0
    ? readRecord(previousAggregate.dimensions)
    : previousAggregate;
  return Object.fromEntries(Object.entries(current.dimensions).map(([dimension, value]) => {
    const previousValue = readRecord(previousDimensions[dimension]);
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
  current: PortraitV2ClassAggregate,
  previous: unknown,
) {
  const previousAggregate = readRecord(previous);
  const previousDimensions = Object.keys(readRecord(previousAggregate.dimensions)).length > 0
    ? readRecord(previousAggregate.dimensions)
    : previousAggregate;
  return Object.entries(current.dimensions).every(([dimension, value]) => {
    const previousValue = readRecord(previousDimensions[dimension]);
    return previousValue.mean === value.mean && previousValue.stdDev === value.stdDev;
  });
}

async function processSessionReportJob(job: Job<SessionReportJob>) {
  if (!job.data.sessionId) {
    throw new Error('session-report job requires sessionId');
  }

  const db = getPrismaClient();
  return generateSessionSummaryReports(db, job.data.sessionId);
}

async function processEvidenceFeatureCacheJob(job: Job<EvidenceFeatureCacheJob>) {
  const db = getPrismaClient();

  if (job.data.coordinator || job.data.rebuildAll) {
    const result = await rebuildStudentEvidenceFeatureCache(db);
    logWithThrottle(
      'evidence-feature-cache:rebuild',
      'info',
      `[EvidenceFeatureCache] Rebuilt ${result.processedStudents} student feature cache entries`,
    );
    return result;
  }

  if (!job.data.userId) {
    throw new Error('evidence-feature-cache job requires userId unless it is a coordinator rebuild job');
  }

  await refreshStudentEvidenceFeatureCache(db, job.data.userId);
  return { userId: job.data.userId, refreshed: true };
}

async function startWorkers() {
  await respectCooldown();

  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  prisma = createPrismaClient();

  redis.on('error', (error) => {
    if (isInfrastructureError(error)) {
      void handleInfrastructureFailure('redis:error', error);
      return;
    }

    logWithThrottle('redis:error', 'error', '[Worker] Redis emitted a non-fatal error', error);
  });

  redis.on('close', () => {
    if (!isShuttingDown) {
      void handleInfrastructureFailure('redis:close', new Error('Redis connection closed'));
    }
  });

  eventQueue = new Queue<EventIngestionJob>('event-ingestion', { connection: redis });
  studentQueue = new Queue<StudentSnapshotJob>('snapshot-student', { connection: redis });
  classQueue = new Queue<ClassSnapshotJob>('snapshot-class', { connection: redis });
  reportQueue = new Queue<SessionReportJob>('session-report', { connection: redis });
  evidenceFeatureCacheQueue = new Queue<EvidenceFeatureCacheJob>('evidence-feature-cache', { connection: redis });

  eventIngestionWorker = new Worker<EventIngestionJob>('event-ingestion', processEventIngestionJob, {
    connection: redis,
    concurrency: WORKER_CONCURRENCY,
  });
  studentSnapshotWorker = new Worker<StudentSnapshotJob>('snapshot-student', processStudentSnapshotJob, {
    connection: redis,
    concurrency: WORKER_CONCURRENCY,
  });
  classSnapshotWorker = new Worker<ClassSnapshotJob>('snapshot-class', processClassSnapshotJob, {
    connection: redis,
    concurrency: 1,
  });
  sessionReportWorker = new Worker<SessionReportJob>('session-report', processSessionReportJob, {
    connection: redis,
    concurrency: 1,
  });
  evidenceFeatureCacheWorker = new Worker<EvidenceFeatureCacheJob>('evidence-feature-cache', processEvidenceFeatureCacheJob, {
    connection: redis,
    concurrency: 1,
  });

  registerWorkerHandlers('EventIngestion', eventIngestionWorker);
  registerWorkerHandlers('StudentSnapshot', studentSnapshotWorker);
  registerWorkerHandlers('ClassSnapshot', classSnapshotWorker);
  registerWorkerHandlers('SessionReport', sessionReportWorker);
  registerWorkerHandlers('EvidenceFeatureCache', evidenceFeatureCacheWorker);

  process.on('SIGTERM', () => {
    void shutdown(0);
  });
  process.on('SIGINT', () => {
    void shutdown(0);
  });
  process.on('unhandledRejection', (reason) => {
    void handleFatalProcessError('unhandledRejection', reason);
  });
  process.on('uncaughtException', (error) => {
    void handleFatalProcessError('uncaughtException', error);
  });

  console.log('[Worker] Data governance worker started');
  console.log(`[Worker] Concurrency: ${WORKER_CONCURRENCY}`);
}

async function shutdown(exitCode: number) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('[Worker] Shutting down...');

  const cleanupTasks: Array<Promise<unknown>> = [];

  if (eventIngestionWorker) cleanupTasks.push(eventIngestionWorker.close());
  if (studentSnapshotWorker) cleanupTasks.push(studentSnapshotWorker.close());
  if (classSnapshotWorker) cleanupTasks.push(classSnapshotWorker.close());
  if (sessionReportWorker) cleanupTasks.push(sessionReportWorker.close());
  if (evidenceFeatureCacheWorker) cleanupTasks.push(evidenceFeatureCacheWorker.close());
  if (eventQueue) cleanupTasks.push(eventQueue.close());
  if (studentQueue) cleanupTasks.push(studentQueue.close());
  if (classQueue) cleanupTasks.push(classQueue.close());
  if (reportQueue) cleanupTasks.push(reportQueue.close());
  if (evidenceFeatureCacheQueue) cleanupTasks.push(evidenceFeatureCacheQueue.close());
  if (prisma) cleanupTasks.push(prisma.$disconnect());
  if (redis) {
    cleanupTasks.push(
      redis.quit().catch(() => {
        redis?.disconnect();
      }),
    );
  }

  await Promise.allSettled(cleanupTasks);

  console.log('[Worker] Shutdown complete');
  process.exit(exitCode);
}

startWorkers().catch(async (error) => {
  if (isInfrastructureError(error)) {
    await handleInfrastructureFailure('worker:start', error);
    return;
  }

  logWithThrottle('worker:start', 'error', '[Worker] Failed to start data governance worker', error);
  await shutdown(1);
});

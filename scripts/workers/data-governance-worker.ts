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
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { Job, Queue, Worker } from 'bullmq';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { fetchSecondaryEvents, markEventsProcessed } from '@/lib/data-governance/event-buffer';
import {
  eventToLearningFactInput,
} from '@/lib/data-governance/learning-fact-materialization';
import {
  selectLearningFactAuthority,
  writeKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';
import { applyStagedMicroInterventionEvidence } from '@/features/learning-record/personalization-ports/public-api';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import {
  rebuildStudentEvidenceFeatureCache,
  refreshStudentEvidenceFeatureCache,
} from '@/lib/data-governance/student-evidence-feature-cache';
import {
  materializeIncrementalPortraitV2,
  type PortraitV2PublicationExpectation,
} from '@/lib/data-governance/portrait-v2-materialization';
import {
  materializeCumulativeClassPortrait,
  type CumulativeClassPublicationExpectation,
} from '@/lib/data-governance/cumulative-class-materialization';
import {
  claimCumulativeLearnerReconciliations,
  completeCumulativeLearnerReconciliation,
  enqueueCumulativeClassReconciliation,
  failCumulativeLearnerReconciliation,
  readActiveCumulativePublicationFence as readActiveCumulativePublicationFenceOrNull,
  renewCumulativeLearnerReconciliation,
  requestCumulativeLearnerReconciliation,
  type ActiveCumulativePublicationFence,
  type CumulativeLearnerReconciliationClaim,
} from '@/lib/data-governance/cumulative-snapshot-jobs';
import { SimulationTaskInputDriftError } from '@/lib/data-governance/simulation-task-portrait-projection';
import { scheduleSimulationTaskCatalogRefresh } from '@/lib/data-governance/simulation-task-reconciliation';
import type { LearningEvent } from '@/lib/data-governance/event-protocol';
import { scanAllStudentRisks, type RiskScannerDb } from '@/lib/risk-scanner';
import type {
  ClassSnapshotJob,
  EventIngestionJob,
  EvidenceFeatureCacheJob,
  RiskFlagScanJob,
  SessionReportJob,
  StudentSnapshotJob,
} from './types';
import { createMathDocumentGradingWorker } from './math-document-grading-worker';
import { createTeacherAssignmentReviewOutboxWorker } from './teacher-assignment-review-outbox-worker';
import { createDefaultReviewedDerivativeRenderer } from '@/lib/data-governance/teacher-assignment-review-derivative-storage';
import { defaultReviewedDerivativeOptions } from '@/lib/data-governance/teacher-assignment-review-derivative';
import {
  closeCoursewareGenerationWorker,
  ensureCoursewareGenerationWorker,
} from '@/lib/smart-courseware/worker';

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
let riskFlagQueue: Queue<RiskFlagScanJob> | null = null;
let eventIngestionWorker: Worker<EventIngestionJob> | null = null;
let studentSnapshotWorker: Worker<StudentSnapshotJob> | null = null;
let classSnapshotWorker: Worker<ClassSnapshotJob> | null = null;
let sessionReportWorker: Worker<SessionReportJob> | null = null;
let evidenceFeatureCacheWorker: Worker<EvidenceFeatureCacheJob> | null = null;
let riskFlagWorker: Worker<RiskFlagScanJob> | null = null;
let mathDocumentGradingController: Awaited<ReturnType<typeof createMathDocumentGradingWorker>> | null = null;
let teacherAssignmentReviewController: ReturnType<typeof createTeacherAssignmentReviewOutboxWorker> | null = null;
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

export function configureDataGovernanceWorkerForTest(input: {
  db: PrismaClient;
  studentJobQueue?: Pick<Queue<StudentSnapshotJob>, 'add'>;
  classJobQueue?: Pick<Queue<ClassSnapshotJob>, 'add'>;
}) {
  prisma = input.db;
  studentQueue = input.studentJobQueue ? input.studentJobQueue as Queue<StudentSnapshotJob> : null;
  classQueue = input.classJobQueue ? input.classJobQueue as Queue<ClassSnapshotJob> : null;
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

type JsonSafe<T> =
  T extends bigint ? string :
  T extends Date ? string :
  T extends readonly (infer Item)[] ? Array<JsonSafe<Item>> :
  T extends object ? { [Key in keyof T]: JsonSafe<T[Key]> } :
  T;

function toJsonSafeWorkerResult<T>(value: T): JsonSafe<T> {
  if (typeof value === 'bigint') return value.toString() as JsonSafe<T>;
  if (value instanceof Date) return value.toISOString() as JsonSafe<T>;
  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeWorkerResult(item)) as JsonSafe<T>;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        toJsonSafeWorkerResult(item),
      ]),
    ) as JsonSafe<T>;
  }
  return value as JsonSafe<T>;
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

async function readActiveCumulativePublicationFence(
  db: PrismaClient,
): Promise<ActiveCumulativePublicationFence> {
  const fence = await readActiveCumulativePublicationFenceOrNull(db);
  if (!fence) {
    throw new Error('No active cumulative portrait publication fence is available.');
  }
  return fence;
}

function studentPublicationJobData(
  userId: string,
  fence: ActiveCumulativePublicationFence,
  options: {
    fullRebuild?: boolean;
    reconciliationClaim?: CumulativeLearnerReconciliationClaim;
  } = {},
): StudentSnapshotJob {
  return {
    userId,
    ...(options.fullRebuild ? { fullRebuild: true } : {}),
    calculationVersion: fence.calculationVersion,
    learnerGeneration: fence.learnerGeneration.toString(),
    queueGeneration: fence.queueGeneration.toString(),
    cutoverFence: fence.fence.toString(),
    migrationRunId: fence.activeMigrationRunId,
    ...(options.reconciliationClaim ? {
      reconciliationRequestGeneration: options.reconciliationClaim.generation,
      reconciliationClaimToken: options.reconciliationClaim.claimToken,
      reconciliationClassIds: options.reconciliationClaim.classIds,
      ...(options.reconciliationClaim.simulationTaskInput ? {
        simulationTaskExpectedInputDigest:
          options.reconciliationClaim.simulationTaskInput.inputDigest,
      } : {}),
    } : {}),
  };
}

async function enqueueStudentSnapshot(
  userId: string,
  triggerId: string,
  fence: ActiveCumulativePublicationFence,
  options: {
    fullRebuild?: boolean;
    reconciliationClaim?: CumulativeLearnerReconciliationClaim;
  } = {},
) {
  if (!studentQueue) {
    throw new Error('student queue is not initialized');
  }

  await studentQueue.add(
    `student-snapshot-${userId}`,
    studentPublicationJobData(userId, fence, options),
    {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      jobId: `student-snapshot-${userId}-${triggerId}`,
      ...JOB_HISTORY_OPTIONS,
    },
  );
}

function reconciliationClaimFromJob(
  data: StudentSnapshotJob,
  fence: ActiveCumulativePublicationFence,
): CumulativeLearnerReconciliationClaim | null {
  if (
    !data.userId ||
    !Number.isInteger(data.reconciliationRequestGeneration) ||
    !data.reconciliationClaimToken
  ) return null;
  return {
    userId: data.userId,
    classIds: Array.isArray(data.reconciliationClassIds)
      ? [...new Set(data.reconciliationClassIds.filter(Boolean))]
      : [],
    generation: data.reconciliationRequestGeneration!,
    claimToken: data.reconciliationClaimToken,
    fence,
  };
}

async function enqueueClassSnapshot(
  classId: string,
  triggerId: string,
  fence: ActiveCumulativePublicationFence,
) {
  if (!classQueue) {
    throw new Error('class queue is not initialized');
  }
  await enqueueCumulativeClassReconciliation({
    classIds: [classId],
    mutationIdentity: `coordinator:${triggerId}`,
    db: getPrismaClient(),
    queue: classQueue,
    fence,
  });
}

async function enqueueClassSnapshotForStudent(
  classId: string,
  userId: string,
  sourceJobId: string,
  fence: ActiveCumulativePublicationFence,
) {
  if (!classQueue) throw new Error('class queue is not initialized');
  await enqueueCumulativeClassReconciliation({
    classIds: [classId],
    mutationIdentity: `student:${userId}:${sourceJobId}`,
    db: getPrismaClient(),
    queue: classQueue,
    fence,
  });
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

export async function processEventIngestionJob(job: Job<EventIngestionJob>) {
  try {
    if (prisma) {
      await applyStagedMicroInterventionEvidence(prisma as never);
    }
  } catch (error) {
    console.error('[EventIngestion] micro-intervention evidence projection failed:', error);
  }
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
    // Realtime knowledge-scoped facts must resolve the active authority selector
    // and write through the fixed-identity adapter (pre-cutover: LEGACY).
    const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
    const activeRevision = await resolveActiveKnowledgeRevision(db);
    const result = await writeKnowledgeScopedLearningFacts(
      {
        learningFact: {
          createMany: async (args) => db.learningFact.createMany({
            data: args.data as Prisma.LearningFactCreateManyInput[],
            skipDuplicates: args.skipDuplicates,
          }),
        },
      },
      {
        rows: facts as LearningFactWriteRow[],
        knowledgeScoped: true,
      },
      {
        selector,
        knowledgeRevisionRef: activeRevision.id,
      },
    );
    factsCreated = result.written;
    const triggerId = String(job.id ?? batchDate);
    const fence = await readActiveCumulativePublicationFence(db);
    for (const userId of new Set(facts.map((fact) => fact.userId))) {
      await enqueueStudentSnapshot(userId, triggerId, fence);
    }
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

function parseJobBigInt(value: string | undefined): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function readStudentPublicationExpectation(
  data: StudentSnapshotJob,
): PortraitV2PublicationExpectation | null {
  const generation = parseJobBigInt(data.learnerGeneration);
  const queueGeneration = parseJobBigInt(data.queueGeneration);
  const cutoverFence = parseJobBigInt(data.cutoverFence);
  if (
    !data.calculationVersion ||
    generation === null ||
    queueGeneration === null ||
    cutoverFence === null ||
    !data.migrationRunId
  ) return null;
  return {
    calculationVersion: data.calculationVersion,
    generation,
    queueGeneration,
    cutoverFence,
    migrationRunId: data.migrationRunId,
  };
}

function readClassPublicationExpectation(
  data: ClassSnapshotJob,
): CumulativeClassPublicationExpectation | null {
  const learnerGeneration = parseJobBigInt(data.learnerGeneration);
  const generation = parseJobBigInt(data.classGeneration);
  const queueGeneration = parseJobBigInt(data.queueGeneration);
  const cutoverFence = parseJobBigInt(data.cutoverFence);
  if (
    !data.calculationVersion ||
    learnerGeneration === null ||
    generation === null ||
    queueGeneration === null ||
    cutoverFence === null ||
    !data.migrationRunId
  ) return null;
  return {
    calculationVersion: data.calculationVersion,
    learnerGeneration,
    generation,
    queueGeneration,
    cutoverFence,
    migrationRunId: data.migrationRunId,
  };
}

function matchesStudentFence(
  expectation: PortraitV2PublicationExpectation,
  fence: ActiveCumulativePublicationFence,
): boolean {
  return (
    expectation.calculationVersion === fence.calculationVersion &&
    expectation.generation === fence.learnerGeneration &&
    expectation.queueGeneration === fence.queueGeneration &&
    expectation.cutoverFence === fence.fence &&
    expectation.migrationRunId === fence.activeMigrationRunId
  );
}

function matchesClassFence(
  expectation: CumulativeClassPublicationExpectation,
  fence: ActiveCumulativePublicationFence,
): boolean {
  return (
    expectation.calculationVersion === fence.calculationVersion &&
    expectation.learnerGeneration === fence.learnerGeneration &&
    expectation.generation === fence.classGeneration &&
    expectation.queueGeneration === fence.queueGeneration &&
    expectation.cutoverFence === fence.fence &&
    expectation.migrationRunId === fence.activeMigrationRunId
  );
}

export async function processStudentSnapshotJob(job: Job<StudentSnapshotJob>) {
  if (job.data.coordinator) {
    const db = getPrismaClient();
    const fence = await readActiveCumulativePublicationFence(db);
    const catalogRefresh = job.data.simulationTaskCatalogRefresh
      ? await scheduleSimulationTaskCatalogRefresh(db as any)
      : null;
    const claims = await claimCumulativeLearnerReconciliations(db as any, fence);
    let requestFailed = 0;
    for (const claim of claims) {
      try {
        await enqueueStudentSnapshot(
          claim.userId,
          `reconcile-${claim.generation}-${fence.fence}`,
          fence,
          { fullRebuild: true, reconciliationClaim: claim },
        );
      } catch {
        requestFailed += 1;
        await failCumulativeLearnerReconciliation(
          db as any,
          claim,
          'learner-queue-unavailable',
        );
      }
    }

    const activeStudentIds = await getActiveStudentIds();
    const claimedUserIds = new Set(claims.map((claim) => claim.userId));
    const regularStudentIds = activeStudentIds.filter((userId) => !claimedUserIds.has(userId));
    if (regularStudentIds.length === 0 && claims.length === 0) {
      logWithThrottle('student-snapshot:coordinator', 'info', '[StudentSnapshot] No active students in the last 90 minutes');
      return { scheduled: 0, reconciliationScheduled: 0, reconciliationFailed: 0 };
    }

    const triggerId = new Date().toISOString().slice(0, 13);
    for (const userId of regularStudentIds) {
      await enqueueStudentSnapshot(userId, triggerId, fence);
    }

    logWithThrottle(
      'student-snapshot:coordinator',
      'info',
      `[StudentSnapshot] Scheduled ${regularStudentIds.length} active and ${claims.length - requestFailed} reconciliation jobs`,
    );

    return {
      scheduled: regularStudentIds.length + claims.length - requestFailed,
      reconciliationScheduled: claims.length - requestFailed,
      reconciliationFailed: requestFailed,
      catalogRefresh,
    };
  }

  if (!job.data.userId) {
    throw new Error('snapshot-student job requires userId unless it is a coordinator job');
  }

  const db = getPrismaClient();
  const { userId } = job.data;
  const expectation = readStudentPublicationExpectation(job.data);
  if (!expectation) {
    return { skipped: true, reason: 'missing_cumulative_publication_fence', userId };
  }
  const fence = await readActiveCumulativePublicationFence(db);
  if (!matchesStudentFence(expectation, fence)) {
    return { skipped: true, reason: 'stale_cumulative_publication_fence', userId };
  }

  const reconciliationClaim = reconciliationClaimFromJob(job.data, fence);
  if (job.data.reconciliationRequestGeneration !== undefined && !reconciliationClaim) {
    return { skipped: true, reason: 'invalid_reconciliation_claim', userId };
  }
  if (
    reconciliationClaim &&
    !await renewCumulativeLearnerReconciliation(db as any, reconciliationClaim)
  ) {
    return { skipped: true, reason: 'stale_reconciliation_claim', userId };
  }

  try {
    const portraitV2 = await materializeIncrementalPortraitV2(db as any, userId, {
      now: new Date(),
      fullRebuild: reconciliationClaim ? true : job.data.fullRebuild,
      publication: expectation,
      simulationTaskInput: job.data.simulationTaskExpectedInputDigest ? {
        expectedInputDigest: job.data.simulationTaskExpectedInputDigest,
      } : undefined,
    });
    if (portraitV2.mappingIssues.length > 0) {
      logWithThrottle(
        `student-snapshot:${userId}:portrait-v2-mapping`,
        'warn',
        `[StudentSnapshot] Portrait v2 mapping issues for ${userId}: ${portraitV2.mappingIssues.join(', ')}`,
      );
    }
    const profile = await db.studentProfile.findUnique({
      where: { userId },
      select: { classId: true },
    });
    const classIds = reconciliationClaim
      ? [...new Set([
          ...reconciliationClaim.classIds,
          ...(profile?.classId ? [profile.classId] : []),
        ])]
      : profile?.classId ? [profile.classId] : [];
    for (const classId of classIds) {
      await enqueueClassSnapshotForStudent(
        classId,
        userId,
        String(job.id ?? portraitV2.stateVersionId ?? `manual:${userId}`),
        fence,
      );
    }
    if (
      reconciliationClaim &&
      !await completeCumulativeLearnerReconciliation(db as any, reconciliationClaim)
    ) {
      return {
        skipped: true,
        reason: 'stale_reconciliation_claim',
        userId,
        portraitV2: toJsonSafeWorkerResult(portraitV2),
      };
    }
    return {
      skipped: !portraitV2.written,
      reason: portraitV2.written ? 'cumulative_portrait_materialized' : 'no_portrait_state_change',
      userId,
      portraitV2: toJsonSafeWorkerResult(portraitV2),
    };
  } catch (error) {
    if (reconciliationClaim && error instanceof SimulationTaskInputDriftError) {
      try {
        const generation = await requestCumulativeLearnerReconciliation(db as any, {
          userId,
          classIds: reconciliationClaim.classIds,
          reason: 'simulation-task-input-drift',
          simulationTaskInput: error.actualInput,
        });
        return {
          skipped: true,
          reason: 'simulation_task_input_drift_requeued',
          userId,
          reconciliationRequestGeneration: generation,
        };
      } catch (rescheduleError) {
        await failCumulativeLearnerReconciliation(
          db as any,
          reconciliationClaim,
          'simulation-task-input-drift-reschedule-failed',
        );
        throw rescheduleError;
      }
    }
    if (reconciliationClaim) {
      await failCumulativeLearnerReconciliation(
        db as any,
        reconciliationClaim,
        'learner-materialization-or-class-enqueue-failed',
      );
    }
    throw error;
  }
}

export async function processClassSnapshotJob(job: Job<ClassSnapshotJob>) {
  if (job.data.coordinator) {
    const db = getPrismaClient();
    const fence = await readActiveCumulativePublicationFence(db);
    const classes = await db.class.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const triggerId = new Date().toISOString().slice(0, 10);
    for (const cls of classes) {
      await enqueueClassSnapshot(cls.id, triggerId, fence);
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
  const requestedScope = (job.data as { scope?: string }).scope;
  if (requestedScope && requestedScope !== 'cumulative') {
    return { skipped: true, reason: 'unsupported_scope', classId, scope: requestedScope };
  }
  const expectation = readClassPublicationExpectation(job.data);
  if (!expectation) {
    return { skipped: true, reason: 'missing_cumulative_publication_fence', classId };
  }
  const fence = await readActiveCumulativePublicationFence(db);
  if (!matchesClassFence(expectation, fence)) {
    return { skipped: true, reason: 'stale_cumulative_publication_fence', classId };
  }
  const result = await materializeCumulativeClassPortrait(db as any, classId, {
    now: new Date(),
    publication: expectation,
  });
  return toJsonSafeWorkerResult(result);
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
    const result = await rebuildStudentEvidenceFeatureCache(db as any);
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

  await refreshStudentEvidenceFeatureCache(db as any, job.data.userId);
  return { userId: job.data.userId, refreshed: true };
}

export async function processRiskFlagScanJob(job: Job<RiskFlagScanJob>) {
  if (!job.data.coordinator) {
    throw new Error('risk-flag-scan job must be a coordinator job');
  }

  const results = await scanAllStudentRisks({
    db: getPrismaClient() as unknown as RiskScannerDb,
    pageSize: job.data.pageSize,
    maxStudents: job.data.maxStudents,
  });
  const totals = results.reduce(
    (summary, result) => ({
      created: summary.created + result.flagsCreated,
      updated: summary.updated + result.flagsUpdated,
      resolved: summary.resolved + result.flagsResolved,
      unchanged: summary.unchanged + result.unchanged,
      failures: summary.failures + result.failures,
    }),
    { created: 0, updated: 0, resolved: 0, unchanged: 0, failures: 0 },
  );
  logWithThrottle(
    'risk-flag-scan:coordinator',
    'info',
    `[RiskFlagScan] Processed ${results.length} students: `
      + `${totals.created} created, ${totals.updated} updated, `
      + `${totals.resolved} resolved, ${totals.unchanged} unchanged, `
      + `${totals.failures} failed rules`,
  );
  return {
    processedStudents: results.length,
    ...totals,
  };
}

async function startWorkers() {
  await respectCooldown();

  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  prisma = createPrismaClient();
  await ensureCoursewareGenerationWorker(redis);
  console.log('[Worker] Smart courseware generation worker started');
  if (isMathDocumentGradingWorkerRequired()) {
    mathDocumentGradingController = await createMathDocumentGradingWorker({
      db: prisma,
      redis,
      concurrency: Number(process.env.MATH_DOCUMENT_GRADING_WORKER_CONCURRENCY ?? WORKER_CONCURRENCY),
    });
  } else {
    console.log('[Worker] Math document grading worker disabled by MATH_DOCUMENT_GRADING_WORKER_REQUIRED');
  }
  if (isTeacherAssignmentReviewWorkerRequired()) {
    teacherAssignmentReviewController = createTeacherAssignmentReviewOutboxWorker({
      db: prisma,
      handlers: {
        derivativeRenderer: createDefaultReviewedDerivativeRenderer(),
        derivativeOptions: defaultReviewedDerivativeOptions({ generatorVersion: process.env.TEACHER_REVIEW_DERIVATIVE_GENERATOR_VERSION, markitdownVersion: process.env.MARKITDOWN_VERSION, mathpixVersion: process.env.MATHPIX_VERSION }),
      },
      intervalMs: Number(process.env.TEACHER_REVIEW_OUTBOX_INTERVAL_MS ?? 5_000),
      limit: Number(process.env.TEACHER_REVIEW_OUTBOX_BATCH_SIZE ?? 25),
      onError: (error) => logWithThrottle('teacher-review-outbox:error', 'error', '[TeacherReviewOutbox] tick failed', error),
    });
  } else {
    console.log('[Worker] Teacher assignment review outbox disabled by TEACHER_REVIEW_OUTBOX_REQUIRED');
  }

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
  riskFlagQueue = new Queue<RiskFlagScanJob>('risk-flag-scan', { connection: redis });

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
  riskFlagWorker = new Worker<RiskFlagScanJob>('risk-flag-scan', processRiskFlagScanJob, {
    connection: redis,
    concurrency: 1,
  });

  registerWorkerHandlers('EventIngestion', eventIngestionWorker);
  registerWorkerHandlers('StudentSnapshot', studentSnapshotWorker);
  registerWorkerHandlers('ClassSnapshot', classSnapshotWorker);
  registerWorkerHandlers('SessionReport', sessionReportWorker);
  registerWorkerHandlers('EvidenceFeatureCache', evidenceFeatureCacheWorker);
  registerWorkerHandlers('RiskFlagScan', riskFlagWorker);

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

function isMathDocumentGradingWorkerRequired(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED ?? 'true').toLowerCase());
}

function isTeacherAssignmentReviewWorkerRequired(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.TEACHER_REVIEW_OUTBOX_REQUIRED ?? 'true').toLowerCase());
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
  if (riskFlagWorker) cleanupTasks.push(riskFlagWorker.close());
  if (mathDocumentGradingController) cleanupTasks.push(mathDocumentGradingController.close());
  if (teacherAssignmentReviewController) cleanupTasks.push(teacherAssignmentReviewController.close());
  cleanupTasks.push(closeCoursewareGenerationWorker());
  if (eventQueue) cleanupTasks.push(eventQueue.close());
  if (studentQueue) cleanupTasks.push(studentQueue.close());
  if (classQueue) cleanupTasks.push(classQueue.close());
  if (reportQueue) cleanupTasks.push(reportQueue.close());
  if (evidenceFeatureCacheQueue) cleanupTasks.push(evidenceFeatureCacheQueue.close());
  if (riskFlagQueue) cleanupTasks.push(riskFlagQueue.close());
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

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startWorkers().catch(async (error) => {
    if (isInfrastructureError(error)) {
      await handleInfrastructureFailure('worker:start', error);
      return;
    }
    logWithThrottle('worker:start', 'error', '[Worker] Failed to start data governance worker', error);
    await shutdown(1);
  });
}

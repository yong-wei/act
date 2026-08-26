import 'dotenv/config';

import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';

import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';
import { createMathpixClient, resolveLibreOfficeRuntimeVersion } from '../../src/lib/data-governance/math-document-conversion';
import { processQuestionGradingBatch } from '../../src/lib/data-governance/math-document-grading-batch';
import { refreshAssignmentAiGradingOperation } from '../../src/lib/data-governance/assignment-grading-orchestration';
import {
  GRADING_JOB_LEASE_MS,
  processDocumentConversionJob,
  processGradingRunJob,
  writeRenderedObjectToSubmissionStore,
} from '../../src/lib/data-governance/math-document-grading-persistence';
import {
  recoverMathDocumentGradingQueue,
  type MathDocumentGradingJobData,
} from '../../src/lib/data-governance/math-document-grading-queue';
import {
  assertMathDocumentGradingWorkerConfig,
  getMathDocumentGradingWorkerCapabilityStatus,
  MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY,
  MATH_DOCUMENT_GRADING_WORKER_HEARTBEAT_KEY,
  type MathDocumentGradingWorkerCapabilityStatus,
} from '../../src/lib/data-governance/math-document-grading-worker-readiness';
import { createPrismaClient } from '../../src/lib/prisma-client';

const QUEUE_NAME = 'math-document-grading';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const CONCURRENCY = Number(process.env.MATH_DOCUMENT_GRADING_WORKER_CONCURRENCY ?? 2);

function safeWorkerStartupError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('math-document-grading-worker-config-missing:')) return message;
  if (/redis|bullmq/i.test(message)) return 'math-document-grading-worker-redis-unavailable';
  if (/database|postgres|prisma/i.test(message)) return 'math-document-grading-worker-database-unavailable';
  if (/object-store/i.test(message)) return 'math-document-grading-worker-object-store-unavailable';
  if (/libreoffice/i.test(message)) return 'math-document-grading-worker-libreoffice-unavailable';
  return 'math-document-grading-worker-start-failed';
}

async function assertWorkerRuntimeDependencies(db: any): Promise<MathDocumentGradingWorkerCapabilityStatus> {
  const config = assertMathDocumentGradingWorkerConfig();
  try {
    await resolveLibreOfficeRuntimeVersion();
  } catch {
    throw new Error('math-document-grading-worker-libreoffice-unavailable');
  }
  try {
    await db.$queryRawUnsafe('SELECT 1');
  } catch {
    throw new Error('math-document-grading-worker-database-unavailable');
  }
  try {
    createSubmissionObjectStore();
  } catch {
    throw new Error('math-document-grading-worker-object-store-unavailable');
  }
  return config;
}

export async function processMathDocumentGradingJob(job: Job<MathDocumentGradingJobData>, db: any) {
  const workerClaimToken = job.data.workerClaimToken ?? randomUUID();
  job.data.workerClaimToken = workerClaimToken;
  const store = createSubmissionObjectStore();
  if (job.data.kind === 'conversion') {
    const result = await processDocumentConversionJob({
      db,
      jobId: job.data.jobId,
      workerClaimToken,
      store,
      writeRendered: (rendered) => writeRenderedObjectToSubmissionStore({ store, ...rendered }),
      mathpix: createMathpixClient(),
    });
    if (['FAILED', 'RETRYABLE'].includes(result.conversion.state)) throw new Error('document-conversion-retryable');
    return result;
  }
  if (job.data.kind === 'grading') {
    const result = await processGradingRunJob({ db, jobId: job.data.jobId, workerClaimToken });
    return result;
  }
  if (job.data.kind === 'batch' || job.data.kind === 'retry') {
    await refreshAssignmentAiGradingOperation({ db, batchId: job.data.batchId });
    const result = await processQuestionGradingBatch({ db, batchId: job.data.batchId, jobId: job.data.jobId, workerClaimToken, itemId: job.data.kind === 'retry' ? job.data.batchItemId : undefined, store, mathpix: createMathpixClient() });
    await refreshAssignmentAiGradingOperation({ db, batchId: job.data.batchId });
    if (result.batch.state === 'RETRYABLE') throw new Error('grading-batch-retryable');
    return result;
  }
  throw new Error('unsupported-math-document-grading-job');
}

export async function settleMathDocumentGradingJobFailure(input: { db: any; job: Job<MathDocumentGradingJobData>; error: unknown; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const attempts = Math.max(1, Number(input.job.attemptsMade ?? 0));
  const maxAttempts = Number(input.job.opts?.attempts ?? 3);
  const exhausted = attempts >= maxAttempts;
  const code = input.error instanceof Error ? input.error.message.slice(0, 160) : 'math-document-grading-failed';
  const cancelled = /(?:cancelled|canceled|batch-cancelled|grading-cancelled)/i.test(code);
  const policyBlocked = /provider-policy-(?:snapshot|disabled|blocked|purpose)|provider-disabled|mathpix-policy-blocked/i.test(code);
  const contentUnavailable = /content-unavailable|association-missing|attempt-(?:missing|not-found)|asset-missing|conversion-job-not-found|grading-job-not-found/i.test(code);
  const state = cancelled ? 'CANCELLED' : contentUnavailable ? 'CONTENT_UNAVAILABLE' : policyBlocked ? 'BLOCKED' : exhausted ? 'FAILED' : 'RETRYABLE';
  const terminalFailure = cancelled || policyBlocked || exhausted;
  const attemptIdentity = input.job.data.workerClaimToken;
  if (!attemptIdentity) throw new Error('grading-job-failure-attempt-identity-missing');
  const settle = async (db: any): Promise<void> => {
    const parentClaimed = await claimGradingJobForFailureSettlement(db.gradingJob, input.job.data.jobId, attemptIdentity, attempts, now);
    if (!parentClaimed) {
      const current = await db.gradingJob?.findUnique?.({ where: { id: input.job.data.jobId } });
      if (current && ['FAILED', 'BLOCKED', 'CANCELLED', 'CONTENT_UNAVAILABLE'].includes(current.state)) return;
      throw new Error('grading-job-failure-settlement-fenced');
    }
    if (input.job.data.kind === 'conversion') {
      await updateActiveRecord(db.documentConversion, input.job.data.conversionId, { state, failureCode: code, completedAt: terminalFailure || contentUnavailable ? now : null, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE']);
    } else if (input.job.data.kind === 'grading') {
      await updateActiveRecord(db.gradingRun, input.job.data.gradingRunId, { state: contentUnavailable ? 'BLOCKED' : state, blockedReasons: policyBlocked || contentUnavailable ? [code] : undefined, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE']);
    } else if (input.job.data.kind === 'retry') {
      await updateActiveRecord(db.gradingBatchItem, input.job.data.batchItemId, { state: contentUnavailable ? 'BLOCKED' : state, failureCode: code, workerClaimToken: null, workerClaimedAt: null, updatedAt: now }, ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE']);
      if (cancelled || policyBlocked || exhausted || contentUnavailable) await updateActiveRecord(db.gradingBatch, input.job.data.batchId, { state: contentUnavailable ? 'BLOCKED' : state, lastErrorCode: code, completedAt: now, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE']);
      else await updateActiveRecord(db.gradingBatch, input.job.data.batchId, { state: 'RETRYABLE', lastErrorCode: code, nextRunAt: new Date(now.getTime() + 5_000), updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE']);
    } else {
      if (terminalFailure || contentUnavailable) {
        await settleInFlightBatchItems(db, input.job.data.batchId, contentUnavailable ? 'BLOCKED' : state, code, now);
      }
      await updateActiveRecord(db.gradingBatch, input.job.data.batchId, { state: contentUnavailable ? 'BLOCKED' : state, lastErrorCode: code, nextRunAt: terminalFailure || contentUnavailable ? null : new Date(now.getTime() + 5_000), completedAt: terminalFailure || contentUnavailable ? now : null, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE']);
    }
    const settled = await updateActiveRecord(db.gradingJob, input.job.data.jobId, { state, attemptCount: attempts, lastErrorCode: code, nextRunAt: terminalFailure || contentUnavailable ? null : new Date(now.getTime() + 5_000), completedAt: terminalFailure || contentUnavailable ? now : null, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE'], attemptIdentity);
    if (!settled) throw new Error('grading-job-failure-terminal-settlement-fenced');
  };
  if (typeof input.db.$transaction === 'function') await input.db.$transaction((tx: any) => settle(tx));
  else await settle(input.db);
  if (input.job.data.kind === 'batch' || input.job.data.kind === 'retry') {
    await refreshAssignmentAiGradingOperation({ db: input.db, batchId: input.job.data.batchId, now });
  }
}

async function claimGradingJobForFailureSettlement(model: any, id: string | undefined, workerClaimToken: string, attemptCount: number, now: Date): Promise<boolean> {
  if (!model?.updateMany || !id) {
    if (!model?.findUnique || !id) return false;
    const current = await model.findUnique({ where: { id } });
    const currentLeaseExpiresAt = current?.workerLeaseExpiresAt == null ? null : new Date(current.workerLeaseExpiresAt);
    if (
      !current
      || !['QUEUED', 'RUNNING', 'RETRYABLE'].includes(current.state)
      || current.workerClaimToken !== workerClaimToken
      || (currentLeaseExpiresAt !== null && (!Number.isFinite(currentLeaseExpiresAt.getTime()) || currentLeaseExpiresAt <= now))
    ) return false;
    return updateActiveRecord(model, id, { attemptCount, updatedAt: now }, ['QUEUED', 'RUNNING', 'RETRYABLE'], workerClaimToken);
  }
  const result = await model.updateMany({
    where: {
      id,
      OR: [
        {
          state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
          workerClaimToken,
          OR: [
            { workerLeaseExpiresAt: null },
            { workerLeaseExpiresAt: { gt: now } },
          ],
        },
        { state: 'QUEUED', workerClaimToken: null },
      ],
    },
    data: {
      state: 'RUNNING',
      attemptCount,
      workerClaimToken,
      workerClaimedAt: now,
      workerLeaseExpiresAt: new Date(now.getTime() + GRADING_JOB_LEASE_MS),
      updatedAt: now,
    },
  });
  return result?.count === 1;
}

async function settleInFlightBatchItems(db: any, batchId: string | undefined, state: string, code: string, now: Date): Promise<void> {
  if (!db?.gradingBatchItem?.updateMany || !batchId) return;
  await db.gradingBatchItem.updateMany({
    where: { batchId, state: { in: ['CONVERTING', 'GRADING'] } },
    data: { state: state === 'CONTENT_UNAVAILABLE' ? 'BLOCKED' : state, failureCode: code, workerClaimToken: null, workerClaimedAt: null, updatedAt: now },
  });
}

async function updateActiveRecord(model: any, id: string | undefined, data: Record<string, unknown>, activeStates: string[], workerClaimToken?: string): Promise<boolean> {
  if (!model || !id) return false;
  if (model.updateMany) {
    const result = await model.updateMany({ where: { id, state: { in: activeStates }, ...(workerClaimToken ? { workerClaimToken } : {}) }, data });
    return result?.count === undefined ? true : result.count > 0;
  }
  if (!model.update) return false;
  if (workerClaimToken) {
    if (!model.findUnique) return false;
    const current = await model.findUnique({ where: { id } });
    if (!current || current.workerClaimToken !== workerClaimToken) return false;
  }
  await model.update({ where: { id }, data });
  return true;
}

export async function createMathDocumentGradingWorker(input: { db: any; redis: Redis; concurrency?: number; heartbeatKey?: string; capabilityKey?: string }) {
  const concurrency = Number.isFinite(input.concurrency) && (input.concurrency ?? 0) > 0 ? input.concurrency! : 2;
  const heartbeatKey = input.heartbeatKey ?? MATH_DOCUMENT_GRADING_WORKER_HEARTBEAT_KEY;
  const capabilityKey = input.capabilityKey ?? MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY;
  const preflight = getMathDocumentGradingWorkerCapabilityStatus();
  if (!preflight.configReady) {
    await input.redis.set(capabilityKey, JSON.stringify(preflight), 'EX', 30).catch(() => undefined);
    throw new Error(`math-document-grading-worker-config-missing:${preflight.missing.join(',')}`);
  }
  const config = await assertWorkerRuntimeDependencies(input.db);
  const worker = new Worker<MathDocumentGradingJobData>(QUEUE_NAME, (job) => processMathDocumentGradingJob(job, input.db), { connection: input.redis, concurrency });
  const queue = new Queue<MathDocumentGradingJobData>(QUEUE_NAME, { connection: input.redis });
  try {
    await worker.waitUntilReady();
  } catch {
    await worker.close().catch(() => undefined);
    await queue.close().catch(() => undefined);
    throw new Error('math-document-grading-worker-redis-unavailable');
  }
  const capability: MathDocumentGradingWorkerCapabilityStatus = {
    ...config,
    ready: true,
    configReady: true,
    capabilities: { ...config.capabilities, database: true, redis: true },
  };
  const heartbeat = async () => {
    await input.redis.set(heartbeatKey, 'ready', 'EX', 30);
    await input.redis.set(capabilityKey, JSON.stringify(capability), 'EX', 30);
  };
  await heartbeat();
  const heartbeatTimer = setInterval(() => { void heartbeat().catch(() => console.error('[MathDocumentGrading] heartbeat failed')); }, 10_000);
  const recoveryTimer = setInterval(() => {
    void recoverMathDocumentGradingQueue({ db: input.db, queue, limit: 100 }).then((result) => {
      if (result.scanned > 0) console.log(`[MathDocumentGrading] recovery scanned=${result.scanned} queued=${result.queued} failed=${result.failed}`);
    }).catch(() => console.error('[MathDocumentGrading] recovery failed'));
  }, 15_000);
  worker.on('completed', (job) => console.log(`[MathDocumentGrading] completed ${job.id}`));
  worker.on('failed', (job, error) => {
    console.error(`[MathDocumentGrading] failed ${job?.id ?? 'unknown'}: ${safeWorkerStartupError(error)}`);
    if (job) void settleMathDocumentGradingJobFailure({ db: input.db, job, error }).catch(() => console.error('[MathDocumentGrading] durable failure settlement failed'));
  });
  console.log(`[MathDocumentGrading] worker started with concurrency ${concurrency}`);
  return {
    worker,
    queue,
    async close() {
      clearInterval(heartbeatTimer);
      clearInterval(recoveryTimer);
      await input.redis.del(heartbeatKey, capabilityKey).catch(() => undefined);
      await worker.close();
      await queue.close();
    },
  };
}

async function start() {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const db = createPrismaClient();
  const controller = await createMathDocumentGradingWorker({ db, redis, concurrency: CONCURRENCY });
  const shutdown = async (code: number) => {
    await controller.close();
    await db.$disconnect();
    await redis.quit();
    process.exit(code);
  };
  process.on('SIGTERM', () => void shutdown(0));
  process.on('SIGINT', () => void shutdown(0));
  console.log(`[MathDocumentGrading] worker started with concurrency ${CONCURRENCY}`);
}

if (process.argv[1]?.endsWith('math-document-grading-worker.ts')) {
  start().catch((error) => {
    console.error('[MathDocumentGrading] worker failed to start', safeWorkerStartupError(error));
    process.exit(1);
  });
}

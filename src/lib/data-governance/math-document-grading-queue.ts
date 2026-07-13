import { Queue } from 'bullmq';

import { redisClient } from '@/lib/redis-client';

export const MATH_DOCUMENT_GRADING_QUEUE = 'math-document-grading';

export type MathDocumentGradingJobData =
  | { kind: 'conversion'; jobId: string; conversionId: string; workerClaimToken?: string }
  | { kind: 'grading'; jobId: string; gradingRunId: string; workerClaimToken?: string }
  | { kind: 'batch'; jobId: string; batchId: string; workerClaimToken?: string }
  | { kind: 'retry'; jobId: string; batchItemId: string; batchId: string; workerClaimToken?: string };

let queue: Queue<MathDocumentGradingJobData> | null = null;
type MathGradingDb = Record<string, any>;

export function getMathDocumentGradingQueue(): Queue<MathDocumentGradingJobData> | null {
  if (queue) return queue;
  const connection = redisClient.getClient();
  if (!connection) return null;
  queue = new Queue<MathDocumentGradingJobData>(MATH_DOCUMENT_GRADING_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
  return queue;
}

export async function enqueueMathDocumentGradingJob(input: MathDocumentGradingJobData, db?: MathGradingDb, queueOverride?: Queue<MathDocumentGradingJobData>): Promise<{ queued: boolean; queueJobId: string | null; state: 'QUEUED' | 'RETRYABLE'; retryable: boolean; errorCode?: string }> {
  if (db?.gradingJob?.findUnique) {
    const durable = await db.gradingJob.findUnique({ where: { id: input.jobId }, select: { state: true } });
    if (durable && ['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(durable.state)) {
      return { queued: true, queueJobId: null, state: 'QUEUED', retryable: false };
    }
  }
  let activeQueue: Queue<MathDocumentGradingJobData> | null = queueOverride ?? null;
  try {
    activeQueue ??= getMathDocumentGradingQueue();
  } catch {
    activeQueue = null;
  }
  if (!activeQueue) {
    await markQueueFailure(db, input);
    return { queued: false, queueJobId: null, state: 'RETRYABLE', retryable: true, errorCode: 'queue-unavailable' };
  }
  try {
    const job = await activeQueue.add(input.kind, input, { jobId: input.jobId });
    await markQueueQueued(db, input);
    return { queued: true, queueJobId: job.id ?? null, state: 'QUEUED', retryable: false };
  } catch {
    await markQueueFailure(db, input);
    return { queued: false, queueJobId: null, state: 'RETRYABLE', retryable: true, errorCode: 'queue-enqueue-failed' };
  }
}

export async function recoverMathDocumentGradingQueue(input: { db: MathGradingDb; limit?: number; now?: Date; queue?: Queue<MathDocumentGradingJobData> }): Promise<{ scanned: number; queued: number; failed: number }> {
  const now = input.now ?? new Date();
  const jobs = await input.db.gradingJob.findMany({
    where: {
      OR: [
        { state: { in: ['QUEUED', 'RETRYABLE'] }, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
        { state: 'RUNNING', workerLeaseExpiresAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: input.limit ?? 100,
  });
  let queued = 0;
  let failed = 0;
  for (const job of jobs) {
    if (job.state === 'RUNNING') {
      const recovered = await recoverExpiredJobOwnership(input.db, job, now);
      if (!recovered) {
        failed += 1;
        continue;
      }
    }
    const payload = durableJobPayload(job);
    if (!payload) {
      failed += 1;
      await input.db.gradingJob.update({ where: { id: job.id }, data: { state: 'BLOCKED', lastErrorCode: 'queue-recovery-relationship-missing', updatedAt: now } });
      continue;
    }
    const result = await enqueueMathDocumentGradingJob(payload, input.db, input.queue);
    if (result.queued) queued += 1;
    else failed += 1;
  }
  return { scanned: jobs.length, queued, failed };
}

async function recoverExpiredJobOwnership(db: MathGradingDb, job: any, now: Date): Promise<boolean> {
  const execute = async (tx: MathGradingDb) => {
    if (!tx.gradingJob?.updateMany) return false;
    const jobReset = await tx.gradingJob.updateMany({
      where: { id: job.id, state: 'RUNNING', workerClaimToken: job.workerClaimToken, workerLeaseExpiresAt: { lte: now } },
      data: { state: 'RETRYABLE', nextRunAt: now, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, lastErrorCode: 'worker-lease-expired', updatedAt: now },
    });
    if (jobReset?.count !== undefined && jobReset.count !== 1) return false;
    const conversionReset = { state: 'RETRYABLE', failureCode: 'worker-lease-expired', updatedAt: now };
    const runReset = { state: 'RETRYABLE', limitations: { push: 'worker-lease-expired' }, updatedAt: now };
    const batchReset = { state: 'RETRYABLE', lastErrorCode: 'worker-lease-expired', nextRunAt: now, updatedAt: now };
    const itemReset = { state: 'RETRYABLE', failureCode: 'worker-lease-expired', workerClaimToken: null, workerClaimedAt: null, updatedAt: now };
    if (job.kind === 'CONVERSION') await tx.documentConversion?.updateMany?.({ where: { id: job.conversionId, state: 'RUNNING' }, data: conversionReset });
    if (job.kind === 'GRADING' || job.kind === 'RERUN') await tx.gradingRun?.updateMany?.({ where: { id: job.gradingRunId, state: 'RUNNING' }, data: runReset });
    if (job.kind === 'BATCH') {
      await tx.gradingBatch?.updateMany?.({ where: { id: job.batchId, state: 'RUNNING' }, data: batchReset });
      await tx.gradingBatchItem?.updateMany?.({ where: { batchId: job.batchId, state: { in: ['CONVERTING', 'GRADING'] } }, data: itemReset });
    }
    if (job.kind === 'RETRY') await tx.gradingBatchItem?.updateMany?.({ where: { id: job.batchItemId, state: { in: ['CONVERTING', 'GRADING'] } }, data: itemReset });
    return true;
  };
  return db.$transaction ? db.$transaction(execute) : execute(db);
}

export async function closeMathDocumentGradingQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}

async function markQueueFailure(db: MathGradingDb | undefined, input: MathDocumentGradingJobData): Promise<void> {
  const now = new Date();
  const parentUpdated = await markQueueFailureRecord(db?.gradingJob, input.jobId, { state: 'RETRYABLE', nextRunAt: new Date(now.getTime() + 5_000), lastErrorCode: 'queue-enqueue-failed', updatedAt: now }, ['QUEUED', 'RETRYABLE']);
  if (!parentUpdated) return;
  if (input.kind === 'conversion') await markQueueFailureRecord(db?.documentConversion, input.conversionId, { state: 'RETRYABLE', retryCount: { increment: 1 }, failureCode: 'queue-enqueue-failed', updatedAt: now }, ['QUEUED', 'RETRYABLE']);
  if (input.kind === 'grading') await markQueueFailureRecord(db?.gradingRun, input.gradingRunId, { state: 'RETRYABLE', updatedAt: now }, ['QUEUED', 'RETRYABLE']);
  if (input.kind === 'batch') await markQueueFailureRecord(db?.gradingBatch, input.batchId, { state: 'RETRYABLE', retryCount: { increment: 1 }, lastErrorCode: 'queue-enqueue-failed', nextRunAt: new Date(now.getTime() + 5_000), updatedAt: now }, ['QUEUED', 'RETRYABLE']);
  if (input.kind === 'retry') await markQueueFailureRecord(db?.gradingBatchItem, input.batchItemId, { state: 'RETRYABLE', failureCode: 'queue-enqueue-failed', retryCount: { increment: 1 }, updatedAt: now }, ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE']);
}

async function markQueueQueued(db: MathGradingDb | undefined, input: MathDocumentGradingJobData): Promise<void> {
  if (!db?.gradingJob?.updateMany) return;
  const now = new Date();
  await markQueueRecordQueued(db.gradingJob, input.jobId, { state: 'QUEUED', nextRunAt: null, lastErrorCode: null, updatedAt: now });
  if (input.kind === 'conversion') await markQueueRecordQueued(db.documentConversion, input.conversionId, { state: 'QUEUED', failureCode: null, updatedAt: now });
  if (input.kind === 'grading') await markQueueRecordQueued(db.gradingRun, input.gradingRunId, { state: 'QUEUED', updatedAt: now });
  if (input.kind === 'batch') await markQueueRecordQueued(db.gradingBatch, input.batchId, { state: 'QUEUED', lastErrorCode: null, nextRunAt: null, updatedAt: now });
  if (input.kind === 'retry') await markQueueRecordQueued(db.gradingBatchItem, input.batchItemId, { state: 'QUEUED', failureCode: null, updatedAt: now });
}

async function markQueueRecordQueued(model: any, id: string | undefined, data: Record<string, unknown>): Promise<void> {
  if (!model?.updateMany || !id) return;
  await model.updateMany({ where: { id, state: { in: ['QUEUED', 'RETRYABLE'] } }, data }).catch(() => undefined);
}

async function markQueueFailureRecord(model: any, id: string | undefined, data: Record<string, unknown>, activeStates: string[]): Promise<boolean> {
  if (!model || !id) return false;
  if (model.updateMany) {
    try {
      const result = await model.updateMany({ where: { id, state: { in: activeStates } }, data });
      return result?.count === undefined ? true : result.count > 0;
    } catch {
      return false;
    }
  }
  try {
    await model.update?.({ where: { id }, data });
    return Boolean(model.update);
  } catch {
    return false;
  }
}

function durableJobPayload(job: any): MathDocumentGradingJobData | null {
  if (job.kind === 'CONVERSION' && job.conversionId) return { kind: 'conversion', jobId: job.id, conversionId: job.conversionId };
  if ((job.kind === 'GRADING' || job.kind === 'RERUN') && job.gradingRunId) return { kind: 'grading', jobId: job.id, gradingRunId: job.gradingRunId };
  if (job.kind === 'BATCH' && job.batchId) return { kind: 'batch', jobId: job.id, batchId: job.batchId };
  if ((job.kind === 'RETRY' || job.kind === 'RERUN') && job.batchId && job.batchItemId) return { kind: 'retry', jobId: job.id, batchId: job.batchId, batchItemId: job.batchItemId };
  return null;
}

import type { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

import { redisClient } from '../redis-client';

import { SMART_LESSON_GENERATION_QUEUE, ensureSmartLessonGenerationWorker } from './worker';

type QueueDb = PrismaClient;
type QueueLike = Pick<Queue<{ jobId: string }>, 'add' | 'close'>;
let queue: Queue<{ jobId: string }> | null = null;

export async function enqueueSmartLessonGenerationJob(
  db: QueueDb,
  jobId: string,
  queueOverride?: QueueLike,
) {
  const durable = await db.smartLessonGenerationJob.findUnique({
    where: { id: jobId },
    select: { id: true, state: true, firstIncompleteStage: true, draftId: true, deliveryGeneration: true },
  });
  if (!durable) return { queued: false, job: null, errorCode: 'generation-job-not-found' as const };
  if (durable.state !== 'QUEUED') return { queued: false, job: durable, errorCode: null };
  const stage = await db.smartLessonGenerationStage.findUnique({
    where: { jobId_kind: { jobId: durable.id, kind: durable.firstIncompleteStage } },
    select: { id: true },
  });
  if (!stage) {
    const failed = await markDeliveryRetryable(db, durable.id, durable.draftId, 'generation-stage-not-found');
    return { queued: false, job: failed, errorCode: 'generation-stage-not-found' as const };
  }

  try {
    let activeQueue = queueOverride;
    if (!activeQueue) {
      const connection = redisClient.getClient();
      if (!connection) throw new Error('redis-unavailable');
      await connection.ping();
      await ensureSmartLessonGenerationWorker(connection);
      queue ??= new Queue<{ jobId: string }>(SMART_LESSON_GENERATION_QUEUE, {
        connection,
        ...(smartLessonQueuePrefix() ? { prefix: smartLessonQueuePrefix() } : {}),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      });
      activeQueue = queue;
    }
    await activeQueue.add('generate', { jobId: durable.id }, {
      jobId: `smart-lesson-${durable.id}-${durable.firstIncompleteStage}-${durable.deliveryGeneration}`,
    });
    return { queued: true, job: durable, errorCode: null };
  } catch {
    const failed = await markDeliveryRetryable(db, durable.id, durable.draftId, 'queue-unavailable');
    return { queued: false, job: failed, errorCode: 'queue-unavailable' as const };
  }
}

function smartLessonQueuePrefix() {
  return process.env.SMART_LESSON_REDIS_PREFIX?.trim() || undefined;
}

export async function closeSmartLessonGenerationQueue() {
  await queue?.close();
  queue = null;
}

async function markDeliveryRetryable(db: QueueDb, jobId: string, draftId: string, failureCode: string) {
  return db.$transaction(async (tx) => {
    await tx.smartLessonDraft.updateMany({
      where: { id: draftId, state: 'GENERATING' },
      data: { state: 'EDITABLE' },
    });
    await tx.smartLessonGenerationJob.updateMany({
      where: { id: jobId, state: 'QUEUED' },
      data: { state: 'RETRYABLE', failureCode },
    });
    return tx.smartLessonGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
  });
}

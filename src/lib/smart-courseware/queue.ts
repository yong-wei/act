import type { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

import { redisClient } from '@/lib/redis-client';

import { SmartCoursewareError } from './domain';
import { COURSEWARE_GENERATION_QUEUE, ensureCoursewareGenerationWorker } from './worker';

type QueueLike = Pick<Queue<{ jobId: string }>, 'add' | 'close'>;
let queue: Queue<{ jobId: string }> | null = null;

export async function enqueueCoursewareGenerationJob(db: PrismaClient, jobId: string, override?: QueueLike) {
  const durable = await db.smartCoursewareGenerationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true, draftId: true, mode: true, targetModuleId: true, state: true,
      firstIncompleteUnitKey: true, deliveryGeneration: true,
      draft: { select: { state: true } },
    },
  });
  if (!durable) return { queued: false, job: null, errorCode: 'courseware-job-not-found' as const };
  if (durable.draft?.state === 'ACCEPTED') throw new SmartCoursewareError('accepted-courseware-immutable', 409);
  if (durable.state !== 'QUEUED') return { queued: false, job: durable, errorCode: null };
  if (durable.mode === 'INITIAL') {
    if (!durable.firstIncompleteUnitKey) return deliveryFailure(db, durable.id, durable.draftId, durable.mode, 'courseware-unit-not-found');
    const unit = await db.smartCoursewareGenerationUnit.findUnique({
      where: { jobId_unitKey: { jobId: durable.id, unitKey: durable.firstIncompleteUnitKey } }, select: { id: true },
    });
    if (!unit) return deliveryFailure(db, durable.id, durable.draftId, durable.mode, 'courseware-unit-not-found');
  } else if (!durable.targetModuleId) {
    return deliveryFailure(db, durable.id, durable.draftId, durable.mode, 'courseware-module-target-not-found');
  }
  try {
    let active = override;
    if (!active) {
      const connection = redisClient.getClient();
      if (!connection) throw new Error('redis-unavailable');
      await connection.ping();
      await ensureCoursewareGenerationWorker(connection);
      queue ??= new Queue(COURSEWARE_GENERATION_QUEUE, {
        connection,
        ...(queuePrefix() ? { prefix: queuePrefix() } : {}),
        defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 200 } },
      });
      active = queue;
    }
    await active.add('generate', { jobId: durable.id }, {
      jobId: durable.mode === 'MODULE'
        ? `smart-courseware-${durable.id}-module-${durable.targetModuleId}-${durable.deliveryGeneration}`
        : `smart-courseware-${durable.id}-${durable.firstIncompleteUnitKey}-${durable.deliveryGeneration}`,
    });
    return { queued: true, job: durable, errorCode: null };
  } catch {
    return deliveryFailure(db, durable.id, durable.draftId, durable.mode, 'courseware-queue-unavailable');
  }
}

export async function closeCoursewareGenerationQueue() {
  await queue?.close();
  queue = null;
}

async function deliveryFailure(db: PrismaClient, jobId: string, draftId: string, mode: 'INITIAL' | 'MODULE', failureCode: string) {
  const result = await db.$transaction(async (tx) => {
    const transitioned = await tx.smartCoursewareGenerationJob.updateMany({
      where: { id: jobId, state: 'QUEUED' },
      data: { state: 'RETRYABLE', activeIdentity: null, failureCode },
    });
    if (transitioned.count !== 1) {
      return { transitioned: false as const, job: await tx.smartCoursewareGenerationJob.findUniqueOrThrow({ where: { id: jobId } }) };
    }
    if (mode === 'INITIAL') {
      await tx.smartCoursewareDraft.updateMany({ where: { id: draftId, state: 'GENERATING' }, data: { state: 'EDITABLE' } });
    }
    return { transitioned: true as const, job: await tx.smartCoursewareGenerationJob.findUniqueOrThrow({ where: { id: jobId } }) };
  });
  if (!result.transitioned) {
    const acceptedElsewhere = result.job.state === 'RUNNING' || result.job.state === 'COMPLETED';
    return { queued: acceptedElsewhere, job: result.job, errorCode: null };
  }
  return { queued: false, job: result.job, errorCode: failureCode };
}

function queuePrefix() {
  return process.env.SMART_COURSEWARE_REDIS_PREFIX?.trim() || undefined;
}

import type { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

import { markDiagnosisDeliveryFailure } from '@/lib/diagnosis-generation';
import {
  DIAGNOSIS_GENERATION_QUEUE,
  ensureDiagnosisGenerationWorker,
} from '@/lib/diagnosis-generation-worker';
import { redisClient } from '@/lib/redis-client';

type QueueLike = Pick<Queue<{ jobId: string }>, 'add' | 'close'>;
let queue: Queue<{ jobId: string }> | null = null;

export async function enqueueDiagnosisGenerationJob(
  db: PrismaClient,
  jobId: string,
  queueOverride?: QueueLike,
) {
  const durable = await db.diagnosisGenerationJob.findUnique({ where: { id: jobId } });
  if (!durable) return { queued: false, job: null, errorCode: 'diagnosis-generation-job-not-found' as const };
  if (durable.state !== 'QUEUED') return { queued: false, job: durable, errorCode: null };
  try {
    let activeQueue = queueOverride;
    if (!activeQueue) {
      const connection = redisClient.getClient();
      if (!connection) throw new Error('redis-unavailable');
      await connection.ping();
      await ensureDiagnosisGenerationWorker(connection);
      queue ??= new Queue<{ jobId: string }>(DIAGNOSIS_GENERATION_QUEUE, {
        connection,
        ...(queuePrefix() ? { prefix: queuePrefix() } : {}),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 },
        },
      });
      activeQueue = queue;
    }
    await activeQueue.add('generate', { jobId }, {
      jobId: `teacher-diagnosis-${jobId}-${durable.deliveryGeneration}`,
    });
    return { queued: true, job: durable, errorCode: null };
  } catch {
    const failed = await markDiagnosisDeliveryFailure(db, jobId);
    return { queued: false, job: failed, errorCode: 'queue-unavailable' as const };
  }
}

function queuePrefix() {
  return process.env.DIAGNOSIS_GENERATION_REDIS_PREFIX?.trim() || undefined;
}

export async function closeDiagnosisGenerationQueue() {
  await queue?.close();
  queue = null;
}

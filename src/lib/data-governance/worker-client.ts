/**
 * Worker Client
 *
 * BullMQ queue clients for job scheduling.
 */

import { Queue } from 'bullmq';
import { redisClient } from '@/lib/redis-client';

// Queue names
export const QUEUE_NAMES = {
  EVENT_INGESTION: 'event-ingestion',
} as const;

// Queue instances
let eventIngestionQueue: Queue | null = null;

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
} as const;

/**
 * Initialize queues
 */
export function initializeQueues(): void {
  const connection = redisClient.getClient();
  if (!connection) {
    console.warn('[WorkerClient] Redis not available, queues not initialized');
    return;
  }

  eventIngestionQueue = new Queue(QUEUE_NAMES.EVENT_INGESTION, { connection });

  console.log('[WorkerClient] Queues initialized');
}

/**
 * Get event ingestion queue
 */
export function getEventIngestionQueue(): Queue | null {
  return eventIngestionQueue;
}

/**
 * Schedule event ingestion job
 */
export async function scheduleEventIngestion(batchDate: string): Promise<void> {
  if (!eventIngestionQueue) return;

  await eventIngestionQueue.add(
    'ingest-batch',
    { batchDate },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...JOB_HISTORY_OPTIONS,
    }
  );
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  eventIngestion: { waiting: number; active: number; completed: number; failed: number };
}> {
  const defaultStats = { waiting: 0, active: 0, completed: 0, failed: 0 };

  return {
    eventIngestion: eventIngestionQueue
      ? await getSingleQueueStats(eventIngestionQueue)
      : defaultStats,
  };
}

async function getSingleQueueStats(queue: Queue) {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  await eventIngestionQueue?.close();
}

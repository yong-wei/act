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
  STUDENT_SNAPSHOT: 'snapshot-student',
  CLASS_SNAPSHOT: 'snapshot-class',
} as const;

// Queue instances
let eventIngestionQueue: Queue | null = null;
let studentSnapshotQueue: Queue | null = null;
let classSnapshotQueue: Queue | null = null;

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
  studentSnapshotQueue = new Queue(QUEUE_NAMES.STUDENT_SNAPSHOT, { connection });
  classSnapshotQueue = new Queue(QUEUE_NAMES.CLASS_SNAPSHOT, { connection });

  console.log('[WorkerClient] Queues initialized');
}

/**
 * Get event ingestion queue
 */
export function getEventIngestionQueue(): Queue | null {
  return eventIngestionQueue;
}

/**
 * Get student snapshot queue
 */
export function getStudentSnapshotQueue(): Queue | null {
  return studentSnapshotQueue;
}

/**
 * Get class snapshot queue
 */
export function getClassSnapshotQueue(): Queue | null {
  return classSnapshotQueue;
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
    }
  );
}

/**
 * Schedule student snapshot job
 */
export async function scheduleStudentSnapshot(userId: string): Promise<void> {
  if (!studentSnapshotQueue) return;

  await studentSnapshotQueue.add(
    `snapshot-${userId}`,
    { userId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
      jobId: `student-${userId}`, // Deduplication
    }
  );
}

/**
 * Schedule class snapshot job
 */
export async function scheduleClassSnapshot(classId: string): Promise<void> {
  if (!classSnapshotQueue) return;

  await classSnapshotQueue.add(
    `snapshot-class-${classId}`,
    { classId },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15000 },
      jobId: `class-${classId}`, // Deduplication
    }
  );
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  eventIngestion: { waiting: number; active: number; completed: number; failed: number };
  studentSnapshot: { waiting: number; active: number; completed: number; failed: number };
  classSnapshot: { waiting: number; active: number; completed: number; failed: number };
}> {
  const defaultStats = { waiting: 0, active: 0, completed: 0, failed: 0 };

  return {
    eventIngestion: eventIngestionQueue
      ? await getSingleQueueStats(eventIngestionQueue)
      : defaultStats,
    studentSnapshot: studentSnapshotQueue
      ? await getSingleQueueStats(studentSnapshotQueue)
      : defaultStats,
    classSnapshot: classSnapshotQueue
      ? await getSingleQueueStats(classSnapshotQueue)
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
  await Promise.all([
    eventIngestionQueue?.close(),
    studentSnapshotQueue?.close(),
    classSnapshotQueue?.close(),
  ]);
}

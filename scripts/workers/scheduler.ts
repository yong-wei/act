/**
 * Worker Scheduler
 *
 * Registers low-pressure recurring coordinator jobs for the data governance workers.
 * Run once to refresh the repeatable schedule set.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type {
  ClassSnapshotJob,
  EventIngestionJob,
  EvidenceFeatureCacheJob,
  StudentSnapshotJob,
} from './types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const SCHEDULES = {
  EVENT_INGESTION_NIGHTLY: '10 2 * * *',
  ACTIVE_STUDENT_SNAPSHOT: '15 * * * *',
  CLASS_SNAPSHOT: '30 3 * * *',
  EVIDENCE_FEATURE_CACHE_REBUILD: '45 4 * * *',
} as const;

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 20 },
  removeOnFail: { count: 50 },
} as const;

async function clearRepeatableJobs(queue: Queue) {
  const existingJobs = await queue.getRepeatableJobs();
  for (const job of existingJobs) {
    await queue.removeRepeatableByKey(job.key);
  }
}

async function scheduleJobs() {
  console.log('[Scheduler] Setting up recurring coordinator jobs...');

  const eventQueue = new Queue<EventIngestionJob>('event-ingestion', { connection: redis });
  const studentQueue = new Queue<StudentSnapshotJob>('snapshot-student', { connection: redis });
  const classQueue = new Queue<ClassSnapshotJob>('snapshot-class', { connection: redis });
  const evidenceFeatureCacheQueue = new Queue<EvidenceFeatureCacheJob>('evidence-feature-cache', { connection: redis });

  await clearRepeatableJobs(eventQueue);
  await clearRepeatableJobs(studentQueue);
  await clearRepeatableJobs(classQueue);
  await clearRepeatableJobs(evidenceFeatureCacheQueue);

  await eventQueue.add(
    'event-ingestion-coordinator',
    { coordinator: true },
    {
      repeat: { cron: SCHEDULES.EVENT_INGESTION_NIGHTLY },
      jobId: 'coordinator-event-ingestion',
      ...JOB_HISTORY_OPTIONS,
    },
  );

  await studentQueue.add(
    'active-student-snapshot-coordinator',
    { coordinator: true, simulationTaskCatalogRefresh: true },
    {
      repeat: { cron: SCHEDULES.ACTIVE_STUDENT_SNAPSHOT },
      jobId: 'coordinator-active-student-snapshot',
      ...JOB_HISTORY_OPTIONS,
    },
  );

  await classQueue.add(
    'class-snapshot-coordinator',
    { coordinator: true },
    {
      repeat: { cron: SCHEDULES.CLASS_SNAPSHOT },
      jobId: 'coordinator-class-snapshot',
      ...JOB_HISTORY_OPTIONS,
    },
  );

  await evidenceFeatureCacheQueue.add(
    'evidence-feature-cache-rebuild',
    { coordinator: true, rebuildAll: true },
    {
      repeat: { cron: SCHEDULES.EVIDENCE_FEATURE_CACHE_REBUILD },
      jobId: 'coordinator-evidence-feature-cache-rebuild',
      ...JOB_HISTORY_OPTIONS,
    },
  );

  console.log(`[Scheduler] Event ingestion scheduled: ${SCHEDULES.EVENT_INGESTION_NIGHTLY}`);
  console.log(`[Scheduler] Active student snapshots scheduled: ${SCHEDULES.ACTIVE_STUDENT_SNAPSHOT}`);
  console.log(`[Scheduler] Class snapshots scheduled: ${SCHEDULES.CLASS_SNAPSHOT}`);
  console.log(`[Scheduler] Evidence feature cache rebuild scheduled: ${SCHEDULES.EVIDENCE_FEATURE_CACHE_REBUILD}`);

  await eventQueue.close();
  await studentQueue.close();
  await classQueue.close();
  await evidenceFeatureCacheQueue.close();
  await redis.quit();

  console.log('[Scheduler] Recurring coordinator jobs refreshed successfully');
}

scheduleJobs().catch(async (err) => {
  console.error('[Scheduler] Failed to schedule jobs:', err);
  await redis.quit().catch(() => undefined);
  process.exit(1);
});

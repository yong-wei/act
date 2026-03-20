/**
 * Worker Scheduler
 *
 * Sets up recurring jobs for the data governance workers.
 * Run once to schedule all recurring jobs.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

const SCHEDULES = {
  EVENT_INGESTION: '*/5 * * * *',    // Every 5 minutes
  STUDENT_SNAPSHOT: '*/10 * * * *',  // Every 10 minutes
  CLASS_SNAPSHOT: '*/15 * * * *',    // Every 15 minutes
};

async function scheduleJobs() {
  console.log('[Scheduler] Setting up recurring jobs...');

  // Event ingestion queue
  const eventQueue = new Queue('event-ingestion', { connection: redis });

  // Clean existing repeatables
  const existingEventJobs = await eventQueue.getRepeatableJobs();
  for (const job of existingEventJobs) {
    await eventQueue.removeRepeatableByKey(job.key);
  }

  // Schedule event ingestion
  await eventQueue.add(
    'scheduled-ingestion',
    {},
    {
      repeat: { cron: SCHEDULES.EVENT_INGESTION },
      jobId: 'scheduled-event-ingestion',
    }
  );

  console.log(`[Scheduler] Event ingestion scheduled: ${SCHEDULES.EVENT_INGESTION}`);

  // Student snapshot queue
  const studentQueue = new Queue('snapshot-student', { connection: redis });

  const existingStudentJobs = await studentQueue.getRepeatableJobs();
  for (const job of existingStudentJobs) {
    await studentQueue.removeRepeatableByKey(job.key);
  }

  // Schedule student snapshots for active users
  // In production, this would be dynamically scheduled based on activity
  const activeUsers = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true },
    take: 100, // Limit for initial rollout
  });

  for (const user of activeUsers) {
    await studentQueue.add(
      `scheduled-student-${user.id}`,
      { userId: user.id },
      {
        repeat: { cron: SCHEDULES.STUDENT_SNAPSHOT },
        jobId: `scheduled-student-${user.id}`,
      }
    );
  }

  console.log(`[Scheduler] Student snapshots scheduled for ${activeUsers.length} users: ${SCHEDULES.STUDENT_SNAPSHOT}`);

  // Class snapshot queue
  const classQueue = new Queue('snapshot-class', { connection: redis });

  const existingClassJobs = await classQueue.getRepeatableJobs();
  for (const job of existingClassJobs) {
    await classQueue.removeRepeatableByKey(job.key);
  }

  // Schedule class snapshots
  const classes = await prisma.class.findMany({ select: { id: true } });

  for (const cls of classes) {
    await classQueue.add(
      `scheduled-class-${cls.id}`,
      { classId: cls.id },
      {
        repeat: { cron: SCHEDULES.CLASS_SNAPSHOT },
        jobId: `scheduled-class-${cls.id}`,
      }
    );
  }

  console.log(`[Scheduler] Class snapshots scheduled for ${classes.length} classes: ${SCHEDULES.CLASS_SNAPSHOT}`);

  // Cleanup
  await eventQueue.close();
  await studentQueue.close();
  await classQueue.close();
  await prisma.$disconnect();
  await redis.quit();

  console.log('[Scheduler] All jobs scheduled successfully');
}

scheduleJobs().catch((err) => {
  console.error('[Scheduler] Failed to schedule jobs:', err);
  process.exit(1);
});

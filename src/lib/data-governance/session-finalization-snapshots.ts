import { Queue } from 'bullmq';

import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';

interface StudentSnapshotJob {
  userId?: string;
  coordinator?: boolean;
}

interface ClassSnapshotJob {
  classId?: string;
  coordinator?: boolean;
}

export interface SessionFinalizationSnapshotResult {
  studentSnapshotJobs: number;
  classSnapshotJobs: number;
  skipped: boolean;
}

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
} as const;

const CLASS_SNAPSHOT_DELAY_MS = 60_000;

export async function enqueueSessionFinalizationSnapshots(
  sessionId: string,
  classId: string | null | undefined,
): Promise<SessionFinalizationSnapshotResult> {
  const emptyResult = {
    studentSnapshotJobs: 0,
    classSnapshotJobs: 0,
    skipped: true,
  };

  try {
    if (!redisClient.isReady()) {
      return emptyResult;
    }

    const connection = redisClient.getClient();
    if (!connection) {
      return emptyResult;
    }

    const studentStates = await prisma.studentState.findMany({
      where: {
        sessionId,
        stateKey: 'course',
      },
      distinct: ['userId'],
      select: {
        userId: true,
      },
    });
    const userIds = studentStates.map((state) => state.userId);
    const triggerId = `session-finalize-${sessionId}`;
    const studentQueue = new Queue<StudentSnapshotJob>('snapshot-student', { connection });
    const classQueue = new Queue<ClassSnapshotJob>('snapshot-class', { connection });

    try {
      for (const userId of userIds) {
        await studentQueue.add(
          `student-snapshot-${userId}`,
          { userId },
          {
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
            jobId: `student-snapshot-${userId}-${triggerId}`,
            ...JOB_HISTORY_OPTIONS,
          },
        );
      }

      if (classId) {
        await classQueue.add(
          `class-snapshot-${classId}`,
          { classId },
          {
            attempts: 2,
            backoff: { type: 'exponential', delay: 15000 },
            delay: CLASS_SNAPSHOT_DELAY_MS,
            jobId: `class-snapshot-${classId}-${triggerId}`,
            ...JOB_HISTORY_OPTIONS,
          },
        );
      }
    } finally {
      await Promise.all([studentQueue.close(), classQueue.close()]);
    }

    return {
      studentSnapshotJobs: userIds.length,
      classSnapshotJobs: classId ? 1 : 0,
      skipped: false,
    };
  } catch (error) {
    console.error('[SessionFinalizationSnapshots] Failed to enqueue snapshots:', error);
    return emptyResult;
  }
}

import { Queue } from 'bullmq';

import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';

interface EventIngestionJob {
  coordinator?: boolean;
}

interface SessionReportJob {
  sessionId?: string;
}

interface EvidenceFeatureCacheJob {
  userId?: string;
  sessionId?: string;
  coordinator?: boolean;
}

const JOB_HISTORY_OPTIONS = {
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 200 },
} as const;

const EVENT_INGESTION_DELAY_MS = 5_000;
const SESSION_REPORT_REFRESH_DELAY_MS = 90_000;
const EVIDENCE_FEATURE_CACHE_DELAY_MS = 120_000;

export async function enqueueSessionFinalizationEventIngestion(
  sessionId: string,
): Promise<{ eventIngestionJobs: number; skipped: boolean }> {
  const emptyResult = {
    eventIngestionJobs: 0,
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

    const eventQueue = new Queue<EventIngestionJob>('event-ingestion', { connection });
    try {
      await eventQueue.add(
        'event-ingestion-coordinator',
        { coordinator: true },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          delay: EVENT_INGESTION_DELAY_MS,
          jobId: `event-ingestion-session-finalize-${sessionId}`,
          ...JOB_HISTORY_OPTIONS,
        },
      );
    } finally {
      await eventQueue.close();
    }

    return {
      eventIngestionJobs: 1,
      skipped: false,
    };
  } catch (error) {
    console.error('[SessionFinalizationEventIngestion] Failed to enqueue event ingestion:', error);
    return emptyResult;
  }
}

export async function enqueueSessionSummaryReportRefresh(
  sessionId: string,
): Promise<{ reportRefreshJobs: number; skipped: boolean }> {
  const emptyResult = {
    reportRefreshJobs: 0,
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

    const reportQueue = new Queue<SessionReportJob>('session-report', { connection });
    try {
      await reportQueue.add(
        'session-report-refresh',
        { sessionId },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          delay: SESSION_REPORT_REFRESH_DELAY_MS,
          jobId: `session-report-refresh-${sessionId}`,
          ...JOB_HISTORY_OPTIONS,
        },
      );
    } finally {
      await reportQueue.close();
    }

    return {
      reportRefreshJobs: 1,
      skipped: false,
    };
  } catch (error) {
    console.error('[SessionSummaryReportRefresh] Failed to enqueue report refresh:', error);
    return emptyResult;
  }
}

export async function enqueueSessionFinalizationEvidenceFeatureCacheRefresh(
  sessionId: string,
): Promise<{ evidenceFeatureCacheJobs: number; skipped: boolean }> {
  const emptyResult = {
    evidenceFeatureCacheJobs: 0,
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
    const cacheQueue = new Queue<EvidenceFeatureCacheJob>('evidence-feature-cache', { connection });

    try {
      for (const userId of userIds) {
        await cacheQueue.add(
          `evidence-feature-cache-refresh-${userId}`,
          { userId, sessionId },
          {
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
            delay: EVIDENCE_FEATURE_CACHE_DELAY_MS,
            jobId: `evidence-feature-cache-${userId}-session-finalize-${sessionId}`,
            ...JOB_HISTORY_OPTIONS,
          },
        );
      }
    } finally {
      await cacheQueue.close();
    }

    return {
      evidenceFeatureCacheJobs: userIds.length,
      skipped: false,
    };
  } catch (error) {
    console.error('[SessionFinalizationEvidenceFeatureCache] Failed to enqueue feature cache refresh:', error);
    return emptyResult;
  }
}

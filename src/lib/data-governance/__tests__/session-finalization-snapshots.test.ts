import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
  Queue: vi.fn(),
  redisClient: {
    isReady: vi.fn(),
    getClient: vi.fn(),
  },
  prisma: {
    studentState: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('bullmq', () => ({
  Queue: mocks.Queue,
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import {
  enqueueSessionFinalizationEvidenceFeatureCacheRefresh,
  enqueueSessionSummaryReportRefresh,
} from '../session-finalization-snapshots';

describe('session finalization queues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redisClient.isReady.mockReturnValue(true);
    mocks.redisClient.getClient.mockReturnValue({ status: 'ready' });
    mocks.Queue.mockImplementation(function Queue() {
      return {
        add: mocks.queueAdd,
        close: mocks.queueClose,
      };
    });
  });

  it('enqueues a delayed session report refresh after classroom finalization', async () => {
    const result = await enqueueSessionSummaryReportRefresh('session-4-5');

    expect(result).toEqual({
      reportRefreshJobs: 1,
      skipped: false,
    });
    expect(mocks.Queue).toHaveBeenCalledWith('session-report', { connection: { status: 'ready' } });
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      'session-report-refresh',
      { sessionId: 'session-4-5' },
      expect.objectContaining({
        delay: 90_000,
        jobId: 'session-report-refresh-session-4-5',
      }),
    );
    expect(mocks.queueClose).toHaveBeenCalled();
  });

  it('enqueues evidence feature cache refreshes for finalized session participants', async () => {
    mocks.prisma.studentState.findMany.mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' },
    ]);

    const result = await enqueueSessionFinalizationEvidenceFeatureCacheRefresh('session-5-3');

    expect(result).toEqual({
      evidenceFeatureCacheJobs: 2,
      skipped: false,
    });
    expect(mocks.Queue).toHaveBeenCalledWith('evidence-feature-cache', { connection: { status: 'ready' } });
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      'evidence-feature-cache-refresh-student-1',
      { userId: 'student-1' },
      expect.objectContaining({
        jobId: 'evidence-feature-cache-student-1-session-finalize-session-5-3',
      }),
    );
    expect(mocks.queueAdd).toHaveBeenCalledWith(
      'evidence-feature-cache-refresh-student-2',
      { userId: 'student-2' },
      expect.objectContaining({
        jobId: 'evidence-feature-cache-student-2-session-finalize-session-5-3',
      }),
    );
  });
});

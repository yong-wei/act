import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
  redisClient: {
    getClient: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

import { GET, dynamic, revalidate } from '@/app/api/readyz/route';
import { MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY } from '@/lib/data-governance/math-document-grading-worker-readiness';

describe('readyz route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    mocks.redisClient.getClient.mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forces dynamic evaluation without route cache', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(revalidate).toBe(0);
  });

  it('returns a no-store response when all dependencies are healthy', async () => {
    vi.stubEnv('MATH_DOCUMENT_GRADING_WORKER_REQUIRED', 'false');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({
      app: true,
      db: true,
      redis: true,
    });
  });

  it('requires the math document grading worker by default when the setting is absent', async () => {
    const previousValue = process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED;
    delete process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED;

    try {
      const response = await GET();

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        mathDocumentGradingWorker: {
          required: true,
          ready: false,
          configReady: false,
          missing: ['worker-heartbeat-or-capability'],
        },
      });
    } finally {
      if (previousValue === undefined) {
        delete process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED;
      } else {
        process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED = previousValue;
      }
    }
  });

  it('does not report a required worker ready from the heartbeat alone', async () => {
    vi.stubEnv('MATH_DOCUMENT_GRADING_WORKER_REQUIRED', 'true');
    mocks.redisClient.getClient.mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
      get: vi.fn().mockImplementation((key: string) => key === 'math-document-grading:worker:heartbeat' ? 'ready' : null),
    });

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      mathDocumentGradingWorker: { required: true, ready: false, configReady: false },
    });
  });

  it('requires a valid worker capability record alongside the heartbeat', async () => {
    vi.stubEnv('MATH_DOCUMENT_GRADING_WORKER_REQUIRED', 'true');
    const capability = JSON.stringify({
      version: 'math-document-grading-worker.v1',
      ready: true,
      configReady: true,
      capabilities: {
        database: true,
        redis: true,
        objectStore: true,
        scanner: true,
        aiProvider: true,
        mathpix: true,
        auditSecret: true,
      },
      missing: [],
    });
    mocks.redisClient.getClient.mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
      get: vi.fn().mockImplementation((key: string) => key === MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY ? capability : 'ready'),
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mathDocumentGradingWorker: { required: true, ready: true, configReady: true },
    });
  });
});

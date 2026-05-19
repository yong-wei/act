import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redis: {
    keys: vi.fn(),
    llen: vi.fn(),
  },
  redisClient: {
    getClient: vi.fn(),
  },
  prisma: {
    studentCompetencySnapshot: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    classCompetencySnapshot: {
      count: vi.fn(),
    },
    learningFact: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    studentEvidenceFeatureCache: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    studentRiskFlag: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
  rethrowIfNextDynamicError: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { GET } from '../route';

function createRequest() {
  return new NextRequest('http://localhost/api/admin/data-governance/status');
}

describe('GET /api/admin/data-governance/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    mocks.redisClient.getClient.mockReturnValue(mocks.redis);
    mocks.redis.keys.mockResolvedValue([]);
    mocks.redis.llen.mockResolvedValue(3);
    mocks.prisma.studentCompetencySnapshot.count.mockResolvedValue(2);
    mocks.prisma.classCompetencySnapshot.count.mockResolvedValue(1);
    mocks.prisma.learningFact.count.mockResolvedValue(4);
    mocks.prisma.studentRiskFlag.count.mockResolvedValue(0);
    mocks.prisma.studentCompetencySnapshot.findMany
      .mockResolvedValueOnce([
        {
          userId: 'student-1',
          snapshotAt: new Date('2026-05-19T08:00:00.000Z'),
          factCount: 12,
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'student-1',
          snapshotAt: new Date('2026-05-19T08:00:00.000Z'),
          factCount: 12,
        },
      ]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([
      { factType: 'question' },
      { factType: 'simulation' },
    ]);
    mocks.prisma.studentEvidenceFeatureCache.count.mockResolvedValue(2);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      {
        refreshedAt: new Date('2026-05-19T08:10:00.000Z'),
        statusMarkers: [],
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'missing',
          StudentProfileSummary: 'missing',
        },
        sourceFactCount: 4,
        rebuildCount: 1,
      },
    ]);
    mocks.prisma.user.findMany.mockResolvedValue([
      { id: 'student-1', name: '张三', email: 'student@example.test' },
    ]);
  });

  it('returns the evidence source catalog for admins', async () => {
    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.sourceCatalog).toMatchObject({
      totalSources: 10,
      coverageCommand: 'npm run db:evidence-source-coverage -- --text',
    });
    expect(payload.sourceCatalog.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'InteractionLog',
          learningScope: 'mixed',
          eligibility: 'eligible',
          materializationReadiness: 'partial',
        }),
        expect.objectContaining({
          id: 'ArenaEvaluationRun',
          eligibility: 'unsupported',
        }),
      ])
    );
    expect(payload.recentSnapshots[0]).toMatchObject({
      userId: 'student-1',
      userName: '张三',
      factCount: 12,
    });
    expect(payload.featureCache).toMatchObject({
      totalEntries: 2,
      staleEntries: 0,
      latestRefreshAt: '2026-05-19T08:10:00.000Z',
      totalSourceFacts: 4,
      payloadVersion: 'student-evidence-features.v1',
    });
  });

  it('rejects non-admin users before reading governance data', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await GET(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(mocks.prisma.studentCompetencySnapshot.count).not.toHaveBeenCalled();
    expect(mocks.redisClient.getClient).not.toHaveBeenCalled();
  });
});

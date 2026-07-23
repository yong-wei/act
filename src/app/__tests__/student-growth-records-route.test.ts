import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    growthRecord: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));
vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { GET } from '@/app/api/student/growth-records/route';

describe('student growth records route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.growthRecord.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.count.mockResolvedValue(0);
  });

  it('reads only non-invalidated persisted growth events and applies the same count filter', async () => {
    mocks.prisma.growthRecord.findMany.mockResolvedValue([{
      id: 'growth-1',
      recordType: 'portrait-state-change',
      title: '累计能力画像更新',
      description: '累计能力状态发生证据支持的变化。',
      occurredAt: new Date('2026-07-23T08:00:00.000Z'),
      evidenceJson: {
        overallScore: 78,
        confidence: 0.82,
        trend: 'up',
        evidencedDimensionIds: ['controlModelingRepresentation'],
        factHashes: ['private-support-hash'],
        stateDigest: 'private-state-digest',
        stateWatermark: '19',
        supportFactIds: ['fact-1'],
        providerInput: 'private-provider-input',
        rawAnswer: 'private-answer',
      },
    }]);
    mocks.prisma.growthRecord.count.mockResolvedValue(1);

    const response = await GET(new NextRequest(
      'http://localhost/api/student/growth-records?page=1&limit=10',
    ));
    const body = await response.json();
    const where = {
      userId: 'student-1',
      invalidations: { none: {} },
    };

    expect(response.status).toBe(200);
    expect(mocks.prisma.growthRecord.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(mocks.prisma.growthRecord.count).toHaveBeenCalledWith({ where });
    expect(body).toEqual({
      records: [{
        id: 'growth-1',
        type: 'portrait-state-change',
        title: '累计能力画像更新',
        description: '累计能力状态发生证据支持的变化。',
        date: '2026-07-23T08:00:00.000Z',
        metadata: {
          overallScore: 78,
          confidence: 0.82,
          trend: 'up',
          evidencedDimensionIds: ['controlModelingRepresentation'],
        },
        icon: 'LineChart',
      }],
      total: 1,
      hasMore: false,
    });
    expect(JSON.stringify(body)).not.toContain('private-support-hash');
    expect(JSON.stringify(body)).not.toContain('fact-1');
    expect(JSON.stringify(body)).not.toContain('private-provider-input');
    expect(JSON.stringify(body)).not.toContain('private-answer');
    expect(body.records[0].metadata).not.toHaveProperty('stateDigest');
    expect(body.records[0].metadata).not.toHaveProperty('stateWatermark');
  });

  it('returns an empty cumulative growth history without risk or learning-fact fallback', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/growth-records?limit=10',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [],
      total: 0,
      hasMore: false,
    });
    expect(Object.keys(mocks.prisma)).toEqual(['growthRecord']);
  });

  it('paginates the persisted valid record set directly', async () => {
    mocks.prisma.growthRecord.findMany.mockResolvedValue([{
      id: 'growth-2',
      recordType: 'strength-change',
      title: '优势维度变化',
      description: '累计能力优势发生变化。',
      occurredAt: new Date('2026-07-22T08:00:00.000Z'),
      evidenceJson: {},
    }]);
    mocks.prisma.growthRecord.count.mockResolvedValue(3);

    const body = await (await GET(new NextRequest(
      'http://localhost/api/student/growth-records?page=2&limit=2',
    ))).json();

    expect(mocks.prisma.growthRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 2,
      take: 2,
    }));
    expect(body).toMatchObject({
      total: 3,
      hasMore: false,
      records: [{ id: 'growth-2', icon: 'TrendingUp' }],
    });
  });

  it('preserves authentication before growth record lookup', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET(new NextRequest(
      'http://localhost/api/student/growth-records',
    ));

    expect(response.status).toBe(401);
    expect(mocks.prisma.growthRecord.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.growthRecord.count).not.toHaveBeenCalled();
  });
});

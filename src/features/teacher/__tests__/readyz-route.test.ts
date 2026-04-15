import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('readyz route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
    mocks.redisClient.getClient.mockReturnValue({
      ping: vi.fn().mockResolvedValue('PONG'),
    });
  });

  it('forces dynamic evaluation without route cache', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(revalidate).toBe(0);
  });

  it('returns a no-store response when all dependencies are healthy', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    await expect(response.json()).resolves.toMatchObject({
      app: true,
      db: true,
      redis: true,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    arenaSubmission: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { prismaArenaSubmissionStore } from '../submissions/prisma-store';

describe('prismaArenaSubmissionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty submission list when Arena tables have not been migrated yet', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(Object.assign(new Error('missing table'), {
      code: 'P2021',
    }));

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
  });

  it('returns an empty submission list in local development when DATABASE_URL is missing', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(
      new Error('Environment variable not found: DATABASE_URL'),
    );

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
  });

  it('returns an empty submission list in tests when the Arena Prisma delegate is absent', async () => {
    const originalDelegate = mocks.prisma.arenaSubmission;
    (mocks.prisma as { arenaSubmission?: unknown }).arenaSubmission = undefined;

    try {
      await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
    } finally {
      mocks.prisma.arenaSubmission = originalDelegate;
    }
  });

  it('rethrows non-migration errors while listing submissions', async () => {
    const error = Object.assign(new Error('connection failed'), { code: 'P1001' });
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(error);

    await expect(prismaArenaSubmissionStore.listSubmissions()).rejects.toBe(error);
  });
});

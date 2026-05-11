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

  it('rethrows non-migration errors while listing submissions', async () => {
    const error = Object.assign(new Error('connection failed'), { code: 'P1001' });
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(error);

    await expect(prismaArenaSubmissionStore.listSubmissions()).rejects.toBe(error);
  });
});

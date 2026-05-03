import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const studentProfileFindUnique = vi.fn();
  const sessionProfileCache = {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  };
  const sessionRequestDeduplicator = {
    execute: vi.fn(async (_key: string, requestFn: () => Promise<unknown>) => requestFn()),
  };

  return {
    prisma: {
      studentProfile: {
        findUnique: studentProfileFindUnique,
      },
      user: {
        findFirst: vi.fn(),
      },
    },
    sessionProfileCache,
    sessionRequestDeduplicator,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/lru-cache', () => ({
  sessionProfileCache: mocks.sessionProfileCache,
  sessionRequestDeduplicator: mocks.sessionRequestDeduplicator,
}));

import { authOptions } from '@/lib/auth';

type SessionCallbackInput = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>['session']>>[0];

describe('auth session resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionProfileCache.get.mockReturnValue(undefined);
  });

  it('keeps the base session when student profile lookup hits a transient database error', async () => {
    mocks.prisma.studentProfile.findUnique.mockRejectedValue(
      Object.assign(new Error('db offline'), {
        code: 'P1001',
        name: 'PrismaClientKnownRequestError',
      })
    );

    const session = await authOptions.callbacks!.session!({
      session: {
        user: {
          name: '李老师',
          email: 'teacher@example.com',
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      token: {
        id: 'teacher-1',
        role: UserRole.TEACHER,
      },
      user: undefined,
      newSession: undefined,
      trigger: 'update',
    } as unknown as SessionCallbackInput);

    const user = session.user as NonNullable<typeof session.user> & { profile?: unknown };
    expect(user).toMatchObject({
      id: 'teacher-1',
      role: UserRole.TEACHER,
      name: '李老师',
      email: 'teacher@example.com',
    });
    expect(user.profile).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@prisma/client';
import { decode, encode } from 'next-auth/jwt';

const mocks = vi.hoisted(() => {
  const studentProfileFindUnique = vi.fn();
  const compare = vi.fn();
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
    compare,
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

vi.mock('bcryptjs', () => ({
  compare: mocks.compare,
}));

import { authOptions } from '@/lib/auth';

type SessionCallbackInput = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>['session']>>[0];
type JwtCallbackInput = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>['jwt']>>[0];

async function authorizeCredentials(credentials: Record<string, string>) {
  const provider = authOptions.providers[0] as typeof authOptions.providers[number] & {
    options?: {
      authorize?: (credentials: Record<string, string>) => Promise<unknown>;
    };
  };

  return provider.options?.authorize?.(credentials);
}

describe('auth session resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionProfileCache.get.mockReturnValue(undefined);
  });

  it('authorizes credentials login by student number and preserves id and role', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({
      id: 'student-1',
      email: 'student@example.com',
      name: '学生甲',
      role: UserRole.STUDENT,
      passwordHash: 'stored-hash',
    });
    mocks.compare.mockResolvedValue(true);

    const user = await authorizeCredentials({
      email: ' 20240001 ',
      password: 'secret',
    });

    expect(mocks.prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            profile: {
              is: {
                studentNumber: { equals: '20240001', mode: 'insensitive' },
              },
            },
          },
          { employeeNumber: { equals: '20240001', mode: 'insensitive' } },
        ],
      },
    });
    expect(mocks.compare).toHaveBeenCalledWith('secret', 'stored-hash');
    expect(user).toEqual({
      id: 'student-1',
      email: 'student@example.com',
      name: '学生甲',
      role: UserRole.STUDENT,
    });
  });

  it('rejects credentials login when the password does not match', async () => {
    mocks.prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-1',
      email: 'teacher@example.com',
      name: '教师甲',
      role: UserRole.TEACHER,
      passwordHash: 'stored-hash',
    });
    mocks.compare.mockResolvedValue(false);

    const user = await authorizeCredentials({
      email: 'T2024001',
      password: 'wrong',
    });

    expect(user).toBeNull();
  });

  it('copies custom user id and role fields into jwt tokens', async () => {
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: '管理员',
        role: UserRole.ADMIN,
      },
      account: null,
      profile: undefined,
      trigger: 'signIn',
      isNewUser: false,
      session: undefined,
    } as unknown as JwtCallbackInput);

    expect(token).toMatchObject({
      id: 'admin-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
  });

  it('keeps NextAuth jwt encode/decode compatible with the uuid override', async () => {
    const secret = 'test-secret-for-next-auth-jwt-compatibility';

    const encoded = await encode({
      token: {
        sub: 'student-1',
        id: 'student-1',
        email: 'student@example.com',
        role: UserRole.STUDENT,
      },
      secret,
    });
    const decoded = await decode({
      token: encoded,
      secret,
    });

    expect(typeof encoded).toBe('string');
    expect(decoded).toMatchObject({
      sub: 'student-1',
      id: 'student-1',
      role: UserRole.STUDENT,
    });
  });

  it('enriches student sessions with profile fields while preserving the session contract', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      studentNumber: '20240001',
      classId: 'class-1',
      techScore: 88,
      ethicsScore: 100,
      major: '自动化',
      className: '自动化2401',
    });

    const session = await authOptions.callbacks!.session!({
      session: {
        user: {
          name: '学生甲',
          email: 'student@example.com',
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      token: {
        id: 'student-1',
        role: UserRole.STUDENT,
      },
      user: undefined,
      newSession: undefined,
      trigger: 'update',
    } as unknown as SessionCallbackInput);

    expect(session.user).toMatchObject({
      id: 'student-1',
      role: UserRole.STUDENT,
      name: '学生甲',
      profile: {
        studentNumber: '20240001',
        classId: 'class-1',
        techScore: 88,
      },
    });
    expect(mocks.sessionProfileCache.set).toHaveBeenCalledWith('student-1', expect.objectContaining({
      studentNumber: '20240001',
    }));
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
          name: '学生乙',
          email: 'student-b@example.com',
        },
        expires: '2099-01-01T00:00:00.000Z',
      },
      token: {
        id: 'student-2',
        role: UserRole.STUDENT,
      },
      user: undefined,
      newSession: undefined,
      trigger: 'update',
    } as unknown as SessionCallbackInput);

    const user = session.user as NonNullable<typeof session.user> & { profile?: unknown };
    expect(user).toMatchObject({
      id: 'student-2',
      role: UserRole.STUDENT,
      name: '学生乙',
      email: 'student-b@example.com',
    });
    expect(mocks.prisma.studentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-2' },
      select: {
        studentNumber: true,
        classId: true,
        techScore: true,
        ethicsScore: true,
        major: true,
        className: true,
      },
    });
    expect(user.profile).toBeUndefined();
  });
});

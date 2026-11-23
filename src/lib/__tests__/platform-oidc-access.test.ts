import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { ILAB_GRANT_COOKIE_NAME, sealIlabGrant } from '@/features/ilab/grant-cookie';

/**
 * 统一身份受控接入单测（issue-2164 阶段 A）。
 * 通过动态 import + 环境变量注入驱动 authOptions 构造（模块加载期读 env）。
 */

const prismaMock = vi.fn();
const accountFindFirst = vi.fn();
const accountCreate = vi.fn();
const accountUpdate = vi.fn();
const accountCount = vi.fn();
const authorizeActIdentity = vi.fn();
const userFindFirst = vi.fn();
const userFindUnique = vi.fn();
const readCookie = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: readCookie }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findFirst: (...args: unknown[]) => accountFindFirst(...args),
      create: (...args: unknown[]) => accountCreate(...args),
      update: (...args: unknown[]) => accountUpdate(...args),
      count: (...args: unknown[]) => accountCount(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => userFindFirst(...args),
      findUnique: (...args: unknown[]) => userFindUnique(...args),
    },
    $connect: prismaMock,
  },
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(async (_password: string, hash: string) => hash === 'valid-hash'),
}));

vi.mock('@/lib/platform-access', () => ({
  authorizeActIdentity: (...args: unknown[]) => authorizeActIdentity(...args),
  platformAccountId: (issuer: string, subject: string) => `${issuer}|${subject}`,
}));

async function loadAuth(env: Record<string, string>) {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  for (const key of ['PLATFORM_OIDC_ISSUER', 'PLATFORM_OIDC_CLIENT_ID', 'PLATFORM_OIDC_CLIENT_SECRET', 'PLATFORM_OIDC_ENFORCED']) {
    previous[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  const authModule = await import('@/lib/auth');
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return authModule;
}

const OIDC_ENV = {
  PLATFORM_OIDC_ISSUER: 'http://127.0.0.1:18080/realms/platform-test',
  PLATFORM_OIDC_CLIENT_ID: 'act-test',
  PLATFORM_OIDC_CLIENT_SECRET: 'secret',
};

beforeEach(() => {
  vi.clearAllMocks();
  readCookie.mockReset();
  authorizeActIdentity.mockResolvedValue({ allow: true, personId: 'person-central', sessionVersion: 1, reason: 'grant' });
});

afterEach(() => vi.unstubAllEnvs());

describe('provider 受控启用', () => {
  it('未配置时 providers 仅本地凭据（零行为变化）', async () => {
    const { authOptions, isPlatformOidcEnabled } = await loadAuth({});
    expect(isPlatformOidcEnabled).toBe(false);
    expect(authOptions.providers).toHaveLength(1);
  });

  it('三变量齐备才附加 keycloak', async () => {
    const partial = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_CLIENT_SECRET: '' });
    expect(partial.isPlatformOidcEnabled).toBe(false);

    const full = await loadAuth(OIDC_ENV);
    expect(full.isPlatformOidcEnabled).toBe(true);
    expect(full.authOptions.providers).toHaveLength(2);
  });
});

describe('person_id 映射（signIn 回调）', () => {
  it('既有映射直登且改写会话用户为本地 User（角色回填）', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue({ id: 'account-1', userId: 'local-user-1' });
    userFindUnique.mockResolvedValue({ id: 'local-user-1', role: 'TEACHER', email: 't@x.c', name: 'T' });
    const user = { id: 'oidc-temp' } as { id?: string; role?: string };
    const result = await authOptions.callbacks?.signIn?.({
      user,
      account: { provider: 'keycloak' },
      profile: { sub: 'person-42' },
    });
    expect(result).toBe(true);
    expect(user.id).toBe('local-user-1');
    expect(user.role).toBe('TEACHER', '本地 DB 角色必须写入会话用户');
    expect(accountCreate).not.toHaveBeenCalled();
    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        providerAccountId: `${OIDC_ENV.PLATFORM_OIDC_ISSUER}|person-42`,
        session_state: 'person-central',
      },
    });
  });

  it('映射指向已删除用户时拒绝（不自动改绑）', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue({ userId: 'deleted-user' });
    userFindUnique.mockResolvedValue(null);
    const result = await authOptions.callbacks?.signIn?.({
      user: {} as { id: string },
      account: { provider: 'keycloak' },
      profile: { sub: 'person-42' },
    });
    expect(result).toBe(false);
  });

  it('无可信映射时不得按 email 自动并号', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue(null);
    const user = { id: 'oidc-temp' } as { id: string };
    const result = await authOptions.callbacks?.signIn?.({
      user,
      account: { provider: 'keycloak' },
      profile: { sub: 'person-7', email: 'yongwei@example.edu.cn' },
    });
    expect(result).toBe(false);
    expect(accountCreate).not.toHaveBeenCalled();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it('无可信映射时不得按学号或工号自动并号', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue(null);
    const user = { id: 'oidc-temp' } as { id?: string };
    const result = await authOptions.callbacks?.signIn?.({
      user,
      account: { provider: 'keycloak' },
      profile: { sub: 'person-9', email: 'different@idp.cn', preferred_username: '20230101' },
    });
    expect(result).toBe(false);
    expect(accountCreate).not.toHaveBeenCalled();
    expect(userFindFirst).not.toHaveBeenCalled();
  });

  it('声明匹配不到任何用户时拒绝且不自动建号', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue(null);
    userFindFirst.mockResolvedValue(null);
    const result = await authOptions.callbacks?.signIn?.({
      user: {} as { id: string },
      account: { provider: 'keycloak' },
      profile: { sub: 'person-unknown', email: 'nobody@example.edu.cn' },
    });
    expect(result).toBe(false);
    expect(accountCreate).not.toHaveBeenCalled();
  });

  it('中央无 ACT 准入时拒绝登录', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    authorizeActIdentity.mockResolvedValue({ allow: false, personId: 'person-central', sessionVersion: 1, reason: 'no-eligibility' });
    const result = await authOptions.callbacks?.signIn?.({
      user: {} as { id: string },
      account: { provider: 'keycloak' },
      profile: { sub: 'person-42' },
    });
    expect(result).toBe(false);
    expect(accountFindFirst).not.toHaveBeenCalled();
  });

  it('本地凭据路径不经过映射逻辑', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    const result = await authOptions.callbacks?.signIn?.({
      user: {} as { id: string },
      account: { provider: 'credentials' },
      profile: undefined,
    });
    expect(result).toBe(true);
    expect(accountFindFirst).not.toHaveBeenCalled();
  });
});

describe('迁移账号旧凭据收紧（authorize）', () => {
  async function authorizeWith(env: Record<string, string>, identifier: string, password: string) {
    const { authOptions } = await loadAuth(env);
    const credentialsProvider = authOptions.providers.find(
      (provider) => 'credentials' in provider,
    ) as { options: { authorize: (input: { email?: string; password?: string }) => Promise<unknown> } };
    return credentialsProvider.options.authorize({ email: identifier, password });
  }

  const USER = {
    id: 'u1',
    passwordHash: 'valid-hash',
    role: 'STUDENT',
    email: 'a@b.c',
    name: 'A',
  };

  it('默认（ENFORCED 未开启）已映射用户本地密码仍可用（灰度双通道）', async () => {
    userFindFirst.mockResolvedValue(USER);
    accountCount.mockResolvedValue(1);
    const result = await authorizeWith(OIDC_ENV, 'a@b.c', 'pw');
    expect(result).not.toBeNull();
  });

  it('ENFORCED=true 且已映射 → 拒绝（与密码错误不可区分）', async () => {
    userFindFirst.mockResolvedValue(USER);
    accountCount.mockResolvedValue(1);
    const result = await authorizeWith(
      { ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' },
      'a@b.c',
      'pw',
    );
    expect(result).toBeNull();
  });

  it('ENFORCED=true 但未映射 → 本地密码仍可用', async () => {
    userFindFirst.mockResolvedValue(USER);
    accountCount.mockResolvedValue(0);
    const result = await authorizeWith(
      { ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' },
      'a@b.c',
      'pw',
    );
    expect(result).not.toBeNull();
  });

  it('错误密码始终拒绝（映射检查不掩盖密码校验）', async () => {
    userFindFirst.mockResolvedValue({ ...USER, passwordHash: 'wrong-hash' });
    const result = await authorizeWith(OIDC_ENV, 'a@b.c', 'pw');
    expect(result).toBeNull();
  });
});

describe('强制模式下历史 JWT', () => {
  it('中央超时、明确拒绝和恢复授权逐次核验，只有实际准入才恢复用户', async () => {
    const { authOptions } = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' });
    const jwt = authOptions.callbacks!.jwt!;
    const toSession = authOptions.callbacks!.session!;
    const token: JWT = { id: 'u1', email: 't@example.test', role: 'TEACHER', platformIssuer: 'issuer', platformSubject: 'sub', centralSessionVersion: 4 };
    for (const [reason, expected] of [
      ['unavailable', 'ACT_ACCESS_UNAVAILABLE'], ['session', 'ACT_ACCESS_DENIED'], ['grant', undefined],
    ] as const) {
      authorizeActIdentity.mockResolvedValue({ allow: reason === 'grant', reason, sessionVersion: 4, personId: 'p1' });
      const current = await jwt({ token } as Parameters<typeof jwt>[0]);
      const session = await toSession({
        session: { user: { id: 'u1', role: 'TEACHER' }, expires: '2099-01-01' }, token: current,
      } as Parameters<typeof toSession>[0]) as Session;
      expect(session.error).toBe(expected);
      expect(session.user?.id).toBe(expected ? undefined : 'u1');
    }
    expect(authorizeActIdentity).toHaveBeenCalledTimes(3);
  });

  it('已映射但缺少中央字段的旧会话必须失效', async () => {
    const { authOptions } = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' });
    accountCount.mockResolvedValue(1);
    const token = await authOptions.callbacks?.jwt?.({
      token: { id: 'u1', role: 'STUDENT' },
      user: undefined,
    });
    expect(token.centralAccessDenied).toBe(true);
    const session = await authOptions.callbacks?.session?.({
      session: { user: { id: 'u1', role: 'STUDENT' } },
      token,
    });
    expect(session.user).toBeUndefined();
    expect(session.error).toBe('ACT_ACCESS_DENIED');
  });

  function setExperimentGrant(userId: string, issuedAtMs = Date.now()) {
    vi.stubEnv('ILAB_SECRET', 'test-grant-key');
    readCookie.mockImplementation((name: string) => name === ILAB_GRANT_COOKIE_NAME
      ? { value: sealIlabGrant({
          v: 1, appId: 'test-app', username: 'learner', displayName: 'Test Learner',
          userId, issuedAtMs, accessToken: 'test-token', expiresAtMs: null, bypass: false,
        }) }
      : undefined);
  }

  it('同一实验空间学生已有中央映射时，认可有效的同账号实验授权', async () => {
    const { authOptions } = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' });
    accountCount.mockResolvedValue(1);
    setExperimentGrant('student');
    const jwt = authOptions.callbacks!.jwt!;
    const token: JWT = { id: 'student', email: '', role: 'STUDENT', centralAccessDenied: true };
    const result = await jwt({ token } as Parameters<typeof jwt>[0]);
    expect(result.centralAccessDenied).toBe(false);
    expect(authorizeActIdentity).not.toHaveBeenCalled();
  });

  it.each([
    ['other-student', 0, 'STUDENT'],
    ['student', 73, 'STUDENT'],
    ['student', 0, 'TEACHER'],
  ] as const)('拒绝不匹配、过期或非学生的实验授权 (%s, %s, %s)', async (grantOwner, grantAgeHours, role) => {
    const { authOptions } = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' });
    accountCount.mockResolvedValue(1);
    setExperimentGrant(grantOwner, Date.now() - grantAgeHours * 60 * 60 * 1000);
    const jwt = authOptions.callbacks!.jwt!;
    const token: JWT = { id: 'student', email: '', role };
    expect((await jwt({ token } as Parameters<typeof jwt>[0])).centralAccessDenied).toBe(true);
  });

  it('中央登录被撤权时，遗留的同账号实验授权不能改变中央核验结果', async () => {
    const { authOptions } = await loadAuth({ ...OIDC_ENV, PLATFORM_OIDC_ENFORCED: 'true' });
    setExperimentGrant('student');
    authorizeActIdentity.mockResolvedValue({ allow: false, reason: 'revoked' });
    const jwt = authOptions.callbacks!.jwt!;
    const token: JWT = { id: 'student', email: '', role: 'STUDENT', platformIssuer: 'issuer', platformSubject: 'sub' };
    expect((await jwt({ token } as Parameters<typeof jwt>[0])).centralAccessDenied).toBe(true);
    expect(authorizeActIdentity).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 统一身份受控接入单测（issue-2164 阶段 A）。
 * 通过动态 import + 环境变量注入驱动 authOptions 构造（模块加载期读 env）。
 */

const prismaMock = vi.fn();
const accountFindFirst = vi.fn();
const accountCreate = vi.fn();
const accountCount = vi.fn();
const userFindFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findFirst: (...args: unknown[]) => accountFindFirst(...args),
      create: (...args: unknown[]) => accountCreate(...args),
      count: (...args: unknown[]) => accountCount(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => userFindFirst(...args),
    },
    $connect: prismaMock,
  },
}));

vi.mock('bcryptjs', () => ({
  compare: vi.fn(async (_password: string, hash: string) => hash === 'valid-hash'),
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
  const module = await import('@/lib/auth');
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return module;
}

const OIDC_ENV = {
  PLATFORM_OIDC_ISSUER: 'http://127.0.0.1:18080/realms/platform-test',
  PLATFORM_OIDC_CLIENT_ID: 'act-test',
  PLATFORM_OIDC_CLIENT_SECRET: 'secret',
};

beforeEach(() => {
  vi.clearAllMocks();
});

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
  it('既有映射直登且改写会话用户为本地 User', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue({ userId: 'local-user-1' });
    const user = { id: 'oidc-temp' } as { id: string };
    const result = await authOptions.callbacks?.signIn?.({
      user,
      account: { provider: 'keycloak' },
      profile: { sub: 'person-42' },
    });
    expect(result).toBe(true);
    expect(user.id).toBe('local-user-1');
    expect(accountCreate).not.toHaveBeenCalled();
  });

  it('无映射时按 email 匹配并建立关联', async () => {
    const { authOptions } = await loadAuth(OIDC_ENV);
    accountFindFirst.mockResolvedValue(null);
    userFindFirst.mockResolvedValue({ id: 'local-user-2', role: 'STUDENT' });
    accountCreate.mockResolvedValue({});
    const user = { id: 'oidc-temp' } as { id: string };
    const result = await authOptions.callbacks?.signIn?.({
      user,
      account: { provider: 'keycloak' },
      profile: { sub: 'person-7', email: 'yongwei@example.edu.cn' },
    });
    expect(result).toBe(true);
    expect(user.id).toBe('local-user-2');
    expect(accountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'platform',
          providerAccountId: 'person-7',
          userId: 'local-user-2',
        }),
      }),
    );
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

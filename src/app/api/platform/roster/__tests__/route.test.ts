import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/platform/roster/route';

const findMany = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

const users = [
  {
    id: 'u-admin', name: '管理员', role: 'ADMIN', employeeNumber: 'E-1', updatedAt: new Date('2026-01-01T00:00:00Z'),
    profile: null,
    accounts: [{ providerAccountId: 'subject-1', session_state: 'person-1' }],
  },
  {
    id: 'u-only', name: '本地用户', role: 'STUDENT', employeeNumber: null, updatedAt: new Date('2026-01-02T00:00:00Z'),
    profile: { studentNumber: null }, accounts: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ACT_ROSTER_EXPORT_TOKEN = 'synthetic-roster-token';
  process.env.PLATFORM_OIDC_ISSUER = 'https://auth.example/realms/platform';
  findMany.mockResolvedValue(users);
});

describe('ACT roster export', () => {
  it('requires the independent export token', async () => {
    const response = await GET(new Request('http://localhost/api/platform/roster') as never);
    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('exports role baselines, ACT-only exceptions, and explicit admin mappings without secrets', async () => {
    const response = await GET(new Request('http://localhost/api/platform/roster?limit=1', {
      headers: { authorization: 'Bearer synthetic-roster-token' },
    }) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('act');
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe('u-admin');
    expect(body.apps.act.accounts).toHaveLength(1);
    expect(body.apps.act.accounts[0]).toMatchObject({
      localUserId: 'u-admin', employeeId: 'E-1', identifierType: 'employee_no', eligible: true,
      identityLink: { issuer: 'https://auth.example/realms/platform', subject: 'subject-1', personId: 'person-1' },
    });
    expect(body.adminMappings).toEqual([{ personId: 'person-1', appId: 'act', localUserId: 'u-admin' }]);
    expect(JSON.stringify(body)).not.toMatch(/password|token|secret|email/i);
  });

  it('keeps an ACT-only account as an explicit exception', async () => {
    const response = await GET(new Request('http://localhost/api/platform/roster?limit=200', {
      headers: { authorization: 'Bearer synthetic-roster-token' },
    }) as never);
    const body = await response.json();
    expect(body.apps.act.accounts[1]).toMatchObject({ localUserId: 'u-only', exception: 'act-only', eligible: true });
    expect(body.apps.act.accounts[1].identityLink).toBeNull();
  });
});

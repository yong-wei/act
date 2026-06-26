import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    adminOperationLedger: {
      upsert: vi.fn(),
    },
    adminOperationArtifact: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '../route';

describe('GET /api/admin/users/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.user.count.mockResolvedValue(2);
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: 'student-1',
        name: '张三',
        email: 'zhang@example.test',
        role: 'STUDENT',
        employeeNumber: null,
        createdAt: new Date('2026-06-21T08:00:00.000Z'),
        profile: { studentNumber: '20240001', className: '自动化2401' },
      },
      {
        id: 'student-2',
        name: '李四',
        email: null,
        role: 'STUDENT',
        employeeNumber: null,
        createdAt: new Date('2026-06-21T09:00:00.000Z'),
        profile: { studentNumber: '20240002', className: '自动化2401' },
      },
    ]);
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
  });

  it('exports the full filtered set without page skip/take', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/users/export?q=2024&role=STUDENT&page=2&pageSize=1',
    ) as never);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('x-export-total')).toBe('2');
    expect(response.headers.get('x-export-count')).toBe('2');
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-users-export:/);
    expect(response.headers.get('x-admin-operation-outcome')).toBe('export-ready');
    expect(response.headers.get('x-admin-operation-idempotency-key')).toMatch(/^admin-op:/);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalled();
    expect(csv).toContain('"student-1","张三"');
    expect(csv).toContain('"student-2","李四"');
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.not.objectContaining({
      skip: expect.any(Number),
    }));
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: 'STUDENT' }),
      take: 5000,
    }));
  });

  it('binds export ledger keys to the actual exported users, not only counts', async () => {
    const firstResponse = await GET(new Request(
      'http://localhost/api/admin/users/export?role=STUDENT',
    ) as never);
    const firstKey = firstResponse.headers.get('x-admin-operation-idempotency-key');

    mocks.prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'student-3',
        name: '王五',
        email: 'wang@example.test',
        role: 'STUDENT',
        employeeNumber: null,
        createdAt: new Date('2026-06-21T08:00:00.000Z'),
        profile: { studentNumber: '20240003', className: '自动化2401' },
      },
      {
        id: 'student-4',
        name: '赵六',
        email: null,
        role: 'STUDENT',
        employeeNumber: null,
        createdAt: new Date('2026-06-21T09:00:00.000Z'),
        profile: { studentNumber: '20240004', className: '自动化2401' },
      },
    ]);

    const secondResponse = await GET(new Request(
      'http://localhost/api/admin/users/export?role=STUDENT',
    ) as never);
    const secondKey = secondResponse.headers.get('x-admin-operation-idempotency-key');

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstKey).toMatch(/^admin-op:/);
    expect(secondKey).toMatch(/^admin-op:/);
    expect(secondKey).not.toBe(firstKey);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledTimes(2);
  });

  it('blocks unsupported role filters before querying users', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/users/export?role=BAD',
    ) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual(expect.objectContaining({
      code: 'invalid-role-filter',
    }));
    expect(mocks.prisma.user.count).not.toHaveBeenCalled();
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('escapes spreadsheet formula prefixes in CSV fields', async () => {
    mocks.prisma.user.count.mockResolvedValue(1);
    mocks.prisma.user.findMany.mockResolvedValue([
      {
        id: 'student-formula',
        name: '=cmd"quote',
        email: '+mail@example.test',
        role: 'STUDENT',
        employeeNumber: '@employee',
        createdAt: new Date('2026-06-21T10:00:00.000Z'),
        profile: { studentNumber: null, className: ' @自动化"2401' },
      },
    ]);

    const response = await GET(new Request(
      'http://localhost/api/admin/users/export?role=STUDENT',
    ) as never);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain(`"'=cmd""quote"`);
    expect(csv).toContain(`"'+mail@example.test"`);
    expect(csv).toContain(`"'@employee"`);
    expect(csv).toContain(`"' @自动化""2401"`);
  });
});

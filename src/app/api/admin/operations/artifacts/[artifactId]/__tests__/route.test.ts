import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
    adminOperationLedger: {
      upsert: vi.fn(),
    },
    adminOperationArtifact: {
      findUnique: vi.fn(),
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

function buildContext(artifactId: string) {
  return {
    params: Promise.resolve({ artifactId: encodeURIComponent(artifactId) }),
  };
}

describe('GET /api/admin/operations/artifacts/[artifactId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.findUnique.mockResolvedValue({
      artifactId: 'admin-user-import-batch:failed-rows',
      label: 'PII 最小化失败行',
      kind: 'failed-rows',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      rowCount: 1,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      payload: {
        failedRows: [{
          row: 2,
          accountFingerprint: 'abc123',
          reason: '角色无效',
        }],
      },
    });
  });

  it('returns role-scoped PII-minimized failed rows and records the download operation', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/operations/artifacts/admin-user-import-batch%3Afailed-rows',
    ) as never, buildContext('admin-user-import-batch:failed-rows'));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain('"row","accountFingerprint","reason"');
    expect(csv).toContain('"2","abc123","角色无效"');
    expect(csv).not.toContain('20240001');
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-import-failed-rows-download:/);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'admin-import-failed-rows-download',
        outcome: 'download-ready',
      }),
    }));
  });

  it('rejects expired artifacts', async () => {
    mocks.prisma.adminOperationArtifact.findUnique.mockResolvedValue({
      artifactId: 'expired',
      label: 'expired',
      kind: 'failed-rows',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      rowCount: 0,
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      payload: { failedRows: [] },
    });

    const response = await GET(new Request(
      'http://localhost/api/admin/operations/artifacts/expired',
    ) as never, buildContext('expired'));

    expect(response.status).toBe(410);
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('rejects artifacts outside the actor role scope', async () => {
    mocks.prisma.adminOperationArtifact.findUnique.mockResolvedValue({
      artifactId: 'teacher-only',
      label: 'teacher-only',
      kind: 'failed-rows',
      authorizedRoles: ['TEACHER'],
      piiMinimized: true,
      rowCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      payload: { failedRows: [] },
    });

    const response = await GET(new Request(
      'http://localhost/api/admin/operations/artifacts/teacher-only',
    ) as never, buildContext('teacher-only'));

    expect(response.status).toBe(403);
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('rejects revoked artifacts', async () => {
    mocks.prisma.adminOperationArtifact.findUnique.mockResolvedValue({
      artifactId: 'revoked',
      label: 'revoked',
      kind: 'failed-rows',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      rowCount: 0,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      payload: { failedRows: [] },
    });

    const response = await GET(new Request(
      'http://localhost/api/admin/operations/artifacts/revoked',
    ) as never, buildContext('revoked'));

    expect(response.status).toBe(410);
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new Request(
      'http://localhost/api/admin/operations/artifacts/admin-user-import-batch%3Afailed-rows',
    ) as never, buildContext('admin-user-import-batch:failed-rows'));

    expect(response.status).toBe(401);
    expect(mocks.prisma.adminOperationArtifact.findUnique).not.toHaveBeenCalled();
  });
});

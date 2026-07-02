import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  prisma: {
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

describe('GET /api/admin/states/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
  });

  it('exports demo system usage data through a durable admin operation ledger', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/admin/states/export?source=demo&format=json',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toMatch(/admin-system-usage-\d{4}-\d{2}-\d{2}\.json/);
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-states-export:/);
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-states-export',
      actorId: 'admin-1',
      outcome: 'export-ready',
      idempotencyKey: expect.stringMatching(/^admin-op:/),
    });
    expect(payload.auditRecord).toMatchObject({
      action: 'admin-states-export',
      outcome: 'export-ready',
      retentionPolicy: 'admin-operation-ledger-30d',
    });
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        kind: 'admin-states-export',
        scope: 'admin-states-demo',
      }),
    }));
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET(new NextRequest(
      'http://localhost/api/admin/states/export?source=demo',
    ));

    expect(response.status).toBe(401);
    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
  });
});

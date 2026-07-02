import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  writeXlsxFile: vi.fn(),
  prisma: {
    studentRiskFlag: {
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

vi.mock('write-excel-file/node', () => ({
  default: mocks.writeXlsxFile,
}));

import { GET } from '../route';

describe('GET /api/admin/data-governance/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([
      {
        id: 'risk-1',
        userId: 'student-1',
        flagType: 'participation',
        severity: 'high',
        description: '参与度不足',
        triggeredAt: new Date('2026-06-21T08:00:00.000Z'),
        isResolved: false,
        user: { name: '张三', email: 'zhang@example.test' },
      },
    ]);
    mocks.writeXlsxFile.mockReturnValue({
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('xlsx-bytes')),
    });
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
  });

  it('exports governance risks as CSV with matching filename and content type', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=csv',
    ) as never);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('x-export-filename')).toMatch(/data-governance-risks-\d{4}-\d{2}-\d{2}\.csv/);
    expect(response.headers.get('x-admin-operation-id')).toMatch(/^admin-governance-export:/);
    expect(response.headers.get('x-admin-operation-idempotency-key')).toMatch(/^admin-op:/);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalled();
    expect(csv).toContain('"risk-1","student-1","张三"');
  });

  it('escapes spreadsheet formula prefixes in governance CSV fields', async () => {
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([
      {
        id: 'risk-formula',
        userId: 'student-formula',
        flagType: '+participation',
        severity: '-high',
        description: ' @说明"风险',
        triggeredAt: new Date('2026-06-21T08:00:00.000Z'),
        isResolved: false,
        user: { name: '=张三', email: 'zhang@example.test' },
      },
    ]);

    const response = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=csv',
    ) as never);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv).toContain(`"'=张三"`);
    expect(csv).toContain(`"'+participation"`);
    expect(csv).toContain(`"'-high"`);
    expect(csv).toContain(`"' @说明""风险"`);
  });

  it('exports governance risks as XLSX when requested', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=xlsx',
    ) as never);
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet');
    expect(response.headers.get('x-export-filename')).toMatch(/\.xlsx$/);
    expect(response.headers.get('x-admin-operation-outcome')).toBe('export-ready');
    expect(Buffer.from(body).toString()).toBe('xlsx-bytes');
    expect(mocks.writeXlsxFile).toHaveBeenCalled();
  });

  it('binds export ledger keys to the actual risk set, not only row count', async () => {
    const firstResponse = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=csv',
    ) as never);
    const firstKey = firstResponse.headers.get('x-admin-operation-idempotency-key');

    mocks.prisma.studentRiskFlag.findMany.mockResolvedValueOnce([
      {
        id: 'risk-2',
        userId: 'student-2',
        flagType: 'participation',
        severity: 'high',
        description: '新风险',
        triggeredAt: new Date('2026-06-21T08:00:00.000Z'),
        isResolved: false,
        user: { name: '李四', email: 'lisi@example.test' },
      },
    ]);

    const secondResponse = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=csv',
    ) as never);
    const secondKey = secondResponse.headers.get('x-admin-operation-idempotency-key');

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstKey).toMatch(/^admin-op:/);
    expect(secondKey).toMatch(/^admin-op:/);
    expect(secondKey).not.toBe(firstKey);
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledTimes(2);
  });

  it('does not persist export-ready ledger entries before XLSX generation succeeds', async () => {
    mocks.writeXlsxFile.mockReturnValueOnce({
      toBuffer: vi.fn().mockRejectedValue(new Error('xlsx generation failed')),
    });

    await expect(GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=xlsx',
    ) as never)).rejects.toThrow('xlsx generation failed');

    expect(mocks.prisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationArtifact.upsert).not.toHaveBeenCalled();
  });

  it('includes the operation ledger in JSON exports', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=json',
    ) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.operationLedger).toMatchObject({
      kind: 'admin-governance-export',
      actorId: 'admin-1',
      outcome: 'export-ready',
      idempotencyKey: expect.stringMatching(/^admin-op:/),
      rollback: {
        available: false,
      },
    });
    expect(payload.auditRecord).toMatchObject({
      operationId: expect.stringMatching(/^admin-governance-export:/),
      idempotencyKey: expect.stringMatching(/^admin-op:/),
    });
  });
});

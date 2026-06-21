import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  writeXlsxFile: vi.fn(),
  prisma: {
    studentRiskFlag: {
      findMany: vi.fn(),
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
  });

  it('exports governance risks as CSV with matching filename and content type', async () => {
    const response = await GET(new Request(
      'http://localhost/api/admin/data-governance/export?format=csv',
    ) as never);
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('x-export-filename')).toMatch(/data-governance-risks-\d{4}-\d{2}-\d{2}\.csv/);
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
    expect(Buffer.from(body).toString()).toBe('xlsx-bytes');
    expect(mocks.writeXlsxFile).toHaveBeenCalled();
  });
});

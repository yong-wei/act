import { readSheet } from 'read-excel-file/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

import { GET } from '../route';

describe('GET /api/admin/users/template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
  });

  it('generates a readable xlsx workbook with the official user import columns', async () => {
    const response = await GET();
    const rows = await readSheet(Buffer.from(await response.arrayBuffer()), '导入模板');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="users-template.xlsx"'
    );
    expect(rows[0]).toEqual([
      '账号',
      '姓名',
      '角色',
      '邮箱',
      '班级',
      '专业',
      '年级',
      '初始密码',
    ]);
    expect(rows[1][0]).toBe('20240001');
    expect(rows[2][2]).toBe('教师');
  });

  it('requires an admin session', async () => {
    mocks.requireAdminSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });
});

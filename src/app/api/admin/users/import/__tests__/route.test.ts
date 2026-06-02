import { beforeEach, describe, expect, it, vi } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  hash: vi.fn(),
  initializeUserProgress: vi.fn(),
  prisma: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/admin', () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock('bcryptjs', () => ({
  hash: mocks.hash,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/user-sync', () => ({
  initializeUserProgress: mocks.initializeUserProgress,
}));

import { POST } from '../route';

type WorkbookCell = string | number | null;

async function buildWorkbookFile(rows: Array<Array<WorkbookCell>>, name = 'users.xlsx') {
  const buffer = await writeXlsxFile(rows, { sheet: '导入模板' }).toBuffer();
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildImportRequest(file: File) {
  const formData = new FormData();
  formData.set('file', file);
  return new Request('http://localhost/api/admin/users/import', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/admin/users/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    mocks.hash.mockResolvedValue('hashed-password');
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.user.create.mockResolvedValue({
      id: 'student-user-1',
      profile: { id: 'profile-1' },
    });
  });

  it('imports a valid student workbook using the official columns', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240001', '张三', '学生', 'zhangsan@example.com', '自动化2401', '自动化', '2024', 'secret'],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 1,
      updated: 0,
      failed: 0,
      skippedEmpty: 0,
      totalRows: 1,
    });
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: '张三',
        email: 'zhangsan@example.com',
        role: 'STUDENT',
        profile: {
          create: expect.objectContaining({
            studentNumber: '20240001',
            className: '自动化2401',
          }),
        },
      }),
    }));
    expect(mocks.initializeUserProgress).toHaveBeenCalledWith('student-user-1');
  });

  it('normalizes numeric accounts and skips blank rows', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      [null, null, null, null, null, null, null, null],
      [20240003, '王五', '学生', null, '自动化2401', '自动化', 2024, null],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 1,
      updated: 0,
      failed: 0,
      skippedEmpty: 1,
      totalRows: 2,
    });
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: expect.arrayContaining([
          {
            employeeNumber: {
              equals: '20240003',
              mode: 'insensitive',
            },
          },
        ]),
      },
    }));
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: null,
        profile: {
          create: expect.objectContaining({
            studentNumber: '20240003',
            year: '2024',
          }),
        },
      }),
    }));
  });

  it('returns a controlled validation error when required headers are missing', async () => {
    const file = await buildWorkbookFile([
      ['邮箱', '班级'],
      ['zhangsan@example.com', '自动化2401'],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: '模板列名不匹配，请使用官方模板',
      missing: ['account', 'name', 'roleRaw'],
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it('reports duplicate matched accounts without mutating users', async () => {
    mocks.prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', profile: { id: 'profile-1' } },
      { id: 'user-2', profile: { id: 'profile-2' } },
    ]);
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240004', '赵六', '学生', 'zhaoliu@example.com', '自动化2401', '自动化', '2024', ''],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 0,
      updated: 0,
      failed: 1,
      errors: [{
        row: 2,
        account: '20240004',
        reason: '同一账号匹配到多个用户，请先清理重复数据',
      }],
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('reports invalid data rows without mutating users', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240002', '李四', '访客', 'lisi@example.com', '自动化2401', '自动化', '2024', ''],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 0,
      updated: 0,
      failed: 1,
      totalRows: 1,
      errors: [{
        row: 2,
        account: '20240002',
        reason: '角色无效：访客',
      }],
    });
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });

  it('returns a controlled validation error for malformed workbook content', async () => {
    const file = new File(['not a workbook'], 'users.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '无法解析 Excel 文件，请使用官方模板重新填写' });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});

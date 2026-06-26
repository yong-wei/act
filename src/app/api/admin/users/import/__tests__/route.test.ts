import { beforeEach, describe, expect, it, vi } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  hash: vi.fn(),
  initializeUserProgress: vi.fn(),
  txPrisma: {
    user: {
      create: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
    adminOperationLedger: {
      upsert: vi.fn(),
    },
    adminOperationArtifact: {
      upsert: vi.fn(),
    },
  },
  prisma: {
    $transaction: vi.fn(),
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      create: vi.fn(),
      update: vi.fn(),
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

function buildImportRequest(file: File, mode?: 'preview' | 'commit') {
  const formData = new FormData();
  formData.set('file', file);
  if (mode) {
    formData.set('mode', mode);
  }
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
    mocks.txPrisma.user.create.mockResolvedValue({
      id: 'student-user-1',
      profile: { id: 'profile-1' },
    });
    mocks.prisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.prisma.adminOperationArtifact.upsert.mockResolvedValue({});
    mocks.txPrisma.adminOperationLedger.upsert.mockResolvedValue({});
    mocks.txPrisma.adminOperationArtifact.upsert.mockResolvedValue({});
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.txPrisma));
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
      batchId: expect.stringMatching(/^admin-user-import-/),
      created: 1,
      updated: 0,
      failed: 0,
      skippedEmpty: 0,
      totalRows: 1,
      auditRecord: {
        actorId: 'admin-1',
        action: 'admin-users-import',
        batchId: expect.stringMatching(/^admin-user-import-/),
        outcome: 'completed',
        created: 1,
        updated: 0,
        failed: 0,
        rollbackAvailable: false,
        operationId: expect.stringMatching(/^admin-user-import:/),
        idempotencyKey: expect.stringMatching(/^admin-op:/),
        retentionPolicy: 'admin-import-failed-row-artifacts-7d',
        recordedAt: expect.any(String),
      },
      operationLedger: {
        operationId: expect.stringMatching(/^admin-user-import:/),
        actorId: 'admin-1',
        actorRole: 'ADMIN',
        sourceFileHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        idempotencyKey: expect.stringMatching(/^admin-op:/),
        rollback: {
          available: false,
        },
      },
    });
    expect(mocks.hash).toHaveBeenCalledWith('secret', 10);
    expect(mocks.txPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: '张三',
        email: 'zhangsan@example.com',
        passwordHash: 'hashed-password',
        role: 'STUDENT',
        profile: {
          create: expect.objectContaining({
            studentNumber: '20240001',
            className: '自动化2401',
          }),
        },
      }),
    }));
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(mocks.initializeUserProgress).toHaveBeenCalledWith('student-user-1', mocks.txPrisma);
    expect(mocks.prisma.$transaction).toHaveBeenCalled();
    expect(mocks.txPrisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: expect.stringMatching(/^admin-op:/) },
    }));
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
    expect(mocks.txPrisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
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

  it('updates existing users through the import transaction client', async () => {
    mocks.prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'existing-student-1', profile: { id: 'profile-1' } }])
      .mockResolvedValueOnce([{ id: 'existing-student-1' }]);
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240008', '更新学生', '学生', 'student08@example.com', '自动化2402', '自动化', '2024', 'new-secret'],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 0,
      updated: 1,
      failed: 0,
      auditRecord: {
        outcome: 'completed',
      },
    });
    expect(mocks.hash).toHaveBeenCalledWith('new-secret', 10);
    expect(mocks.txPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-student-1' },
      data: expect.objectContaining({
        name: '更新学生',
        email: 'student08@example.com',
        passwordHash: 'hashed-password',
        role: 'STUDENT',
      }),
    }));
    expect(mocks.txPrisma.studentProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'existing-student-1' },
      data: expect.objectContaining({
        studentNumber: '20240008',
        className: '自动化2402',
      }),
    }));
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfile.update).not.toHaveBeenCalled();
    expect(mocks.txPrisma.adminOperationLedger.upsert).toHaveBeenCalled();
  });

  it('previews a valid workbook without mutating users', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240005', '预览学生', '学生', 'preview@example.com', '自动化2401', '自动化', '2024', 'secret'],
    ]);

    const response = await POST(buildImportRequest(file, 'preview'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      mode: 'preview',
      preview: true,
      created: 1,
      updated: 0,
      failed: 0,
      auditRecord: {
        mode: 'preview',
        rollbackAvailable: false,
      },
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.initializeUserProgress).not.toHaveBeenCalled();
  });

  it('reports duplicate accounts inside the same preview batch before claiming created rows', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240006', '预览学生 A', '学生', 'preview-a@example.com', '自动化2401', '自动化', '2024', 'secret'],
      ['20240006', '预览学生 B', '学生', 'preview-b@example.com', '自动化2402', '自动化', '2024', 'secret'],
    ]);

    const response = await POST(buildImportRequest(file, 'preview'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      mode: 'preview',
      preview: true,
      created: 1,
      updated: 0,
      failed: 1,
      errors: [{
        row: 3,
        accountFingerprint: expect.any(String),
        reason: '同批次重复账号，已在第 2 行出现',
      }],
      failedRows: [{
        row: 3,
        accountFingerprint: expect.any(String),
        reason: '同批次重复账号，已在第 2 行出现',
      }],
      failedRowArtifact: {
        id: expect.stringMatching(/^admin-user-import-.*:failed-rows$/),
        downloadUrl: expect.stringContaining('/api/admin/operations/artifacts/'),
        piiMinimized: true,
        rowCount: 1,
        authorizedRoles: ['ADMIN'],
        revocable: true,
      },
    });
    expect(payload.errors[0].accountFingerprint).not.toBe('20240006');
    expect(JSON.stringify(payload)).not.toContain('"account":"20240006"');
    expect(payload.failedRows[0].accountFingerprint).not.toBe('20240006');
    expect(JSON.stringify(payload.failedRowArtifact)).not.toContain('20240006');
    expect(mocks.prisma.adminOperationArtifact.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { artifactId: payload.failedRowArtifact.id },
      create: expect.objectContaining({
        payload: {
          failedRows: payload.failedRows,
        },
      }),
    }));
    expect(mocks.prisma.user.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('keeps failed row artifact ids distinct for same-millisecond failed imports', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
    try {
      const firstFile = await buildWorkbookFile([
        ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
        ['20240012', '', '学生', 'first@example.com', '自动化2401', '自动化', '2024', 'secret'],
      ], 'first.xlsx');
      const secondFile = await buildWorkbookFile([
        ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
        ['20240013', '', '学生', 'second@example.com', '自动化2401', '自动化', '2024', 'secret'],
      ], 'second.xlsx');

      const firstResponse = await POST(buildImportRequest(firstFile));
      const firstPayload = await firstResponse.json();
      const secondResponse = await POST(buildImportRequest(secondFile));
      const secondPayload = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstPayload.batchId).toBe(secondPayload.batchId);
      expect(firstPayload.failedRowArtifact.id).toMatch(/^admin-user-import-.*:[a-f0-9]{12}:failed-rows$/);
      expect(secondPayload.failedRowArtifact.id).toMatch(/^admin-user-import-.*:[a-f0-9]{12}:failed-rows$/);
      expect(secondPayload.failedRowArtifact.id).not.toBe(firstPayload.failedRowArtifact.id);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('reports duplicate emails inside the same commit batch before transaction writes', async () => {
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240009', '学生 A', '学生', 'duplicate@example.com', '自动化2401', '自动化', '2024', 'secret'],
      ['20240010', '学生 B', '学生', 'duplicate@example.com', '自动化2402', '自动化', '2024', 'secret'],
    ]);

    const response = await POST(buildImportRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      created: 1,
      updated: 0,
      failed: 1,
      errors: [{
        row: 3,
        accountFingerprint: expect.any(String),
        reason: '同批次重复邮箱，已在第 2 行出现',
      }],
      auditRecord: {
        outcome: 'completed-with-errors',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('"account":"20240010"');
    expect(mocks.prisma.user.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.txPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mocks.txPrisma.adminOperationLedger.upsert).toHaveBeenCalled();
  });

  it('prevalidates email conflicts before opening the import write transaction', async () => {
    mocks.prisma.user.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'existing-email-user' }]);
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240007', '邮箱冲突', '学生', 'used@example.com', '自动化2401', '自动化', '2024', 'secret'],
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
        accountFingerprint: expect.any(String),
        reason: '邮箱已被其他用户使用',
      }],
      auditRecord: {
        outcome: 'completed-with-errors',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('"account":"20240007"');
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.txPrisma.user.create).not.toHaveBeenCalled();
    expect(mocks.txPrisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { idempotencyKey: expect.stringMatching(/^admin-op:/) },
    }));
  });

  it('records failed rows when transaction writes abort', async () => {
    mocks.txPrisma.user.create.mockRejectedValueOnce(
      new Error('Unique constraint failed: Key (email)=(write-fail@example.com), account=20240011, password=secret')
    );
    const file = await buildWorkbookFile([
      ['账号', '姓名', '角色', '邮箱', '班级', '专业', '年级', '初始密码'],
      ['20240011', '写入失败', '学生', 'write-fail@example.com', '自动化2401', '自动化', '2024', 'secret'],
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
        accountFingerprint: expect.any(String),
        reason: '导入写入失败，请检查该行账号、邮箱或学生档案是否与现有数据冲突',
      }],
      auditRecord: {
        outcome: 'completed-with-errors',
      },
    });
    expect(JSON.stringify(payload)).not.toContain('write-fail@example.com');
    expect(JSON.stringify(payload)).not.toContain('20240011');
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(mocks.txPrisma.user.create).toHaveBeenCalled();
    expect(mocks.txPrisma.adminOperationLedger.upsert).not.toHaveBeenCalled();
    expect(mocks.txPrisma.adminOperationArtifact.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.adminOperationLedger.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcome: 'completed-with-errors',
      }),
    }));
    expect(mocks.prisma.adminOperationArtifact.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        payload: {
          failedRows: payload.failedRows,
        },
      }),
    }));
    expect(JSON.stringify(mocks.prisma.adminOperationArtifact.upsert.mock.calls)).not.toContain('write-fail@example.com');
    expect(JSON.stringify(mocks.prisma.adminOperationArtifact.upsert.mock.calls)).not.toContain('20240011');
    expect(JSON.stringify(mocks.prisma.adminOperationArtifact.upsert.mock.calls)).not.toContain('secret');
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
      auditRecord: {
        outcome: 'completed-with-errors',
        rollbackAvailable: false,
      },
      errors: [{
        row: 2,
        accountFingerprint: expect.any(String),
        reason: '同一账号匹配到多个用户，请先清理重复数据',
      }],
    });
    expect(JSON.stringify(payload)).not.toContain('"account":"20240004"');
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
        accountFingerprint: expect.any(String),
        reason: '角色无效：访客',
      }],
    });
    expect(JSON.stringify(payload)).not.toContain('"account":"20240002"');
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  rethrowIfNextDynamicError: vi.fn(),
  prisma: {
    class: {
      findFirst: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: mocks.rethrowIfNextDynamicError,
}));

import { POST } from '../route';

type WorkbookCell = string | number | null;

async function buildWorkbookFile(rows: Array<Array<WorkbookCell>>, name = 'students.xlsx') {
  const buffer = await writeXlsxFile(rows, { sheet: '学生名单' }).toBuffer();
  return new File([buffer], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function buildImportRequest(file: File) {
  const formData = new FormData();
  formData.set('file', file);
  return new Request('http://localhost/api/teacher/classes/class-1/students/import', {
    method: 'POST',
    body: formData,
  });
}

const routeContext = { params: Promise.resolve({ classId: 'class-1' }) };

describe('POST /api/teacher/classes/[classId]/students/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findFirst.mockResolvedValue({
      id: 'class-1',
      name: '自动化2401',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      id: 'profile-1',
      classId: null,
      user: {
        id: 'student-1',
        name: '张三',
        role: 'STUDENT',
      },
    });
    mocks.prisma.studentProfile.update.mockResolvedValue({
      id: 'profile-1',
    });
  });

  it('imports students from a valid xlsx workbook', async () => {
    const file = await buildWorkbookFile([
      ['学号'],
      ['20240001'],
    ]);

    const response = await POST(buildImportRequest(file), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: ['20240001'],
      failed: [],
      summary: {
        total: 1,
        successCount: 1,
        failedCount: 0,
      },
    });
    expect(mocks.prisma.studentProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: {
        classId: 'class-1',
        className: '自动化2401',
      },
    });
  });

  it('rejects unsupported file extensions before parsing', async () => {
    const file = new File(['studentNumber\n20240001'], 'students.csv', {
      type: 'text/csv',
    });

    const response = await POST(buildImportRequest(file), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请上传Excel文件（.xlsx格式）' });
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it('rejects legacy .xls filenames before parsing', async () => {
    const file = await buildWorkbookFile([
      ['学号'],
      ['20240001'],
    ], 'students.xls');

    const response = await POST(buildImportRequest(file), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请上传Excel文件（.xlsx格式）' });
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it('returns a controlled validation error for malformed workbook content', async () => {
    const file = new File(['not a workbook'], 'students.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const response = await POST(buildImportRequest(file), routeContext);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'Excel文件无法解析或格式不正确' });
    expect(mocks.prisma.studentProfile.findFirst).not.toHaveBeenCalled();
  });
});

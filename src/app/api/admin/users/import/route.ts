import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { UserRole } from '@prisma/client';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { initializeUserProgress } from '@/lib/user-sync';

const HEADER_ALIASES = {
  studentNumber: ['学号', 'studentnumber', 'student number', 'student_id', '学生编号'],
  name: ['姓名', 'name', 'studentname', '学生姓名'],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    return NextResponse.json({ error: '未找到工作表' }, { status: 400 });
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  }) as Array<Array<string>>;

  if (rows.length < 2) {
    return NextResponse.json({ error: '模板内容为空' }, { status: 400 });
  }

  const headerRow = rows[0] ?? [];
  const headerIndex = (aliases: string[]) =>
    headerRow.findIndex((cell) =>
      aliases.includes(normalizeHeader(cell))
    );

  const studentIndex = headerIndex(HEADER_ALIASES.studentNumber);
  const nameIndex = headerIndex(HEADER_ALIASES.name);

  if (studentIndex === -1 || nameIndex === -1) {
    return NextResponse.json(
      { error: '模板列名不匹配，请使用官方模板' },
      { status: 400 }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const studentNumber = String(row[studentIndex] || '').trim();
    const name = String(row[nameIndex] || '').trim();

    if (!studentNumber || !name) {
      skipped += 1;
      continue;
    }

    const existing = await prisma.studentProfile.findFirst({
      where: { studentNumber },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      const passwordHash = await hash('123456', 10);
      const user = await prisma.user.create({
        data: {
          name,
          passwordHash,
          role: UserRole.STUDENT,
          profile: {
            create: {
              studentNumber,
              techScore: 0,
              ethicsScore: 100,
            },
          },
        },
      });

      await initializeUserProgress(user.id);
      created += 1;
    } catch (error) {
      errors.push({
        row: i + 1,
        reason: error instanceof Error ? error.message : '导入失败',
      });
    }
  }

  return NextResponse.json({
    created,
    skipped,
    errors,
  });
}

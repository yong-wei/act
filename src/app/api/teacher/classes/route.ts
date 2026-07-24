import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  TeacherDefaultClassServiceError,
  teacherDefaultClassService,
} from '@/lib/teacher-default-class-service';

export const dynamic = 'force-dynamic';

// 生成6位随机班级码
function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET: 获取教师的班级列表
export async function GET() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const [classes, teacher] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: session.user.id },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultTeachingClassId: true },
    }),
  ]);

  return NextResponse.json(classes.map((classItem) => ({
    ...classItem,
    isDefault: classItem.id === teacher?.defaultTeachingClassId,
  })));
}

// POST: 创建新班级
export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, year, semester } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }

    // 生成唯一的班级码
    let code = generateClassCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.class.findUnique({ where: { code } });
      if (!existing) break;
      code = generateClassCode();
      attempts++;
    }

    const newClass = await teacherDefaultClassService.createClass({
      teacherId: session.user.id,
      name: name.trim(),
      code,
      description: description?.trim() || null,
      year: year?.trim() || null,
      semester: semester?.trim() || null,
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = defaultClassServiceErrorResponse(error);
    if (response) return response;
    console.error('创建班级失败:', error);
    return NextResponse.json({ error: '创建班级失败' }, { status: 500 });
  }
}

export function defaultClassServiceErrorResponse(error: unknown) {
  if (!(error instanceof TeacherDefaultClassServiceError)) return null;
  if (error.code === 'class-not-found') {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
  if (error.code === 'class-not-active') {
    return NextResponse.json({ error: '班级未启用' }, { status: 409 });
  }
  if (error.code === 'class-has-sessions') {
    return NextResponse.json({ error: '已有课堂记录的班级不能删除，请改为停用。' }, { status: 409 });
  }
  if (error.code === 'transaction-conflict-retryable') {
    return NextResponse.json({ error: '班级状态正在更新，请稍后重试。' }, { status: 409 });
  }
  return NextResponse.json({ error: '班级教师不存在' }, { status: 404 });
}

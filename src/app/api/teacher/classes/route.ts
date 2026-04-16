import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

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

  const classes = await prisma.class.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: { select: { students: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(classes);
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

    const newClass = await prisma.class.create({
      data: {
        name: name.trim(),
        code,
        teacherId: session.user.id,
        description: description?.trim() || null,
        year: year?.trim() || null,
        semester: semester?.trim() || null,
      },
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('创建班级失败:', error);
    return NextResponse.json({ error: '创建班级失败' }, { status: 500 });
  }
}

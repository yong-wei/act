import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  teacherDefaultClassService,
} from '@/lib/teacher-default-class-service';
import { defaultClassServiceErrorResponse } from '../route';

export const dynamic = 'force-dynamic';

// GET: 获取班级详情
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const classData = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teacher: { select: { id: true, name: true } },
      students: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { students: true } },
    },
  });

  if (!classData) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }

  // 验证权限：只有班级教师可以查看详情
  if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  return NextResponse.json(classData);
}

// PATCH: 更新班级信息
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const classData = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classData) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }

  if (classData.teacherId !== session.user.id) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '班级信息无效' }, { status: 400 });
    }
    const { name, description, year, semester, isActive } = body as Record<string, unknown>;

    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json({ error: '班级状态无效' }, { status: 400 });
    }
    if (name !== undefined && typeof name !== 'string') {
      return NextResponse.json({ error: '班级名称无效' }, { status: 400 });
    }
    if (description !== undefined && description !== null && typeof description !== 'string') {
      return NextResponse.json({ error: '班级描述无效' }, { status: 400 });
    }
    if (year !== undefined && year !== null && typeof year !== 'string') {
      return NextResponse.json({ error: '学年无效' }, { status: 400 });
    }
    if (semester !== undefined && semester !== null && typeof semester !== 'string') {
      return NextResponse.json({ error: '学期无效' }, { status: 400 });
    }

    const update = {
      ...(typeof name === 'string' && name.trim() && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(year !== undefined && { year: year?.trim() || null }),
      ...(semester !== undefined && { semester: semester?.trim() || null }),
      ...(isActive !== undefined && { isActive }),
    };
    const updatedClass = Object.keys(update).length === 0
      ? classData
      : await teacherDefaultClassService.updateClass(session.user.id, classId, update);

    return NextResponse.json(updatedClass);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = defaultClassServiceErrorResponse(error);
    if (response) return response;
    console.error('更新班级失败:', error);
    return NextResponse.json({ error: '更新班级失败' }, { status: 500 });
  }
}

// DELETE: 删除班级
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const classData = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!classData) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }

  if (classData.teacherId !== session.user.id) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    await teacherDefaultClassService.deleteClass(session.user.id, classId);

    return NextResponse.json({ success: true });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const response = defaultClassServiceErrorResponse(error);
    if (response) return response;
    console.error('删除班级失败:', error);
    return NextResponse.json({ error: '删除班级失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const body = await request.json();
    const { name, description, year, semester, isActive } = body;

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(year !== undefined && { year: year?.trim() || null }),
        ...(semester !== undefined && { semester: semester?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(updatedClass);
  } catch (error) {
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
    // 先移除学生的班级关联
    await prisma.studentProfile.updateMany({
      where: { classId },
      data: { classId: null },
    });

    // 删除班级
    await prisma.class.delete({
      where: { id: classId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除班级失败:', error);
    return NextResponse.json({ error: '删除班级失败' }, { status: 500 });
  }
}

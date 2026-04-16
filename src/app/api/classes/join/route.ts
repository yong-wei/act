import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: 学生通过班级码加入班级
export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: '只有学生可以加入班级' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: '班级码不能为空' }, { status: 400 });
    }

    // 查找班级
    const classData = await prisma.class.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        teacher: { select: { name: true } },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级码无效' }, { status: 404 });
    }

    if (!classData.isActive) {
      return NextResponse.json({ error: '该班级已关闭' }, { status: 400 });
    }

    // 检查学生是否已有档案
    let profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      // 创建档案
      profile = await prisma.studentProfile.create({
        data: {
          userId: session.user.id,
          classId: classData.id,
          className: classData.name,
        },
      });
    } else {
      // 更新档案
      profile = await prisma.studentProfile.update({
        where: { userId: session.user.id },
        data: {
          classId: classData.id,
          className: classData.name,
        },
      });
    }

    return NextResponse.json({
      success: true,
      class: {
        id: classData.id,
        name: classData.name,
        teacherName: classData.teacher.name,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('加入班级失败:', error);
    return NextResponse.json({ error: '加入班级失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

/**
 * 班级学生管理 API
 *
 * POST /api/teacher/classes/[classId]/students - 添加学生到班级
 * DELETE /api/teacher/classes/[classId]/students - 从班级移除学生
 */

// 添加学生到班级
export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: '请提供学生ID' }, { status: 400 });
    }

    // 验证班级属于当前教师
    const classInfo = await prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: session.user.id,
      },
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在或无权限' }, { status: 404 });
    }

    // 验证用户存在且是学生
    const student = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'STUDENT',
      },
      include: {
        profile: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: '学生不存在' }, { status: 404 });
    }

    // 检查学生是否已在该班级
    if (student.profile?.classId === classId) {
      return NextResponse.json({ error: '该学生已在此班级中' }, { status: 400 });
    }

    // 更新学生的班级信息
    await prisma.studentProfile.upsert({
      where: { userId },
      update: {
        classId,
        className: classInfo.name,
      },
      create: {
        userId,
        classId,
        className: classInfo.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `已将 ${student.name} 添加到班级`,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error adding student to class:', error);
    return NextResponse.json({ error: '添加失败' }, { status: 500 });
  }
}

// 从班级移除学生
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '请提供学生ID' }, { status: 400 });
    }

    // 验证班级属于当前教师
    const classInfo = await prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: session.user.id,
      },
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在或无权限' }, { status: 404 });
    }

    // 验证学生在该班级中
    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        userId,
        classId,
      },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: '该学生不在此班级中' }, { status: 400 });
    }

    // 移除学生的班级关联
    await prisma.studentProfile.update({
      where: { userId },
      data: {
        classId: null,
        className: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `已将 ${studentProfile.user.name} 从班级移除`,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error removing student from class:', error);
    return NextResponse.json({ error: '移除失败' }, { status: 500 });
  }
}

// 获取班级学生列表
export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;

    // 验证班级属于当前教师
    const classInfo = await prisma.class.findFirst({
      where: {
        id: classId,
        teacherId: session.user.id,
      },
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在或无权限' }, { status: 404 });
    }

    // 获取班级所有学生
    const students = await prisma.studentProfile.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { studentNumber: 'asc' },
    });

    const formattedStudents = students.map(s => ({
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      studentNumber: s.studentNumber,
      techScore: s.techScore || 0,
      ethicsScore: s.ethicsScore || 100,
    }));

    return NextResponse.json(formattedStudents);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error getting class students:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

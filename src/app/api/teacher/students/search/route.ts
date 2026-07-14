import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

/**
 * 搜索学生
 * GET /api/teacher/students/search?q=keyword&excludeClassId=xxx
 *
 * 按姓名、账号、学号搜索学生；无关键词时返回可添加候选学生
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const excludeClassId = searchParams.get('excludeClassId');

    if (!excludeClassId) {
      return NextResponse.json({ error: '请提供班级ID' }, { status: 400 });
    }

    const classInfo = await prisma.class.findFirst({
      where: {
        id: excludeClassId,
        ...(session.user.role === 'TEACHER' ? { teacherId: session.user.id } : {})
      },
      select: { id: true }
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在或无权限' }, { status: 404 });
    }

    if (query && query.length < 2) {
      return NextResponse.json({ error: '搜索关键词至少2个字符' }, { status: 400 });
    }

    const andConditions: Prisma.UserWhereInput[] = [];

    if (query) {
      andConditions.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          {
            profile: {
              is: {
                studentNumber: { contains: query, mode: 'insensitive' }
              }
            }
          }
        ]
      });
    }

    if (excludeClassId) {
      andConditions.push({
        OR: [
          { profile: { is: null } },
          { profile: { is: { classId: null } } },
          {
            profile: {
              is: {
                classId: { not: excludeClassId }
              }
            }
          }
        ]
      });
    }

    const whereCondition: Prisma.UserWhereInput = {
      role: 'STUDENT',
      ...(andConditions.length > 0 ? { AND: andConditions } : {})
    };

    const students = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        email: true,
        profile: {
          select: {
            id: true,
            studentNumber: true,
            classId: true,
            className: true,
            techScore: true,
            ethicsScore: true
          }
        }
      },
      take: 20,
      orderBy: { name: 'asc' }
    });

    // 格式化返回数据
    const formattedStudents = students.map(s => ({
      id: s.id,
      name: s.name,
      email: s.email,
      studentNumber: s.profile?.studentNumber,
      currentClassId: s.profile?.classId,
      currentClassName: s.profile?.className,
      techScore: s.profile?.techScore || 0,
      ethicsScore: s.profile?.ethicsScore || 100
    }));

    return NextResponse.json(formattedStudents);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error searching students:', error);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildClassroomSessionStatistics } from '@/lib/classroom-session-statistics';
import { resolveClassAttribution } from '@/lib/data-governance/class-attribution';
import { Prisma, SessionStatus } from '@prisma/client';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

/**
 * 获取班级的课堂历史
 * GET /api/teacher/classes/[classId]/sessions
 *
 * Query params:
 * - status: 筛选状态 (ACTIVE | FINISHED)
 * - startDate: 开始日期
 * - endDate: 结束日期
 * - search: 搜索教案标题
 */
export async function GET(request: Request, props: { params: Promise<{ classId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId } = params;

    // 验证班级存在且属于当前教师
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true }
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权访问此班级' }, { status: 403 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    // 构建查询条件
    const where: Prisma.ClassSessionWhereInput = {
      teacherId: classData.teacherId,
      classId,
    };

    if (status && Object.values(SessionStatus).includes(status as SessionStatus)) {
      where.status = status as SessionStatus;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        // 设置为当天结束
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.startTime.lte = end;
      }
    }

    if (search) {
      where.plan = {
        title: {
          contains: search,
          mode: 'insensitive'
        }
      };
    }

    const sessions = await prisma.classSession.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            title: true
          }
        },
        _count: {
          select: {
            studentStates: true
          }
        },
        classSessionReports: {
          where: {
            reportType: 'class-summary',
          },
          select: {
            reportData: true,
          },
          take: 1,
        },
      },
      orderBy: {
        startTime: 'desc'
      }
    });

    // 格式化返回数据
    const formattedSessions = sessions
      .map((s) => {
        const classAttribution = resolveClassAttribution({
          sessionClassId: s.classId,
        });
        const statistics = buildClassroomSessionStatistics({
          startTime: s.startTime,
          endTime: s.endTime,
          studentStateCount: s._count.studentStates,
          reportData: s.classSessionReports?.[0]?.reportData,
        });

        return {
          id: s.id,
          joinCode: s.joinCode,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          currentStage: s.currentStage,
          plan: s.plan,
          studentCount: statistics.studentCount,
          sessionStatistics: statistics,
          classAttribution,
          durationMinutes: statistics.durationMinutes,
        };
      })
      .filter((s) => s.classAttribution.classId === classId);

    return NextResponse.json(formattedSessions);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching class sessions:', error);
    return NextResponse.json({ error: '获取课堂历史失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { SessionStatus } from '@prisma/client';

import { getServerAuthSession } from '@/lib/auth';
import { buildClassroomSessionStatistics } from '@/lib/classroom-session-statistics';
import { resolveClassAttribution } from '@/lib/data-governance/class-attribution';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() ?? '';
    const classId = searchParams.get('classId')?.trim() ?? '';
    const statusParam = searchParams.get('status')?.trim() ?? '';
    const status =
      statusParam && Object.values(SessionStatus).includes(statusParam as SessionStatus)
        ? (statusParam as SessionStatus)
        : SessionStatus.FINISHED;

    const sessions = await prisma.classSession.findMany({
      where: {
        teacherId: session.user.id,
        status,
        ...(classId
          ? {
              OR: [
                { classId },
                {
                  classId: null,
                  studentStates: {
                    some: {
                      user: {
                        profile: { classId },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(search
          ? {
              plan: {
                title: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            }
          : {}),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        plan: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            studentStates: true,
          },
        },
        studentStates: {
          select: {
            user: {
              select: {
                profile: {
                  select: {
                    classId: true,
                  },
                },
              },
            },
          },
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
        startTime: 'desc',
      },
    });

    const attributionsBySessionId = new Map(
      sessions.map((item) => [
        item.id,
        resolveClassAttribution({
          sessionClassId: item.classId,
          participantClassIds: item.studentStates.map((state) => state.user.profile?.classId),
        }),
      ])
    );
    const inferredClassIds = Array.from(
      new Set(
        Array.from(attributionsBySessionId.values())
          .map((attribution) => attribution.classId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );
    const classes = inferredClassIds.length
      ? await prisma.class.findMany({
          where: {
            id: { in: inferredClassIds },
            ...(session.user.role === 'ADMIN' ? {} : { teacherId: session.user.id }),
          },
          select: {
            id: true,
            name: true,
          },
        })
      : [];
    const classNameById = new Map(classes.map((item) => [item.id, item.name]));

    return NextResponse.json(
      sessions
        .map((item) => {
          const classAttribution = attributionsBySessionId.get(item.id) ?? resolveClassAttribution({
            sessionClassId: item.classId,
            participantClassIds: [],
          });
          const statistics = buildClassroomSessionStatistics({
            startTime: item.startTime,
            endTime: item.endTime,
            studentStateCount: item._count.studentStates,
            reportData: item.classSessionReports?.[0]?.reportData,
          });

          return {
            id: item.id,
            joinCode: item.joinCode,
            status: item.status,
            startTime: item.startTime,
            endTime: item.endTime,
            currentStage: item.currentStage,
            classId: classAttribution.classId,
            className: classAttribution.classId
              ? item.class?.name ?? classNameById.get(classAttribution.classId) ?? null
              : null,
            classAttribution,
            plan: item.plan,
            studentCount: statistics.studentCount,
            sessionStatistics: statistics,
            durationMinutes: statistics.durationMinutes,
          };
        })
        .filter((item) => !classId || item.classAttribution.classId === classId)
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherSessions][GET] Error:', error);
    return NextResponse.json({ error: '获取课堂历史失败' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少课堂 ID' }, { status: 400 });
    }

    const target = await prisma.classSession.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        status: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: '课堂不存在' }, { status: 404 });
    }

    if (target.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权修改该课堂' }, { status: 403 });
    }

    if (target.status !== SessionStatus.FINISHED) {
      return NextResponse.json({ error: '仅可归档已结束课堂' }, { status: 400 });
    }

    const body = await request.json();
    const rawClassId = typeof body?.classId === 'string' ? body.classId.trim() : '';
    const classId = rawClassId || null;

    if (classId) {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        select: {
          id: true,
          teacherId: true,
        },
      });

      if (!classData) {
        return NextResponse.json({ error: '班级不存在' }, { status: 404 });
      }

      if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: '无权归档到该班级' }, { status: 403 });
      }
    }

    const updated = await prisma.classSession.update({
      where: { id },
      data: { classId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      classId: updated.classId,
      className: updated.class?.name ?? null,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherSessions][PATCH] Error:', error);
    return NextResponse.json({ error: '更新课堂归档失败' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少课堂 ID' }, { status: 400 });
    }

    const target = await prisma.classSession.findUnique({
      where: { id },
      select: {
        id: true,
        teacherId: true,
        status: true,
      },
    });

    if (!target) {
      return NextResponse.json({ error: '课堂不存在' }, { status: 404 });
    }

    if (target.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权删除该课堂' }, { status: 403 });
    }

    if (target.status !== SessionStatus.FINISHED) {
      return NextResponse.json({ error: '仅可删除已结束课堂' }, { status: 400 });
    }

    await prisma.classSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherSessions][DELETE] Error:', error);
    return NextResponse.json({ error: '删除课堂失败' }, { status: 500 });
  }
}

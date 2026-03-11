import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildSessionParticipantHref, resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { logClassroomEvent } from '@/lib/classroom-observability';

/**
 * 根据入会码查找课堂会话
 * GET /api/session/join?code=123456
 *
 * 仅限该课堂所属班级的学生加入
 */
export async function GET(request: Request) {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const joinCode = searchParams.get('code');

    if (!joinCode || !/^\d{6}$/.test(joinCode)) {
      return NextResponse.json(
        { error: '请输入有效的6位入会码' },
        { status: 400 }
      );
    }

    const classSession = await prisma.classSession.findUnique({
      where: { joinCode },
      select: {
        id: true,
        joinCode: true,
        status: true,
        currentStage: true,
        currentItemId: true,
        classId: true,
        plan: {
          select: {
            id: true,
            title: true,
          },
        },
        teacher: {
          select: {
            name: true,
          },
        },
        class: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!classSession) {
      return NextResponse.json(
        { error: '未找到该入会码对应的课堂' },
        { status: 404 }
      );
    }

    if (classSession.status === 'FINISHED') {
      return NextResponse.json(
        { error: '该课堂已结束' },
        { status: 410 }
      );
    }

    // 如果课堂关联了班级，验证学生是否属于该班级
    if (classSession.classId) {
      // 教师和管理员可以直接进入
      if (userSession.user.role === 'TEACHER' || userSession.user.role === 'ADMIN') {
        return NextResponse.json(classSession);
      }

      // 学生必须属于该班级
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: userSession.user.id },
        select: { classId: true }
      });

      if (!studentProfile || studentProfile.classId !== classSession.classId) {
        return NextResponse.json(
          {
            error: '您不是该班级的学生，无法加入此课堂',
            className: classSession.class?.name
          },
          { status: 403 }
        );
      }
    }

    const routeInfo = resolveSessionRouteFromPlanTitle(classSession.plan.title);

    const response = {
      ...classSession,
      routeSegment: routeInfo.routeSegment,
      studentHref: buildSessionParticipantHref({
        role: 'student',
        sessionId: classSession.id,
        planTitle: classSession.plan.title,
      }),
      teacherHref: buildSessionParticipantHref({
        role: 'teacher',
        sessionId: classSession.id,
        planTitle: classSession.plan.title,
      }),
    };

    logClassroomEvent('session_join_lookup', {
      sessionId: classSession.id,
      userId: userSession.user.id,
      role: userSession.user.role,
      joinCode,
      routeSegment: routeInfo.routeSegment,
      classId: classSession.classId,
      planTitle: classSession.plan.title,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error finding session by join code:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

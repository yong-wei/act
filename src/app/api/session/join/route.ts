import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildSessionParticipantHref, resolveSessionRouteSegment } from '@/lib/classroom-session-route';
import { logClassroomEvent } from '@/lib/classroom-observability';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

type ClassroomJoinState =
  | 'invalid-code'
  | 'not-found'
  | 'finished'
  | 'forbidden'
  | 'ready-to-enter';

function buildJoinState(state: ClassroomJoinState, recoveryAction: string) {
  return {
    state,
    recoveryAction,
    evidenceWriteback:
      state === 'ready-to-enter'
        ? '课堂状态由 session state 保存；课堂提交由互动事件入口写入提交记录，并按会话、步骤、卡片和提交身份做应用层串行去重，重复提交不保留 raw InteractionLog，结束后进入教师复盘和学生证据页。数据库级并发幂等仍未关闭。'
        : '未进入课堂时不会写入课堂作答证据。',
  };
}

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
        {
          error: '请输入有效的6位入会码',
          joinState: buildJoinState('invalid-code', '请核对教师投屏或二维码中的 6 位数字课堂码。'),
        },
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
        courseBundleRevisionId: true,
        courseBundleRevision: {
          select: {
            canonicalLessonId: true,
          },
        },
      },
    });

    if (!classSession) {
      return NextResponse.json(
        {
          error: '未找到该入会码对应的课堂',
          joinState: buildJoinState('not-found', '请确认课堂码仍在当前课堂中使用，或返回学习首页等待教师重新发放。'),
        },
        { status: 404 }
      );
    }

    if (classSession.status === 'FINISHED') {
      return NextResponse.json(
        {
          error: '该课堂已结束',
          joinState: buildJoinState('finished', '请进入个人证据页查看本次课堂记录，或加入新的课堂。'),
          reviewHref: '/profile/evidence',
        },
        { status: 410 }
      );
    }

    // 如果课堂关联了班级，验证学生是否属于该班级
    if (classSession.classId) {
      // 教师和管理员可以直接进入
      if (userSession.user.role === 'TEACHER' || userSession.user.role === 'ADMIN') {
        return NextResponse.json({
          ...classSession,
          joinState: buildJoinState('ready-to-enter', '教师或管理员可直接进入课堂或复盘入口。'),
        });
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
            className: classSession.class?.name,
            joinState: buildJoinState('forbidden', '请确认当前登录账号属于该班级，或联系教师更新班级绑定。'),
          },
          { status: 403 }
        );
      }
    }

    const routeInfo = resolveSessionRouteSegment({
      bundleCanonicalLessonId: classSession.courseBundleRevision?.canonicalLessonId ?? null,
      bundleBound: classSession.courseBundleRevisionId !== null,
      planTitle: classSession.plan.title,
    });

    const response = {
      ...classSession,
      joinState: buildJoinState('ready-to-enter', '可进入课堂；提交后会在课堂状态、教师复盘和学生证据页中串联。'),
      routeSegment: routeInfo.routeSegment,
      studentHref: buildSessionParticipantHref({
        role: 'student',
        sessionId: classSession.id,
        planTitle: classSession.plan.title,
        bundleCanonicalLessonId: classSession.courseBundleRevision?.canonicalLessonId ?? null,
        bundleBound: classSession.courseBundleRevisionId !== null,
      }),
      teacherHref: buildSessionParticipantHref({
        role: 'teacher',
        sessionId: classSession.id,
        planTitle: classSession.plan.title,
        bundleCanonicalLessonId: classSession.courseBundleRevision?.canonicalLessonId ?? null,
        bundleBound: classSession.courseBundleRevisionId !== null,
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
    rethrowIfNextDynamicError(error);
    console.error('Error finding session by join code:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

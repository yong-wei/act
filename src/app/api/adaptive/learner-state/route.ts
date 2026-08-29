import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  isAdaptiveLearnerStateServiceEnabled,
  readLearnerState,
  type AdaptiveLearnerStateRole,
} from '@/features/personalization/learner-state/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!isAdaptiveLearnerStateServiceEnabled()) {
      return NextResponse.json(
        {
          error: 'LEARNER_STATE_SERVICE_DISABLED',
          fallback: 'legacy-profile-summary-and-recommendation-consumers',
        },
        { status: 503 },
      );
    }

    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId') || session.user.id;
    const classId = url.searchParams.get('classId');
    const goal = normalizeGoal(url.searchParams.get('goal'));
    const role = normalizeRole(session.user.role);

    if (role === 'student' && requestedUserId !== session.user.id) {
      return NextResponse.json({ error: '无权查看该学习状态' }, { status: 403 });
    }

    if (role === 'teacher' && requestedUserId !== session.user.id) {
      const scope = await verifyTeacherStudentScope({
        teacherId: session.user.id,
        studentId: requestedUserId,
        classId,
      });
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const learnerState = await readLearnerState({
      userId: requestedUserId,
      role,
      classId,
      goal,
    });

    return NextResponse.json(learnerState);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[AdaptiveLearnerState] Error:', error);
    return NextResponse.json({ error: '获取学习状态失败' }, { status: 500 });
  }
}

function normalizeRole(role: string | undefined): AdaptiveLearnerStateRole {
  if (role === 'ADMIN') return 'admin';
  if (role === 'TEACHER') return 'teacher';
  return 'student';
}

function normalizeGoal(goal: string | null): string | null {
  return typeof goal === 'string' && goal.trim().length > 0 ? goal.trim() : null;
}

async function verifyTeacherStudentScope(input: {
  teacherId: string;
  studentId: string;
  classId: string | null;
}): Promise<{ ok: true } | { ok: false; status: 400 | 403 | 404; error: string }> {
  if (!input.classId) {
    return {
      ok: false,
      status: 400,
      error: '教师读取学习状态必须提供 classId',
    };
  }

  const classData = await prisma.class.findUnique({
    where: { id: input.classId },
    select: { id: true, teacherId: true },
  });

  if (!classData) {
    return {
      ok: false,
      status: 404,
      error: '班级不存在',
    };
  }

  if (classData.teacherId !== input.teacherId) {
    return {
      ok: false,
      status: 403,
      error: '无权查看该班级学习状态',
    };
  }

  const studentProfile = await prisma.studentProfile.findFirst({
    where: {
      userId: input.studentId,
      classId: input.classId,
    },
    select: {
      userId: true,
      classId: true,
    },
  });

  if (!studentProfile) {
    return {
      ok: false,
      status: 404,
      error: '学生不在该班级中',
    };
  }

  return { ok: true };
}

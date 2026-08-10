import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { requestCumulativeLearnerReconciliation } from '@/lib/data-governance/cumulative-snapshot-jobs';

export const dynamic = 'force-dynamic';

type ClassJoinState =
  | 'invalid-code'
  | 'not-found'
  | 'inactive'
  | 'forbidden'
  | 'ready-to-enter';

function buildClassJoinState(state: ClassJoinState, recoveryAction: string) {
  return {
    state,
    recoveryAction,
    evidenceWriteback:
      state === 'ready-to-enter'
        ? '班级绑定会更新学生档案，后续课堂、学习路径和证据页按班级身份串联。'
        : '未完成班级绑定时不会写入班级学习证据。',
  };
}

// POST: 学生通过班级码加入班级
export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json(
      {
        error: '未登录',
        classJoinState: buildClassJoinState('forbidden', '登录学生账号后重新输入班级加入码。'),
      },
      { status: 401 },
    );
  }

  if (session.user.role !== 'STUDENT') {
    return NextResponse.json(
      {
        error: '只有学生可以加入班级',
        classJoinState: buildClassJoinState('forbidden', '切换学生账号后重新输入班级加入码。'),
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { code } = body;
    const normalizedCode = typeof code === 'string' ? code.toUpperCase().trim() : '';

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        {
          error: '请输入有效的6位班级加入码',
          classJoinState: buildClassJoinState('invalid-code', '请核对教师提供的 6 位班级加入码后重试。'),
        },
        { status: 400 },
      );
    }

    // 查找班级
    const classData = await prisma.class.findUnique({
      where: { code: normalizedCode },
      include: {
        teacher: { select: { name: true } },
      },
    });

    if (!classData) {
      return NextResponse.json(
        {
          error: '班级码无效',
          classJoinState: buildClassJoinState('not-found', '确认班级加入码仍在使用，或联系教师重新发放。'),
        },
        { status: 404 },
      );
    }

    if (!classData.isActive) {
      return NextResponse.json(
        {
          error: '该班级已关闭',
          classJoinState: buildClassJoinState('inactive', '联系教师确认班级是否重新开放或加入新的班级。'),
        },
        { status: 410 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      const previousClassId = profile?.classId ?? null;

      if (!profile) {
        await tx.studentProfile.create({
          data: {
            userId: session.user.id,
            classId: classData.id,
            className: classData.name,
          },
        });
      } else {
        await tx.studentProfile.update({
          where: { userId: session.user.id },
          data: {
            classId: classData.id,
            className: classData.name,
          },
        });
      }

      await requestCumulativeLearnerReconciliation(tx, {
        userId: session.user.id,
        classIds: [previousClassId, classData.id].filter(
          (classId): classId is string => classId !== null,
        ),
        reason: 'class-membership:student-join',
      });
    });

    return NextResponse.json({
      success: true,
      class: {
        id: classData.id,
        name: classData.name,
        teacherName: classData.teacher.name,
      },
      classJoinState: buildClassJoinState('ready-to-enter', '班级绑定已完成，可返回学习首页继续学习。'),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('加入班级失败:', error);
    return NextResponse.json({ error: '加入班级失败' }, { status: 500 });
  }
}

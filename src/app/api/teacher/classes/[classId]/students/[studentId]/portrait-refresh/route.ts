import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  readCumulativeLearnerReconciliationStatus,
  requestCumulativeLearnerReconciliation,
} from '@/lib/data-governance/cumulative-snapshot-jobs';
import {
  hasOnlyEmptyJsonPayload,
  resolveTeacherStudentPortraitAccess,
} from '@/lib/data-governance/portrait-reconciliation-access';
import { readSimulationTaskInputIdentityForScheduling } from '@/lib/data-governance/simulation-task-reconciliation';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function authorize(classId: string, studentId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: '未登录' }, { status: 401 }) } as const;
  }
  const access = await resolveTeacherStudentPortraitAccess(prisma, {
    actorId: session.user.id,
    actorRole: session.user.role,
    classId,
    studentId,
  });
  if (!access.ok) {
    return {
      response: NextResponse.json({ error: access.error }, { status: access.status }),
    } as const;
  }
  return { access } as const;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> },
) {
  try {
    const { classId, studentId } = await params;
    const authorization = await authorize(classId, studentId);
    if ('response' in authorization) return authorization.response;
    if (!await hasOnlyEmptyJsonPayload(request)) {
      return NextResponse.json({ error: '更新画像不接受业务参数' }, { status: 400 });
    }
    const generation = await prisma.$transaction(async (tx) => {
      const simulationTaskInput = await readSimulationTaskInputIdentityForScheduling(tx as never, {
        userId: studentId,
      });
      return requestCumulativeLearnerReconciliation(tx, {
        userId: studentId,
        classIds: [classId],
        reason: 'teacher-requested-student-portrait-refresh',
        simulationTaskInput,
      });
    });
    return NextResponse.json({ generation, status: 'submitted' }, { status: 202 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherStudentPortraitRefresh] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> },
) {
  try {
    const { classId, studentId } = await params;
    const authorization = await authorize(classId, studentId);
    if ('response' in authorization) return authorization.response;
    const generation = Number(new URL(request.url).searchParams.get('generation'));
    if (!Number.isInteger(generation) || generation < 1) {
      return NextResponse.json({ error: 'generation 无效' }, { status: 400 });
    }
    return NextResponse.json(await readCumulativeLearnerReconciliationStatus(prisma, {
      userId: studentId,
      generation,
    }));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherStudentPortraitRefreshStatus] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

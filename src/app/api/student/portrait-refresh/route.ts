import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  readCumulativeLearnerReconciliationStatus,
  requestCumulativeLearnerReconciliation,
} from '@/lib/data-governance/cumulative-snapshot-jobs';
import { hasOnlyEmptyJsonPayload } from '@/lib/data-governance/portrait-reconciliation-access';
import { readSimulationTaskInputIdentityForScheduling } from '@/lib/data-governance/simulation-task-reconciliation';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    if (!await hasOnlyEmptyJsonPayload(request)) {
      return NextResponse.json({ error: '更新画像不接受业务参数' }, { status: 400 });
    }
    const generation = await prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { classId: true },
      });
      const simulationTaskInput = await readSimulationTaskInputIdentityForScheduling(tx as never, {
        userId: session.user.id,
      });
      return requestCumulativeLearnerReconciliation(tx, {
        userId: session.user.id,
        classIds: profile?.classId ? [profile.classId] : [],
        reason: 'student-requested-portrait-refresh',
        simulationTaskInput,
      });
    });
    return NextResponse.json({ generation, status: 'submitted' }, { status: 202 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[StudentPortraitRefresh] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    const generation = Number(new URL(request.url).searchParams.get('generation'));
    if (!Number.isInteger(generation) || generation < 1) {
      return NextResponse.json({ error: 'generation 无效' }, { status: 400 });
    }
    return NextResponse.json(await readCumulativeLearnerReconciliationStatus(prisma, {
      userId: session.user.id,
      generation,
    }));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[StudentPortraitRefreshStatus] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

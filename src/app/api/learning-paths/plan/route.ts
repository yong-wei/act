import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ControlCorrectionPathRoundConflictError,
  ControlCorrectionPathRoundValidationError,
  persistControlCorrectionPathRound,
} from '@/lib/control-correction-path-rounds';
import {
  assertPathRoundIdAvailable,
  ensureControlCorrectionPathRoutesEnabled,
  getLearningPathRequester,
  resolvePathRoundClassScope,
} from '../route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const featureDisabled = ensureControlCorrectionPathRoutesEnabled();
    if (featureDisabled) return featureDisabled;

    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;

    const body = await request.json();
    const plan = body.plan;
    if (!plan || typeof plan !== 'object' || plan.goal?.id !== 'control-correction') {
      return NextResponse.json({ error: '仅支持 control-correction 学习路径计划' }, { status: 400 });
    }
    if (typeof plan.userId !== 'string' || plan.userId.length === 0) {
      return NextResponse.json({ error: '学习路径计划缺少学生用户' }, { status: 400 });
    }
    if (typeof plan.id !== 'string' || plan.id.length === 0) {
      return NextResponse.json({ error: '学习路径计划缺少路径 id' }, { status: 400 });
    }
    if (requester.role === 'student') {
      return NextResponse.json({ error: '学生端不能直接提交持久化学习路径计划' }, { status: 403 });
    }
    const classId = await resolvePathRoundClassScope(requester, {
      studentUserId: plan.userId,
      requestedClassId: body.classId ?? null,
    });
    if (classId instanceof NextResponse) return classId;
    const idConflict = await assertPathRoundIdAvailable({
      pathId: plan.id,
      studentUserId: plan.userId,
    });
    if (idConflict) return idConflict;

    const path = await persistControlCorrectionPathRound(prisma as any, {
      plan,
      learnerStateRef: body.learnerStateRef ?? null,
      inputSnapshot: body.inputSnapshot ?? null,
      classId,
    });

    return NextResponse.json({ path });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ControlCorrectionPathRoundConflictError) {
      return NextResponse.json({ error: '学习路径 id 已被其他路径占用' }, { status: 409 });
    }
    if (error instanceof ControlCorrectionPathRoundValidationError) {
      return NextResponse.json({ error: '学习路径计划未通过服务端持久化校验' }, { status: 400 });
    }
    console.error('[LearningPathPlan] Error:', error);
    return NextResponse.json({ error: '创建学习路径失败' }, { status: 500 });
  }
}

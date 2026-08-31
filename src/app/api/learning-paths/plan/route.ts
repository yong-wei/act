import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  ControlCorrectionPathRoundConflictError,
  ControlCorrectionPathRoundValidationError,
  persistLearningPathRound,
  persistControlCorrectionPathRound,
} from '@/lib/control-correction-path-rounds';
import { isRegisteredAdaptiveLearningPathGoal } from '@/features/personalization/path-planning/public-api';
import {
  assertPathRoundIdAvailable,
  ensureControlCorrectionPathRoutesEnabled,
  getLearningPathRequester,
  learningPathMutationBlockedResponse,
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
    if (!plan || typeof plan !== 'object' || typeof plan.goal?.id !== 'string') {
      return NextResponse.json({ error: '学习路径计划缺少已注册学习目标' }, { status: 400 });
    }
    if (!isRegisteredAdaptiveLearningPathGoal(plan.goal.id)) {
      return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
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
      goalId: plan.goal.id,
    });
    if (idConflict) return idConflict;

    const persist = plan.goal.id === 'control-correction'
      ? persistControlCorrectionPathRound
      : persistLearningPathRound;
    const path = await persist(prisma as any, {
      plan,
      learnerStateRef: body.learnerStateRef ?? null,
      inputSnapshot: body.inputSnapshot ?? null,
      classId,
    });

    return NextResponse.json({ path });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const blocked = learningPathMutationBlockedResponse(error);
    if (blocked) return blocked;
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

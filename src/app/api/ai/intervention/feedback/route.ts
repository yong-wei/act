import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  KonlingRuntimeScopeError,
  recordKonlingInterventionFeedback,
  verifyKonlingRuntimeScope,
  type KonlingInterventionFeedback,
} from '@/lib/konling-agent-runtime';

export const dynamic = 'force-dynamic';

interface FeedbackRequest {
  userId?: string;
  classId?: string;
  courseId?: string;
  pageId?: string;
  resourceId?: string;
  pathNodeId?: string;
  interventionId: string;
  feedback?: KonlingInterventionFeedback;
  wasHelpful?: boolean;
  studentResponse?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = (await request.json()) as FeedbackRequest;
    if (!body.interventionId) {
      return NextResponse.json({ error: '缺少 interventionId' }, { status: 400 });
    }

    const scope = await verifyKonlingRuntimeScope(prisma, {
      authenticatedUserId: session.user.id,
      role: session.user.role,
      targetUserId: body.userId || session.user.id,
      classId: body.classId,
      courseId: body.courseId,
      pageId: body.pageId,
      resourceId: body.resourceId,
      pathNodeId: body.pathNodeId,
    });
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const result = await recordKonlingInterventionFeedback(prisma, {
      scope: scope.scope,
      interventionId: body.interventionId,
      feedback: body.feedback ?? (body.wasHelpful === false ? 'dismissed' : 'rated'),
      helpful: body.wasHelpful,
      studentResponse: body.studentResponse,
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof KonlingRuntimeScopeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: '反馈记录失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 },
    );
  }
}

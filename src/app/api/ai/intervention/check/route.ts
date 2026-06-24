import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { verifyKonlingRuntimeScope } from '@/lib/konling-agent-runtime';
import {
  shouldIntervene,
  type InterventionRules,
  type StudentState,
} from '@/features/ai/companion/intervention-engine';

export const dynamic = 'force-dynamic';

interface CheckRequest {
  studentState: StudentState;
  interventionRules?: Partial<InterventionRules>;
  userId?: string;
  classId?: string;
  courseId?: string;
  pageId?: string;
  resourceId?: string;
  pathNodeId?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = (await request.json()) as CheckRequest;
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

    const decision = shouldIntervene(body.studentState, body.interventionRules);
    return NextResponse.json({
      ...decision,
      scope: {
        userId: scope.scope.targetUserId,
        classId: scope.scope.classId,
        resourceId: scope.scope.resourceId,
        pathNodeId: scope.scope.pathNodeId,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: 'AI介入判定失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

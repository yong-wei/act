import { NextResponse } from 'next/server';
import { AdaptiveAssessmentCatalogSelectionError } from '@/features/assessment/adaptive-assessment-catalog-selector';
import { selectNextPathQuestion } from '@/features/assessment/public-api';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface NextQuestionRequest {
  userId?: string;
  sessionId?: string;
  goalId?: string | null;
  routeIntent?: string | null;
  pathId?: string | null;
  nodeId?: string | null;
  continuity?: unknown;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再获取自适应评测题目' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as NextQuestionRequest;
    const result = await selectNextPathQuestion({
      actorUserId: session.user.id,
      sessionId: body.sessionId,
      goalId: body.goalId,
      routeIntent: body.routeIntent,
      pathId: body.pathId,
      nodeId: body.nodeId,
      continuity: body.continuity,
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof AdaptiveAssessmentCatalogSelectionError) {
      return NextResponse.json(
        {
          error: 'assessment_catalog_coverage_limited',
          message: error.message,
          limitation: error.limitation,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: '获取下一题失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

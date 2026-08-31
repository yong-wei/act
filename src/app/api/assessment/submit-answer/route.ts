import { NextResponse } from 'next/server';
import { submitPathAnswer } from '@/features/assessment/public-api';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface SubmitAnswerRequest {
  userId?: string;
  sessionId?: string;
  questionId: string;
  selectedOption: string;
  timeSpent: number;
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
        { error: '请先登录后再提交自适应评测答案' },
        { status: 401 },
      );
    }

    const body = (await request.json()) as SubmitAnswerRequest;
    const result = await submitPathAnswer({
      actorUserId: session.user.id,
      sessionId: body.sessionId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      timeSpent: body.timeSpent,
      goalId: body.goalId,
      routeIntent: body.routeIntent,
      pathId: body.pathId,
      nodeId: body.nodeId,
      continuity: body.continuity,
    });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '提交答案失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

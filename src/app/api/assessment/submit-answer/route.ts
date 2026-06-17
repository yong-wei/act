import { NextResponse } from 'next/server';
import { submitAnswerWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
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

    const userId = session.user.id;
    const sessionId = body.sessionId ?? `adaptive-${userId}`;

    const result = await submitAnswerWithPersistenceFallback({
      userId,
      sessionId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      timeSpent: body.timeSpent,
      pathContext: readPathContext(body),
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

function readPathContext(body: SubmitAnswerRequest) {
  if (typeof body.pathId !== 'string' || !body.pathId.trim()) return undefined;
  if (typeof body.nodeId !== 'string' || !body.nodeId.trim()) return undefined;
  return {
    pathId: body.pathId.trim(),
    nodeId: body.nodeId.trim(),
    goalId: typeof body.goalId === 'string' && body.goalId.trim() ? body.goalId.trim() : null,
    routeIntent: typeof body.routeIntent === 'string' && body.routeIntent.trim() ? body.routeIntent.trim() : null,
  };
}

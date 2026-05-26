import { NextResponse } from 'next/server';
import { selectNextQuestionWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface NextQuestionRequest {
  userId?: string;
  sessionId?: string;
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

    const userId = session.user.id;
    const sessionId = body.sessionId ?? `adaptive-${userId}`;

    const result = await selectNextQuestionWithPersistenceFallback({ userId, sessionId });
    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '获取下一题失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

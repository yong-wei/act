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
    const body = (await request.json()) as NextQuestionRequest;

    const userId = session?.user?.id ?? body.userId ?? 'demo-user';
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

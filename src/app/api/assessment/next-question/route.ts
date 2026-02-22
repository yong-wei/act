import { NextResponse } from 'next/server';
import { selectNextQuestion } from '@/features/assessment/adaptive-engine';
import { getServerAuthSession } from '@/lib/auth';

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

    const result = selectNextQuestion({ userId, sessionId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取下一题失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

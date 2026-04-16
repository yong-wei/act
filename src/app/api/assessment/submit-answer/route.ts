import { NextResponse } from 'next/server';
import { submitAnswer } from '@/features/assessment/adaptive-engine';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface SubmitAnswerRequest {
  userId?: string;
  sessionId?: string;
  questionId: string;
  selectedOption: string;
  timeSpent: number;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const body = (await request.json()) as SubmitAnswerRequest;

    const userId = session?.user?.id ?? body.userId ?? 'demo-user';
    const sessionId = body.sessionId ?? `adaptive-${userId}`;

    const result = submitAnswer({
      userId,
      sessionId,
      questionId: body.questionId,
      selectedOption: body.selectedOption,
      timeSpent: body.timeSpent,
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

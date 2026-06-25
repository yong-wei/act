import { NextResponse } from 'next/server';
import { generateQuestion } from '@/features/assessment/adaptive-engine';
import type { QuestionDomain } from '@/features/assessment/adaptive-question-bank';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface GenerateQuestionRequest {
  targetKnowledgeTags?: string[];
  difficultyTarget?: number;
  domains?: QuestionDomain[];
  goalId?: string | null;
  sessionId?: string | null;
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再生成自适应评测题目' },
        { status: 401 },
      );
    }
    const body = (await request.json()) as GenerateQuestionRequest;
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim().length > 0
      ? body.sessionId.trim()
      : `adaptive-${session.user.id}`;

    const question = generateQuestion({
      targetKnowledgeTags: body.targetKnowledgeTags ?? [],
      difficultyTarget: body.difficultyTarget ?? 0.5,
      domains: body.domains ?? [],
      learningGoalIds: typeof body.goalId === 'string' && body.goalId.trim().length > 0
        ? [body.goalId.trim()]
        : [],
      ownerUserId: session.user.id,
      sessionId,
    });

    return NextResponse.json({
      question,
      source: 'ai_generated',
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '生成题目失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

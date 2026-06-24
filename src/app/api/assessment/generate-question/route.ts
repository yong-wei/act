import { NextResponse } from 'next/server';
import { generateQuestion } from '@/features/assessment/adaptive-engine';
import type { QuestionDomain } from '@/features/assessment/adaptive-question-bank';

interface GenerateQuestionRequest {
  targetKnowledgeTags?: string[];
  difficultyTarget?: number;
  domains?: QuestionDomain[];
  goalId?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateQuestionRequest;

    const question = generateQuestion({
      targetKnowledgeTags: body.targetKnowledgeTags ?? [],
      difficultyTarget: body.difficultyTarget ?? 0.5,
      domains: body.domains ?? [],
      learningGoalIds: typeof body.goalId === 'string' && body.goalId.trim().length > 0
        ? [body.goalId.trim()]
        : [],
    });

    return NextResponse.json({
      question,
      source: 'ai_generated',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '生成题目失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

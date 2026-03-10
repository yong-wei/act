import { NextResponse } from 'next/server';
import { generateQuestion } from '@/features/assessment/adaptive-engine';
import type { QuestionDomain } from '@/features/assessment/adaptive-question-bank';

interface GenerateQuestionRequest {
  targetKnowledgeTags?: string[];
  difficultyTarget?: number;
  domains?: QuestionDomain[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateQuestionRequest;

    const question = generateQuestion({
      targetKnowledgeTags: body.targetKnowledgeTags ?? [],
      difficultyTarget: body.difficultyTarget ?? 0.5,
      domains: body.domains ?? [],
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

import { NextResponse } from 'next/server';
import { getPromptHistory } from '@/features/evaluation/prompt-quality';

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const history = getPromptHistory((await context.params).userId);
    return NextResponse.json({
      history,
      total: history.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取提示词历史失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

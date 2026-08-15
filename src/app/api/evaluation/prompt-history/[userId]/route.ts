import { NextResponse } from 'next/server';
import { listPromptAssessmentHistory } from '@/features/evaluation/prompt-assessment-history';
import { getServerAuthSession } from '@/lib/auth';

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await getServerAuthSession();
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const { userId } = await context.params;
    if (userId !== sessionUserId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const history = await listPromptAssessmentHistory(sessionUserId);
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

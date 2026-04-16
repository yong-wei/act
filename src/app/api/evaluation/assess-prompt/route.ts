import { NextResponse } from 'next/server';
import { assessPromptQuality, type AssessPromptRequest } from '@/features/evaluation/prompt-quality';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const body = (await request.json()) as AssessPromptRequest;

    const result = assessPromptQuality({
      ...body,
      userId: session?.user?.id ?? body.userId ?? 'demo-user',
      sessionId: body.sessionId ?? `eval-${session?.user?.id ?? 'demo-user'}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '提示词评价失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

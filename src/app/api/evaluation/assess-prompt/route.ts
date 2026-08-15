import { NextResponse } from 'next/server';
import {
  createPromptAssessmentAttempt,
  parsePromptAssessmentRequest,
} from '@/features/evaluation/prompt-assessment-history';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const body = parsePromptAssessmentRequest(await request.json());
    if (!body) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    const result = await createPromptAssessmentAttempt({
      userId,
      sessionId: body.sessionId ?? `eval-${userId}`,
      request: body.request,
    });

    return NextResponse.json(result.assessment);
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

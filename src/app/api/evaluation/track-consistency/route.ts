import { NextResponse } from 'next/server';
import {
  PromptAssessmentHistoryError,
  attachPromptConsistencyResult,
  parsePromptConsistencyRequest,
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
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const body = parsePromptConsistencyRequest(await request.json());
    if (!body) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    }
    const result = await attachPromptConsistencyResult({
      userId,
      sessionId: body.sessionId,
      version: body.version,
      request: body.request,
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof PromptAssessmentHistoryError) {
      return NextResponse.json({ error: error.code }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: '一致性追踪失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

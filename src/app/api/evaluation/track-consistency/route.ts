import { NextResponse } from 'next/server';
import { trackConsistency, type TrackConsistencyRequest } from '@/features/evaluation/prompt-quality';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    const body = (await request.json()) as TrackConsistencyRequest;

    const result = trackConsistency({
      ...body,
      userId: session?.user?.id ?? body.userId ?? 'demo-user',
    });

    return NextResponse.json(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '一致性追踪失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

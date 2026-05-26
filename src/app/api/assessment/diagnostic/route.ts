import { NextResponse } from 'next/server';
import { getDiagnosticWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    const { searchParams } = new URL(request.url);
    const userId = session?.user?.id ?? searchParams.get('userId') ?? 'demo-user';

    const diagnostic = await getDiagnosticWithPersistenceFallback(userId);
    return NextResponse.json(diagnostic);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '获取能力诊断失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

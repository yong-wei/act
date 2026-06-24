import { NextResponse } from 'next/server';
import { getAbilityReportWithPersistenceFallback } from '@/features/assessment/adaptive-persistence';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再查看能力报告' },
        { status: 401 },
      );
    }

    const canReadReport = session.user.id === (await context.params).userId || session.user.role === 'ADMIN';
    if (!canReadReport) {
      return NextResponse.json(
        { error: '无权查看该用户的能力报告' },
        { status: 403 },
      );
    }

    const report = await getAbilityReportWithPersistenceFallback((await context.params).userId);
    return NextResponse.json(report);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json(
      {
        error: '获取能力报告失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

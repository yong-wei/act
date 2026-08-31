import { NextResponse } from 'next/server';
import { readDiagnostic } from '@/features/assessment/public-api';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录后再查看自适应评测诊断' },
        { status: 401 },
      );
    }

    const diagnostic = await readDiagnostic(session.user.id);
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

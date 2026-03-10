import { NextResponse } from 'next/server';
import { getDiagnostic } from '@/features/assessment/adaptive-engine';
import { getServerAuthSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession();
    const { searchParams } = new URL(request.url);
    const userId = session?.user?.id ?? searchParams.get('userId') ?? 'demo-user';

    const diagnostic = getDiagnostic(userId);
    return NextResponse.json(diagnostic);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取能力诊断失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

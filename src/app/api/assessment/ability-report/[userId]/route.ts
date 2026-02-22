import { NextResponse } from 'next/server';
import { getAbilityReport } from '@/features/assessment/adaptive-engine';

interface RouteContext {
  params: {
    userId: string;
  };
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const report = getAbilityReport(context.params.userId);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error: '获取能力报告失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 旧 24 步综合实验已退役（2026-11）。该写接口恒定返回 410，
 * 不再创建会话、评分或消耗外部 ticket。
 */
export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'LEGACY_EXPERIMENT_RETIRED',
        message: '旧综合实验已退役，请使用七个独立实验。',
      },
    },
    { status: 410 },
  );
}

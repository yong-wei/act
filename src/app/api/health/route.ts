import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 公开存活探针（#1941）：只表述「进程存活」，无鉴权、不触达数据库或任何
 * 外部依赖；依赖就绪语义由 /api/readyz 承担，两者分工见
 * docs/operations/public-health-probes.md。
 */
export function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

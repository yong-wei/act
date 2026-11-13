import { NextResponse } from 'next/server';

import { readLegacyReport, readLegacySession } from '@/features/ilab/legacy-read';
import { toIlabHttpError } from '@/features/ilab/run-lock';

export const dynamic = 'force-dynamic';

/**
 * 旧 24 步综合实验已退役：本接口仅保留历史记录的只读读取
 * （?report=1 返回报告 HTML），不再提供任何写操作。
 */
export async function GET(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const report = new URL(request.url).searchParams.get('report');
    if (report === '1') {
      const html = await readLegacyReport(originId);
      return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return NextResponse.json(await readLegacySession(originId));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

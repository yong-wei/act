import { NextResponse } from 'next/server';

import { readIlabReport, readIlabSession, toIlabHttpError } from '@/features/ilab/session-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const report = new URL(request.url).searchParams.get('report');
    if (report === '1') {
      const html = await readIlabReport(originId);
      return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return NextResponse.json(await readIlabSession(originId));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

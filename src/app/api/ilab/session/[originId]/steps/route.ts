import { NextResponse } from 'next/server';

import { submitIlabStep, toIlabHttpError } from '@/features/ilab/session-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const body = await request.json() as { seq?: unknown; payload?: unknown; startedAtMs?: unknown };
    const seq = typeof body.seq === 'number' ? body.seq : Number(body.seq);
    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload as Record<string, unknown>
      : null;
    if (!payload || !Number.isInteger(seq)) {
      return NextResponse.json({ error: '步骤提交缺少序号或内容。' }, { status: 400 });
    }
    const session = await submitIlabStep(originId, {
      seq,
      payload,
      startedAtMs: typeof body.startedAtMs === 'number' ? body.startedAtMs : Date.now(),
    });
    return NextResponse.json(session);
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json(
      { error: httpError.message, ...(httpError.retryReport ? { retryReport: true } : {}) },
      { status: httpError.status },
    );
  }
}

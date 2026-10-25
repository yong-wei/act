import { NextResponse } from 'next/server';

import { completeIlabSession, toIlabHttpError } from '@/features/ilab/session-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const body = await request.json() as { reflection?: unknown; pretestNote?: unknown; paperNote?: unknown };
    const reflection = typeof body.reflection === 'string' ? body.reflection : '';
    const result = await completeIlabSession(originId, reflection, {
      pretestNote: typeof body.pretestNote === 'string' ? body.pretestNote : '',
      paperNote: typeof body.paperNote === 'string' ? body.paperNote : '',
    });
    return NextResponse.json(result);
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

import { NextResponse } from 'next/server';

import { openIlabSession, toIlabHttpError } from '@/features/ilab/session-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const session = await openIlabSession(ticket);
    return NextResponse.json(session);
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

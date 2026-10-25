import { NextResponse } from 'next/server';

import { openDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    return NextResponse.json(await openDestroyerSession(ticket));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

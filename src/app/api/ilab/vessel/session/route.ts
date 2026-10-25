import { NextResponse } from 'next/server';

import { openVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown; experimentKey?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey : '';
    return NextResponse.json(await openVesselSession(ticket, experimentKey));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

import { NextResponse } from 'next/server';

import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';
import { openVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown; experimentKey?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey : '';
    const grant = readIlabGrantFromRequest(request);
    const result = await openVesselSession({ ticket, grant, experimentKey });
    if (!result.connected) {
      return NextResponse.json({ connected: false });
    }
    const response = NextResponse.json({ connected: true, ...result.session });
    return applyIlabGrantCookie(response, result.grantToSet);
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

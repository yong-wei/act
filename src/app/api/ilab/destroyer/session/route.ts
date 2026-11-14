import { NextResponse } from 'next/server';

import { openDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';
import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { ticket?: unknown; experimentVersion?: unknown };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const grant = readIlabGrantFromRequest(request);
    const experimentVersion = typeof body.experimentVersion === 'string' ? body.experimentVersion : undefined;
    const result = await openDestroyerSession({ ticket, grant, experimentVersion });
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

import { NextResponse } from 'next/server';

import { applyIlabNextAuthSessionCookie } from '@/features/ilab/adapters/ilab-account-service';
import { openDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';
import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      ticket?: unknown;
      experimentVersion?: unknown;
      forceNew?: unknown;
    };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const grant = readIlabGrantFromRequest(request);
    const experimentVersion = typeof body.experimentVersion === 'string' ? body.experimentVersion : undefined;
    const forceNew = body.forceNew === true;
    const result = await openDestroyerSession({ ticket, grant, experimentVersion, forceNew });
    if (!result.connected) {
      return NextResponse.json({ connected: false });
    }
    const response = NextResponse.json({
      connected: true,
      resumed: result.resumed,
      ...result.session,
    });
    if (result.grantToSet) {
      applyIlabGrantCookie(response, result.grantToSet);
    }
    if (result.user) {
      await applyIlabNextAuthSessionCookie(response, result.user, request);
    }
    return response;
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

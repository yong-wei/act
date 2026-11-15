import { NextResponse } from 'next/server';

import { applyIlabNextAuthSessionCookie } from '@/features/ilab/adapters/ilab-account-service';
import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';
import { openVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      ticket?: unknown;
      experimentKey?: unknown;
      forceNew?: unknown;
      experimentVersion?: unknown;
    };
    const ticket = typeof body.ticket === 'string' ? body.ticket : '';
    const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey : '';
    const forceNew = body.forceNew === true;
    const grant = readIlabGrantFromRequest(request);
    const experimentVersion = typeof body.experimentVersion === 'string' ? body.experimentVersion : undefined;
    const result = await openVesselSession({ ticket, grant, experimentKey, forceNew, experimentVersion });
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

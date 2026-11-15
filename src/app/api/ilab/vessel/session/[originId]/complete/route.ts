import { NextResponse } from 'next/server';

import { resolveCurrentActorContext } from '@/features/ilab/adapters/ilab-session-lifecycle';

import { applyIlabGrantCookie, readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';
import { readVesselSession, completeVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    await readVesselSession(originId, await resolveCurrentActorContext(readIlabGrantFromRequest(request)));
    const { refreshedGrant, ...publicBody } = await completeVesselSession(originId);
    const response = NextResponse.json(publicBody);
    return refreshedGrant ? applyIlabGrantCookie(response, refreshedGrant) : response;
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

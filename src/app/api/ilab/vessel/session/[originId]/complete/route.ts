import { NextResponse } from 'next/server';

import { applyIlabGrantCookie } from '@/features/ilab/grant-cookie';
import { completeVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const { refreshedGrant, ...publicBody } = await completeVesselSession(originId);
    const response = NextResponse.json(publicBody);
    return refreshedGrant ? applyIlabGrantCookie(response, refreshedGrant) : response;
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

import { NextResponse } from 'next/server';

import { completeDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';
import { applyIlabGrantCookie } from '@/features/ilab/grant-cookie';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const { refreshedGrant, ...publicBody } = await completeDestroyerSession(originId);
    const response = NextResponse.json(publicBody);
    return refreshedGrant ? applyIlabGrantCookie(response, refreshedGrant) : response;
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

import { NextResponse } from 'next/server';

import { completeDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    return NextResponse.json(await completeDestroyerSession(originId));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

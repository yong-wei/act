import { NextResponse } from 'next/server';

import { readVesselSession, toIlabHttpError } from '@/features/ilab/vessel-session';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    return NextResponse.json(await readVesselSession(originId));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

import { NextResponse } from 'next/server';

import { resolveCurrentActorContext, saveIlabRunDraft } from '@/features/ilab/adapters/ilab-session-lifecycle';
import { readDestroyerSession, toIlabHttpError } from '@/features/ilab/destroyer-session';
import { readIlabGrantFromRequest } from '@/features/ilab/grant-cookie';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const actor = await resolveCurrentActorContext(readIlabGrantFromRequest(request));
    return NextResponse.json(await readDestroyerSession(originId, actor));
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const body = await request.json().catch(() => null) as {
      activeSeq?: unknown;
      seq?: unknown;
      readings?: unknown;
      courseState?: unknown;
    } | null;
    const actor = await resolveCurrentActorContext(readIlabGrantFromRequest(request));
    const readings: Record<string, string> = {};
    if (body?.readings && typeof body.readings === 'object' && !Array.isArray(body.readings)) {
      for (const [key, value] of Object.entries(body.readings)) {
        if (typeof value === 'string') readings[key] = value;
      }
    }
    const drafts = await saveIlabRunDraft({
      originId,
      expectedVesselId: 'destroyer-055',
      actor,
      activeSeq: typeof body?.activeSeq === 'number' ? body.activeSeq : undefined,
      seq: typeof body?.seq === 'number' ? body.seq : undefined,
      readings: body?.readings !== undefined ? readings : undefined,
      courseState: body?.courseState && typeof body.courseState === 'object' && !Array.isArray(body.courseState)
        ? body.courseState as Record<string, unknown>
        : undefined,
    });
    return NextResponse.json({ ok: true, stepDrafts: drafts.bySeq, draftActiveSeq: drafts.activeSeq });
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json({ error: httpError.message }, { status: httpError.status });
  }
}

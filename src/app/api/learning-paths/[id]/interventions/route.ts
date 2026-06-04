import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { recordPathIntervention } from '@/lib/control-correction-path-rounds';
import {
  assertCanReadPath,
  getLearningPathRequester,
  readPathForAccess,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const INTERVENTION_KINDS = new Set(['diagnosis', 'hint', 'rollback', 'fallback-path', 'reflection-prompt']);
const STUDENT_OUTCOMES = new Set(['pending', 'accepted', 'dismissed', 'completed']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = await assertCanReadPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    if (
      typeof body.interventionKind !== 'string' ||
      !INTERVENTION_KINDS.has(body.interventionKind) ||
      (body.studentOutcome !== undefined && (
        typeof body.studentOutcome !== 'string' ||
        !STUDENT_OUTCOMES.has(body.studentOutcome)
      )) ||
      typeof body.suggestedAction !== 'string' ||
      body.suggestedAction.trim().length === 0 ||
      typeof body.privacySafeSummary !== 'string' ||
      body.privacySafeSummary.trim().length === 0
    ) {
      return NextResponse.json({ error: '路径干预事件不符合枚举或必填字段契约' }, { status: 400 });
    }
    const intervention = await recordPathIntervention(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      interventionKind: body.interventionKind,
      citedEvidence: body.citedEvidence ?? [],
      suggestedAction: body.suggestedAction,
      studentOutcome: body.studentOutcome ?? 'pending',
      privacySafeSummary: body.privacySafeSummary,
      idempotencyKey: body.idempotencyKey ?? null,
    });

    return NextResponse.json({ intervention });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathIntervention] Error:', error);
    return NextResponse.json({ error: '记录路径干预失败' }, { status: 500 });
  }
}

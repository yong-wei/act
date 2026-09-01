import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { recordPathIntervention } from '@/features/personalization/path-planning/control-correction-path-rounds';
import {
  assertCanReadPath,
  assertCanWritePathIntervention,
  assertPathMutableForWrite,
  getLearningPathRequester,
  learningPathMutationBlockedResponse,
  readPathForAccess,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const INTERVENTION_KINDS = new Set(['diagnosis', 'hint', 'rollback', 'fallback-path', 'reflection-prompt']);
const STUDENT_OUTCOMES = new Set(['pending', 'accepted', 'ignored', 'rejected', 'partially-accepted', 'dismissed', 'completed']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = await assertCanReadPath(requester, path);
    if (denied) return denied;
    const writeDenied = assertCanWritePathIntervention(requester);
    if (writeDenied) return writeDenied;
    const stopped = assertPathMutableForWrite(path);
    if (stopped) return stopped;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
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
      goalId: path.goalId ?? null,
      interventionKind: body.interventionKind,
      citedEvidence: body.citedEvidence ?? [],
      suggestedAction: body.suggestedAction,
      studentOutcome: body.studentOutcome ?? 'pending',
      privacySafeSummary: body.privacySafeSummary,
      idempotencyKey: body.idempotencyKey ?? null,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({ intervention: toInterventionWriteView(intervention), cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const blocked = learningPathMutationBlockedResponse(error);
    if (blocked) return blocked;
    console.error('[LearningPathIntervention] Error:', error);
    return NextResponse.json({ error: '记录路径干预失败' }, { status: 500 });
  }
}

function toInterventionWriteView(intervention: any) {
  return {
    id: intervention.id,
    interventionKind: intervention.interventionKind,
    studentOutcome: intervention.studentOutcome,
    privacySafeSummary: intervention.privacySafeSummary,
    createdAt: intervention.createdAt ?? null,
  };
}

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { recordPathDeviation } from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
  readPathNodeIds,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const DEVIATION_TYPES = new Set(['skip', 'timeout', 'manual-jump', 'resource-failure', 'abandonment', 'help-request']);
const EVIDENCE_CONFIDENCE = new Set(['low', 'medium', 'high', 'unknown']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    const nodeIds = new Set(readPathNodeIds(path));
    if (
      typeof body.deviationType !== 'string' ||
      !DEVIATION_TYPES.has(body.deviationType) ||
      (body.evidenceConfidence !== undefined && (
        typeof body.evidenceConfidence !== 'string' ||
        !EVIDENCE_CONFIDENCE.has(body.evidenceConfidence)
      )) ||
      (body.priorNodeId !== undefined && body.priorNodeId !== null && (
        typeof body.priorNodeId !== 'string' ||
        !nodeIds.has(body.priorNodeId)
      )) ||
      (body.targetNodeId !== undefined && body.targetNodeId !== null && (
        typeof body.targetNodeId !== 'string' ||
        !nodeIds.has(body.targetNodeId)
      ))
    ) {
      return NextResponse.json({ error: '路径偏离事件不符合枚举或节点契约' }, { status: 400 });
    }
    const deviation = await recordPathDeviation(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      goalId: path.goalId ?? null,
      deviationType: body.deviationType,
      priorNodeId: body.priorNodeId ?? null,
      targetNodeId: body.targetNodeId ?? null,
      context: body.context ?? {},
      evidenceConfidence: body.evidenceConfidence ?? 'unknown',
      idempotencyKey: body.idempotencyKey ?? null,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({ deviation: toDeviationWriteView(deviation), cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathDeviation] Error:', error);
    return NextResponse.json({ error: '记录路径偏离失败' }, { status: 500 });
  }
}

function toDeviationWriteView(deviation: any) {
  return {
    id: deviation.id,
    deviationType: deviation.deviationType,
    priorNodeId: deviation.priorNodeId ?? null,
    targetNodeId: deviation.targetNodeId ?? null,
    evidenceConfidence: deviation.evidenceConfidence ?? 'unknown',
    createdAt: deviation.createdAt ?? null,
  };
}

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
const SKIP_WARNING_TEXT = '跳过后该资源不会计入完成进度，但会记录为路径偏离，可稍后返回。';

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
    const existingDeviation = await readExistingDeviation(params.id, body.idempotencyKey);
    if (existingDeviation) {
      const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);
      return NextResponse.json({
        deviation: toDeviationWriteView(existingDeviation),
        pathUpdate: { currentNodeId: typeof path.currentNodeId === 'string' ? path.currentNodeId : null },
        cacheRefresh,
      });
    }
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
    const skipContext = validateAndBuildSkipContext(path, body);
    if (skipContext instanceof NextResponse) return skipContext;
    const deviation = await recordPathDeviation(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      goalId: path.goalId ?? null,
      deviationType: body.deviationType,
      priorNodeId: body.priorNodeId ?? null,
      targetNodeId: body.targetNodeId ?? null,
      context: skipContext ?? body.context ?? {},
      evidenceConfidence: body.evidenceConfidence ?? 'unknown',
      idempotencyKey: body.idempotencyKey ?? null,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const pathUpdate = skipContext
      ? await advanceCurrentNodeAfterCurrentSkip(path, body.targetNodeId)
      : null;
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({
      deviation: toDeviationWriteView(deviation),
      pathUpdate,
      cacheRefresh,
    });
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

async function readExistingDeviation(pathId: string, idempotencyKey: unknown): Promise<any | null> {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) return null;
  return await prisma.learningPathDeviation?.findFirst?.({
    where: {
      pathId,
      idempotencyKey,
    },
  }) ?? null;
}

function validateAndBuildSkipContext(path: any, body: any): Record<string, unknown> | NextResponse | null {
  if (body.deviationType !== 'skip') return null;
  if (typeof body.targetNodeId !== 'string') {
    return NextResponse.json({ error: '跳过路径偏离必须指定目标节点' }, { status: 400 });
  }
  if (typeof path.currentNodeId === 'string' && body.priorNodeId !== path.currentNodeId) {
    return NextResponse.json({ error: '跳过路径偏离必须从当前节点发起' }, { status: 409 });
  }
  const metadata = toRecord(path.lastExecutionMetadata);
  const completedNodeIds = new Set(arrayOfStrings(metadata.completedNodeIds));
  if (completedNodeIds.has(body.targetNodeId)) {
    return NextResponse.json({ error: '已完成节点不能写入跳过偏离' }, { status: 409 });
  }
  const payload = toRecord(path.pathPayload);
  const mainPathNodeIds = arrayOfStrings(payload.mainPathNodeIds);
  if (typeof path.currentNodeId === 'string' && mainPathNodeIds.length > 0) {
    const currentIndex = mainPathNodeIds.indexOf(path.currentNodeId);
    const targetIndex = mainPathNodeIds.indexOf(body.targetNodeId);
    if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex) {
      return NextResponse.json({ error: '历史节点不能写入跳过偏离' }, { status: 409 });
    }
  }
  return {
    consequence: SKIP_WARNING_TEXT,
    returnEligible: true,
  };
}

async function advanceCurrentNodeAfterCurrentSkip(path: any, targetNodeId: unknown): Promise<{ currentNodeId: string | null } | null> {
  if (!prisma.learningPath.update) return null;
  if (typeof path.currentNodeId !== 'string' || targetNodeId !== path.currentNodeId) return null;
  const metadata = toRecord(path.lastExecutionMetadata);
  const completedNodeIds = new Set(arrayOfStrings(metadata.completedNodeIds));
  const skippedNodeIds = new Set(arrayOfStrings(metadata.skippedNodeIds));
  skippedNodeIds.add(path.currentNodeId);
  const mainPathNodeIds = arrayOfStrings(toRecord(path.pathPayload).mainPathNodeIds);
  const currentIndex = mainPathNodeIds.indexOf(path.currentNodeId);
  const nextNodeId = currentIndex >= 0
    ? mainPathNodeIds
        .slice(currentIndex + 1)
        .find((nodeId) => !completedNodeIds.has(nodeId) && !skippedNodeIds.has(nodeId)) ?? null
    : null;

  await prisma.learningPath.update({
    where: { id: path.id },
    data: {
      currentNodeId: nextNodeId,
      lastExecutionMetadata: {
        ...metadata,
        activeNodeId: nextNodeId,
        skippedNodeIds: [...skippedNodeIds],
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return { currentNodeId: nextNodeId };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import {
  buildAuthorizedAdaptivePathJourney,
} from '@/features/adaptive/adaptive-path-journey-contracts';
import { buildAdaptivePathCorrectionApplication } from '@/lib/adaptive-path-correction-decisions';
import { runWithLearningPathWriteFence } from '@/lib/canonical-learning-path-transition/write-fence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  assertCanWriteStudentPath,
  assertPathMutableForWrite,
  getLearningPathRequester,
  learningPathMutationBlockedResponse,
  readPathForAccess,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const DECISIONS = new Set(['confirmed', 'rejected', 'deferred']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const { id: pathId } = await props.params;
    const path = await readPathForAccess(pathId);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    if (!isDecision(body.decision) || !isNonEmptyString(body.candidateFingerprint) || !isDateISOString(body.pathUpdatedAt)) {
      return NextResponse.json({ error: '纠偏决策请求不符合契约。' }, { status: 400 });
    }

    const existing = await (prisma as any).learningPathCorrectionDecision.findFirst({
      where: { pathId, idempotencyKey: body.idempotencyKey },
    });
    if (existing) {
      if (existing.decision !== body.decision || existing.candidateFingerprint !== body.candidateFingerprint) {
        return NextResponse.json({ error: '该幂等键已用于另一项纠偏决策。' }, { status: 409 });
      }
      return NextResponse.json({ decision: toResponse(existing), replayed: true });
    }

    const blocked = assertPathMutableForWrite(path);
    if (blocked) return blocked;
    const result = await runWithLearningPathWriteFence(prisma as any, pathId, async (tx) => {
      const fencedExisting = await (tx as any).learningPathCorrectionDecision.findFirst({
        where: { pathId, idempotencyKey: body.idempotencyKey },
      });
      if (fencedExisting) {
        if (
          fencedExisting.decision !== body.decision ||
          fencedExisting.candidateFingerprint !== body.candidateFingerprint
        ) {
          throw new CorrectionConflictError('该幂等键已用于另一项纠偏决策。');
        }
        return { decision: fencedExisting, replayed: true };
      }
      const latest = await tx.learningPath.findFirst({
        where: { id: pathId },
        select: JOURNEY_PATH_SELECT,
      });
      if (!latest || latest.userId !== path.userId) throw new CorrectionConflictError('学习路径已变更，请刷新后重新查看纠偏方案。');
      const latestUpdatedAt = toISOString(latest.updatedAt);
      if (!latestUpdatedAt || latestUpdatedAt !== body.pathUpdatedAt) {
        throw new CorrectionConflictError('学习路径已变更，请刷新后重新查看纠偏方案。');
      }
      const journey = buildAuthorizedAdaptivePathJourney(latest);
      const correction = journey.correction;
      if (
        !correction?.proposal ||
        correction.candidateFingerprint !== body.candidateFingerprint ||
        correction.pathUpdatedAt !== body.pathUpdatedAt
      ) {
        throw new CorrectionConflictError('纠偏方案已过期，请刷新后重新查看。');
      }
      if (correction.decision?.decision === 'rejected' || correction.decision?.decision === 'confirmed') {
        throw new CorrectionConflictError('该纠偏方案已经处理，请刷新路径状态。');
      }

      const application = body.decision === 'confirmed'
        ? buildAdaptivePathCorrectionApplication({ ...latest, deviations: latest.deviations }, correction.proposal)
        : null;
      if (body.decision === 'confirmed' && !application) {
        throw new CorrectionConflictError('当前纠偏方案不再具备可安全应用的后续节点，请刷新后重新查看。');
      }

      let applicationResult: Record<string, unknown> = { applied: false };
      if (application) {
        if (typeof tx.learningPath.updateMany !== 'function') {
          throw new Error('LearningPath correction application requires a conditional update.');
        }
        const update = await tx.learningPath.updateMany({
          where: { id: pathId, updatedAt: latest.updatedAt },
          data: {
            nodeIds: application.nodeIds,
            currentNodeId: application.currentNodeId,
            pathPayload: application.pathPayload as Prisma.InputJsonValue,
            lastExecutionMetadata: application.lastExecutionMetadata as Prisma.InputJsonValue,
          },
        });
        if (update.count !== 1) {
          throw new CorrectionConflictError('学习路径已变更，请刷新后重新查看纠偏方案。');
        }
        applicationResult = {
          applied: true,
          currentNodeId: application.currentNodeId,
          nodeIds: application.nodeIds,
        };
      }

      const decision = await (tx as any).learningPathCorrectionDecision.create({
        data: {
          pathId,
          userId: path.userId,
          candidateFingerprint: correction.candidateFingerprint,
          pathUpdatedAt: latest.updatedAt,
          decision: body.decision,
          originalPathSnapshot: snapshotPath(latest),
          candidateSnapshot: correction.proposal as unknown as Prisma.InputJsonValue,
          supportingFacts: correction.proposal.supportingFacts as unknown as Prisma.InputJsonValue,
          applicationResult: applicationResult as Prisma.InputJsonValue,
          idempotencyKey: body.idempotencyKey,
        },
      });
      return { decision, replayed: false };
    });

    return NextResponse.json({ decision: toResponse(result.decision), replayed: result.replayed });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    const blocked = learningPathMutationBlockedResponse(error);
    if (blocked) return blocked;
    if (error instanceof CorrectionConflictError) {
      return NextResponse.json({ error: error.message, refreshRequired: true }, { status: 409 });
    }
    console.error('[LearningPathCorrectionDecision] Error:', error);
    return NextResponse.json({ error: '记录纠偏决策失败。' }, { status: 500 });
  }
}

const JOURNEY_PATH_SELECT = {
  id: true,
  title: true,
  userId: true,
  goalId: true,
  pathStatus: true,
  currentNodeId: true,
  nodeIds: true,
  pathPayload: true,
  terminalValidation: true,
  lastExecutionMetadata: true,
  updatedAt: true,
  deviations: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, deviationType: true, priorNodeId: true, targetNodeId: true },
  },
  correctionDecisions: {
    orderBy: { createdAt: 'desc' },
    select: { candidateFingerprint: true, decision: true, applicationResult: true, createdAt: true },
  },
} as const;

class CorrectionConflictError extends Error {}

function isDecision(value: unknown): value is 'confirmed' | 'rejected' | 'deferred' {
  return typeof value === 'string' && DECISIONS.has(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateISOString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function toISOString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return isDateISOString(value) ? new Date(value).toISOString() : null;
}

function snapshotPath(path: Record<string, unknown>): Record<string, unknown> {
  return {
    id: path.id,
    currentNodeId: path.currentNodeId,
    nodeIds: path.nodeIds,
    pathPayload: path.pathPayload,
    terminalValidation: path.terminalValidation,
    lastExecutionMetadata: path.lastExecutionMetadata,
    updatedAt: toISOString(path.updatedAt),
  };
}

function toResponse(value: Record<string, unknown>) {
  return {
    id: value.id,
    decision: value.decision,
    candidateFingerprint: value.candidateFingerprint,
    applied: readRecord(value.applicationResult).applied === true,
    createdAt: toISOString(value.createdAt),
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  recordPathNodeExecution,
  updateControlCorrectionPathRoundAfterExecution,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
  readPathNodeIds,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const EXECUTION_STATUSES = new Set(['started', 'completed', 'failed', 'abandoned']);
const RESOURCE_TYPES = new Set(['knowledge_card', 'simulation', 'arena_task', 'intervention', 'reflection']);

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
    const nodeIds = new Set(readPathNodeIds(path));
    if (
      typeof body.nodeId !== 'string' ||
      !nodeIds.has(body.nodeId) ||
      typeof body.resourceType !== 'string' ||
      !RESOURCE_TYPES.has(body.resourceType) ||
      typeof body.status !== 'string' ||
      !EXECUTION_STATUSES.has(body.status)
    ) {
      return NextResponse.json({ error: '执行事件不符合路径节点或状态契约' }, { status: 400 });
    }
    const execution = await recordPathNodeExecution(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      nodeId: body.nodeId,
      resourceType: body.resourceType,
      status: body.status,
      startedAt: body.startedAt ?? null,
      completedAt: body.completedAt ?? null,
      failedAt: body.failedAt ?? null,
      evidenceRefs: body.evidenceRefs ?? [],
      liftMetadata: body.liftMetadata ?? {},
      simulationRef: body.simulationRef ?? null,
      arenaRef: body.arenaRef ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    await updateControlCorrectionPathRoundAfterExecution(prisma as any, path, {
      pathId: params.id,
      userId: path.userId,
      nodeId: body.nodeId,
      resourceType: body.resourceType,
      status: body.status,
      startedAt: body.startedAt ?? null,
      completedAt: body.completedAt ?? null,
      failedAt: body.failedAt ?? null,
      evidenceRefs: body.evidenceRefs ?? [],
      liftMetadata: body.liftMetadata ?? {},
      simulationRef: body.simulationRef ?? null,
      arenaRef: body.arenaRef ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    });

    return NextResponse.json({ execution });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathExecute] Error:', error);
    return NextResponse.json({ error: '记录路径执行失败' }, { status: 500 });
  }
}

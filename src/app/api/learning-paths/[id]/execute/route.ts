import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { recordPathNodeExecution } from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({ execution });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathExecute] Error:', error);
    return NextResponse.json({ error: '记录路径执行失败' }, { status: 500 });
  }
}

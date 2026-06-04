import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { recordPathDeviation } from '@/lib/control-correction-path-rounds';
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
    const deviation = await recordPathDeviation(prisma as any, {
      pathId: params.id,
      userId: path.userId,
      deviationType: body.deviationType,
      priorNodeId: body.priorNodeId ?? null,
      targetNodeId: body.targetNodeId ?? null,
      context: body.context ?? {},
      evidenceConfidence: body.evidenceConfidence ?? 'unknown',
      idempotencyKey: body.idempotencyKey ?? null,
    });

    return NextResponse.json({ deviation });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathDeviation] Error:', error);
    return NextResponse.json({ error: '记录路径偏离失败' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  readControlCorrectionPathRound,
  toControlCorrectionPathRoundView,
} from '@/features/personalization/path-planning/control-correction-path-rounds';
import { assertCanReadPath, getLearningPathRequester, readPathForAccess } from '../route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;

    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;

    const denied = await assertCanReadPath(requester, path);
    if (denied) return denied;

    const round = await readControlCorrectionPathRound(prisma as any, {
      pathId: params.id,
      userId: path.userId,
    });

    return NextResponse.json({ path: toControlCorrectionPathRoundView(round) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathRead] Error:', error);
    return NextResponse.json({ error: '读取学习路径失败' }, { status: 500 });
  }
}

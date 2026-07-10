import { NextResponse } from 'next/server';

import { buildAuthorizedAdaptivePathJourney } from '@/features/adaptive/adaptive-path-journey-contracts';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  assertCanReadOwnedPathJourney,
  getLearningPathRequester,
  readPathForAccess,
  readPathNodeIds,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) {
      return path.status === 404
        ? NextResponse.json({ error: '无权访问该学习路径旅程' }, { status: 403 })
        : path;
    }
    const denied = assertCanReadOwnedPathJourney(requester, path);
    if (denied) return denied;

    const url = new URL(request.url);
    const nodeId = url.searchParams.get('nodeId');
    const goalId = url.searchParams.get('goalId');
    const nodeIds = new Set(readPathNodeIds(path));
    if (!nodeId || !goalId || goalId !== path.goalId || !nodeIds.has(nodeId)) {
      return NextResponse.json({ error: '无权访问该学习路径旅程' }, { status: 403 });
    }

    return NextResponse.json({
      journey: buildAuthorizedAdaptivePathJourney(path, { requestedNodeId: nodeId }),
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathJourney] Error:', error);
    return NextResponse.json({ error: '读取学习路径旅程失败' }, { status: 500 });
  }
}

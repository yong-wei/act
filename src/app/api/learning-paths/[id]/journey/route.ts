import { NextResponse } from 'next/server';

import { buildAuthorizedAdaptivePathJourney } from '@/features/personalization/experience/adaptive-path-journey-contracts';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { canonicalizeVerifiedLegacyArenaPath } from '@/lib/verified-legacy-arena-path-canonicalization';
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
    const persistedPath = await readPathForAccess(params.id);
    if (persistedPath instanceof NextResponse) {
      return persistedPath.status === 404
        ? NextResponse.json({ error: '无权访问该学习路径旅程' }, { status: 403 })
        : persistedPath;
    }
    const denied = assertCanReadOwnedPathJourney(requester, persistedPath);
    if (denied) return denied;
    const path = canonicalizeVerifiedLegacyArenaPath(persistedPath).path;

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

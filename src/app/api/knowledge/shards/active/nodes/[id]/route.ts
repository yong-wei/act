import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeShardResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveDetailShard,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  if (!id || id.length > 200) {
    return NextResponse.json(
      { error: 'Invalid detail node id.', code: 'ACTIVE_SHARD_NODE_ID_INVALID' },
      { status: 400 },
    );
  }
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    return activeShardResponse(() => readActiveDetailShard(id), authorization.role, request);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority detail shard request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

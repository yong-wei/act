import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeShardResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveRelationFamilyShard,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string; family: string }> },
) {
  const { domain, family } = await props.params;
  if (!domain || domain.length > 120 || !family || family.length > 80) {
    return NextResponse.json(
      { error: 'Invalid authority family request.', code: 'ACTIVE_SHARD_FAMILY_INVALID' },
      { status: 400 },
    );
  }
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    return activeShardResponse(() => readActiveRelationFamilyShard(domain, family));
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority relation-family shard request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

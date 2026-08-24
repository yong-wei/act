import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeShardResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveDomainDefaultShard,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ domain: string }> },
) {
  const { domain } = await props.params;
  if (!domain || domain.length > 120) {
    return NextResponse.json(
      { error: 'Invalid authority domain.', code: 'ACTIVE_SHARD_DOMAIN_INVALID' },
      { status: 400 },
    );
  }
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    return activeShardResponse(() => readActiveDomainDefaultShard(domain), authorization.role, request);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority domain-default shard request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

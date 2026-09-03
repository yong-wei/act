import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeDomainSearchResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Bounded server search over the sealed domain search index (#1738). The
 * response is paged, identity-safe and version-matched; the complete index
 * never leaves the server.
 */
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
    const url = new URL(request.url);
    return activeDomainSearchResponse({
      domainKey: domain,
      query: url.searchParams.get('q') ?? '',
      canonicalType: url.searchParams.get('type'),
      page: Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0,
      pageSize: Number.parseInt(url.searchParams.get('limit') ?? '', 10) || 0,
      request,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority domain search request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

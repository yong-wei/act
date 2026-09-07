import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeUnavailableResponse,
  authorizeActiveGraph,
} from '@/app/api/knowledge/_active-authority';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';
import {
  activeLocaleCapability,
  resolveActiveLocaleRequest,
} from '@/lib/authority-locale-readiness/request';
import {
  isBindingContentToken,
  readPublishedAuthorityInfographBySafeId,
} from '@/lib/authority-domain-shards/learning-content';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ safeId: string }> },
) {
  const { safeId } = await props.params;
  if (!isBindingContentToken(safeId)) {
    return NextResponse.json(
      { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
      { status: 404 },
    );
  }
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    const locale = resolveActiveLocaleRequest(request, activeLocaleCapability());
    if (!locale.ok) return locale.response;
    const image = readPublishedAuthorityInfographBySafeId(safeId);
    if (!image) {
      return NextResponse.json(
        { error: '当前信息图暂时不可用。', code: 'ACTIVE_INFOGRAPH_UNAVAILABLE' },
        { status: 404 },
      );
    }
    return new NextResponse(image, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Published Authority infograph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

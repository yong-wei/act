import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';
import {
  activeProjectionResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveNode,
} from '../../../_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  const { id } = await props.params;
  if (!id || id.length > 200) {
    return NextResponse.json(
      { error: 'Invalid active Authority node id.', code: 'ACTIVE_GRAPH_INVALID_NODE_ID' },
      { status: 400 },
    );
  }
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    return activeProjectionResponse(readActiveNode(authorization.role, id), {
      kind: 'detail',
      role: authorization.role,
      surfaceKey: id,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority node request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

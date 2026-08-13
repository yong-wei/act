import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

import {
  activeShardResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveRootShard,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Product root shard. Identity comes only from the server active pointer. */
export async function GET(_request: Request) {
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    return activeShardResponse(readActiveRootShard);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority root shard request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';
import {
  activeProjectionResponse,
  activeUnavailableResponse,
  authorizeActiveFullGraphDiagnostics,
  readActiveCanvas,
} from '../../_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Authorized diagnostics only. Product `/knowledge` interaction must use
 * versioned domain shards and must not request this full-canvas payload.
 * Identity selectors are rejected; snapshot/release stay server-side.
 */
export async function GET(request: Request) {
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const authorization = await authorizeActiveFullGraphDiagnostics();
    if (!authorization.ok) return authorization.response;
    const result = readActiveCanvas();
    return activeProjectionResponse(result, {
      kind: 'root',
      role: authorization.role,
      surfaceKey: 'active-canvas',
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority graph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

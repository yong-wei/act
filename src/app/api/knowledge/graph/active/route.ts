import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
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
 * Query parameters are ignored: snapshot/release selectors stay server-side.
 */
export async function GET(_request: Request) {
  try {
    const authorization = await authorizeActiveFullGraphDiagnostics();
    if (!authorization.ok) return authorization.response;
    const result = readActiveCanvas();
    return activeProjectionResponse(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority graph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

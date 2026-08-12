import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  activeProjectionResponse,
  activeUnavailableResponse,
  authorizeActiveGraph,
  readActiveCanvas,
} from '../../_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Resolve only the committed engineering-graph activation.  Query parameters
 * are intentionally ignored: snapshot/release/manifest selectors are server
 * authority and cannot be supplied by the browser.
 */
export async function GET(_request: Request) {
  try {
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    const result = readActiveCanvas();
    return activeProjectionResponse(result);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority graph request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

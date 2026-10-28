import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { notApplicableMasteryOverlay } from '@/lib/authority-learner-mastery';
import { loadActiveAuthorityMasteryOverlay } from '@/lib/authority-learner-mastery/server';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';

import {
  activeUnavailableResponse,
  authorizeActiveGraph,
} from '@/app/api/knowledge/_active-authority';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

/** Self-scoped learner mastery overlay; teachers and admins get no learner data. */
export async function GET(request: Request) {
  try {
    const rejected = knowledgeSurfaceSelectorRejection(request);
    if (rejected) return rejected;
    const authorization = await authorizeActiveGraph();
    if (!authorization.ok) return authorization.response;
    if (authorization.role !== 'STUDENT' || !authorization.userId) {
      return NextResponse.json(notApplicableMasteryOverlay(), { headers: PRIVATE_HEADERS });
    }
    const overlay = await loadActiveAuthorityMasteryOverlay(authorization.userId);
    return NextResponse.json(overlay, { headers: PRIVATE_HEADERS });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Active Authority mastery overlay request failed:', error);
    return activeUnavailableResponse('active-graph-internal-error');
  }
}

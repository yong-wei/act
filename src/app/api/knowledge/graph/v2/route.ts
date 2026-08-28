import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  authorizeCandidateGraph,
  candidateProjectionResponse,
  readCandidateCanvas,
  rejectCandidateSelectorParameters,
} from '../../_candidate-v2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const selectorError = rejectCandidateSelectorParameters(request);
  if (selectorError) return selectorError;

  try {
    const authorization = await authorizeCandidateGraph();
    if (!authorization.ok) return authorization.response;
    return candidateProjectionResponse(await readCandidateCanvas(), {
      role: authorization.role,
      surfaceKey: 'candidate-canvas',
      kind: 'candidate-diagnostic',
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Candidate authoritative graph request failed:', error);
    return NextResponse.json(
      { error: 'Candidate graph request failed.', code: 'CANDIDATE_GRAPH_INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

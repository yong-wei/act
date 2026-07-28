import { NextResponse } from 'next/server';

import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  authorizeCandidateGraph,
  candidateProjectionResponse,
  readCandidateNode,
  rejectCandidateSelectorParameters,
} from '../../../_candidate-v2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const selectorError = rejectCandidateSelectorParameters(request);
  if (selectorError) return selectorError;

  const { id } = await props.params;
  if (!id || id.length > 200) {
    return NextResponse.json(
      { error: 'Invalid canonical knowledge node id.', code: 'CANDIDATE_GRAPH_INVALID_NODE_ID' },
      { status: 400 },
    );
  }

  try {
    const authorization = await authorizeCandidateGraph();
    if (!authorization.ok) return authorization.response;
    return candidateProjectionResponse(
      await readCandidateNode(authorization.role, id),
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Candidate authoritative node request failed:', error);
    return NextResponse.json(
      { error: 'Candidate node request failed.', code: 'CANDIDATE_GRAPH_INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

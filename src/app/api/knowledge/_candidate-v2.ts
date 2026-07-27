import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import {
  AuthoritativeKnowledgeProjectionService,
  type KnowledgeRole,
  type ProjectionResult,
} from '@/lib/authoritative-knowledge';
import {
  CANDIDATE_GRAPH_SUPPORT,
  CANDIDATE_RELEASE_SELECTOR,
} from '@/features/knowledge/candidate-graph-contracts';
import {
  isCandidateGraphPubliclyActivated,
  resolveCandidateGraphAccess,
} from '@/features/knowledge/candidate-graph-policy';

const projectionService = new AuthoritativeKnowledgeProjectionService();

export async function authorizeCandidateGraph(): Promise<
  | { ok: true; role: KnowledgeRole }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'CANDIDATE_GRAPH_UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }

  const access = resolveCandidateGraphAccess(
    session.user.role,
    isCandidateGraphPubliclyActivated(),
  );
  if (!access.allowed || !access.role) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden', code: 'CANDIDATE_GRAPH_FORBIDDEN' },
        { status: 403 },
      ),
    };
  }
  return { ok: true, role: access.role };
}

export function rejectCandidateSelectorParameters(request: Request): NextResponse | null {
  const parameters = new URL(request.url).searchParams;
  if (parameters.has('authorityState')
    || parameters.has('releaseSetId')
    || parameters.has('releaseId')) {
    return NextResponse.json(
      {
        error: 'Candidate selector is fixed by the server.',
        code: 'CANDIDATE_GRAPH_SELECTOR_FIXED',
      },
      { status: 400 },
    );
  }
  return null;
}

export function candidateProjectionResponse<T>(
  result: ProjectionResult<T>,
): NextResponse {
  if (result.status === 'available') {
    return NextResponse.json(result.projection);
  }
  if (result.status === 'drift') {
    return NextResponse.json(
      { error: 'Candidate graph release drift detected.', code: 'CANDIDATE_GRAPH_DRIFT' },
      { status: 409 },
    );
  }
  if (result.reason === 'node-not-found' || result.reason === 'candidate-not-found') {
    return NextResponse.json(
      { error: 'Candidate graph data not found.', code: 'CANDIDATE_GRAPH_NOT_FOUND' },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: 'Candidate graph is unavailable.', code: 'CANDIDATE_GRAPH_UNAVAILABLE' },
    { status: 503 },
  );
}

export function readCandidateCanvas() {
  return projectionService.canvas(CANDIDATE_RELEASE_SELECTOR, CANDIDATE_GRAPH_SUPPORT);
}

export function readCandidateNode(role: KnowledgeRole, nodeId: string) {
  return projectionService.nodeDetail(
    CANDIDATE_RELEASE_SELECTOR,
    role,
    nodeId,
    CANDIDATE_GRAPH_SUPPORT,
  );
}

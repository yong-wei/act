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
  forbiddenIdentitySelectorFromRequest,
  knowledgeSurfaceFromCandidateProjection,
  withKnowledgeSurface,
} from '@/lib/knowledge-surface';
import type { KnowledgeSurfaceKind } from '@/lib/knowledge-surface';
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
  const parameter = forbiddenIdentitySelectorFromRequest(request);
  if (!parameter) return null;
  return NextResponse.json(
    {
      error: 'Candidate selector is fixed by the server.',
      code: 'CANDIDATE_GRAPH_SELECTOR_FIXED',
      parameter,
    },
    { status: 400 },
  );
}

export function candidateProjectionResponse<T extends object>(
  result: ProjectionResult<T>,
  context: { role: KnowledgeRole; surfaceKey: string; kind?: KnowledgeSurfaceKind },
): NextResponse {
  if (result.status === 'available') {
    const projection = result.projection as T & {
      source?: Parameters<typeof knowledgeSurfaceFromCandidateProjection>[0]['source'];
    };
    const source = projection.source ?? {
      ...CANDIDATE_RELEASE_SELECTOR,
      productionAuthoritative: false as const,
      historical: false,
    };
    const surface = knowledgeSurfaceFromCandidateProjection({
      source,
      role: context.role,
      kind: context.kind,
      surfaceKey: context.surfaceKey,
    });
    return NextResponse.json(
      surface.status === 'ok'
        ? withKnowledgeSurface(projection, surface.knowledgeSurface)
        : projection,
    );
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

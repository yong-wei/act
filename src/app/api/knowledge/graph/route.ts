import { NextResponse } from 'next/server';
import {
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  loadKnowledgeGraphData,
  loadKnowledgeGraphRootData,
  toPublicKnowledgeGraphPayload,
  type UnifiedKnowledgeGraphPayload,
} from '@/lib/knowledge-graph-source';
import { RuntimeKnowledgeRelationCoverageError, toPublicRuntimeKnowledgeDiagnostics } from '@/lib/knowledge-graph-relation-runtime';
import { resolveExactRuntimeLessonContext } from '@/lib/knowledge-lesson-context';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  knowledgeSurfaceFromLegacyGraph,
  knowledgeSurfaceSelectorRejection,
  withKnowledgeSurface,
} from '@/lib/knowledge-surface';
import type { KnowledgeSurfaceKind } from '@/lib/knowledge-surface';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function legacyGraphResponse(
  payload: object,
  graph: Pick<UnifiedKnowledgeGraphPayload, 'source' | 'versionDigest'>,
  kind: KnowledgeSurfaceKind,
  surfaceKey: string,
) {
  const surface = knowledgeSurfaceFromLegacyGraph({
    source: graph.source,
    versionDigest: graph.versionDigest,
    kind,
    surfaceKey,
  });
  return NextResponse.json(
    surface.status === 'ok' ? withKnowledgeSurface(payload, surface.knowledgeSurface) : payload,
  );
}

export async function GET(request: Request) {
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');
    if (mode && !['manifest', 'root', 'expansion', 'active-filter', 'remaining'].includes(mode)) {
      return NextResponse.json({ error: 'Unknown graph mode.' }, { status: 400 });
    }

    if (mode === 'root') {
      const requestedLessonIds = searchParams.getAll('lessonId');
      const graph = await loadKnowledgeGraphRootData();
      const lessonContext = await resolveExactRuntimeLessonContext(
        requestedLessonIds.length === 1 ? requestedLessonIds[0] : null,
        graph
      );
      return legacyGraphResponse(
        { ...buildKnowledgeGraphRootPayload(graph), lessonContext },
        graph,
        'root',
        'legacy-root',
      );
    }

    const domainId = searchParams.get('domainId');
    if (mode === 'expansion' && !domainId) {
      return NextResponse.json(
        { error: 'Missing domainId for domain expansion shard.' },
        { status: 400 }
      );
    }
    if (mode === 'expansion' && !domainId!.startsWith('chapter-node:')) {
      return NextResponse.json(
        { error: 'Invalid domainId for domain expansion shard.' },
        { status: 400 }
      );
    }

    const graph = await loadKnowledgeGraphData();
    if (mode === 'manifest') {
      return legacyGraphResponse(
        buildKnowledgeGraphManifestPayload(graph),
        graph,
        'search',
        'legacy-manifest',
      );
    }
    if (mode === 'expansion') {
      const rootCatalog = buildKnowledgeGraphRootPayload(graph).rootSummaries ?? [];
      if (!rootCatalog.some((entry) => entry.rootId === domainId)) {
        return NextResponse.json({ error: 'Knowledge graph domain not found.' }, { status: 404 });
      }
      return legacyGraphResponse(
        buildKnowledgeGraphExpansionPayload(graph, domainId!),
        graph,
        'domain',
        domainId!,
      );
    }
    if (mode === 'active-filter') {
      return legacyGraphResponse(
        buildKnowledgeGraphActiveFilterPayload(graph),
        graph,
        'search',
        'legacy-active-filter',
      );
    }
    if (mode === 'remaining') {
      return legacyGraphResponse(
        buildKnowledgeGraphRemainingPayload(graph),
        graph,
        'search',
        'legacy-remaining',
      );
    }

    return legacyGraphResponse(
      toPublicKnowledgeGraphPayload(graph),
      graph,
      'root',
      'legacy-graph',
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof RuntimeKnowledgeRelationCoverageError) {
      console.error('Knowledge graph relation coverage blocked:', error.report.diagnostics);
      return NextResponse.json({
        error: 'Knowledge graph relation coverage blocked',
        code: 'KNOWLEDGE_RELATION_COVERAGE_BLOCKED',
        ...toPublicRuntimeKnowledgeDiagnostics(error.report),
      }, { status: 422 });
    }
    console.error('Error fetching knowledge graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}

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
} from '@/lib/knowledge-graph-source';
import { RuntimeKnowledgeRelationCoverageError, toPublicRuntimeKnowledgeDiagnostics } from '@/lib/knowledge-graph-relation-runtime';
import { resolveExactRuntimeLessonContext } from '@/lib/knowledge-lesson-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
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
      return NextResponse.json({
        ...buildKnowledgeGraphRootPayload(graph),
        lessonContext,
      });
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
      return NextResponse.json(buildKnowledgeGraphManifestPayload(graph));
    }
    if (mode === 'expansion') {
      const rootCatalog = buildKnowledgeGraphRootPayload(graph).rootSummaries ?? [];
      if (!rootCatalog.some((entry) => entry.rootId === domainId)) {
        return NextResponse.json({ error: 'Knowledge graph domain not found.' }, { status: 404 });
      }
      return NextResponse.json(buildKnowledgeGraphExpansionPayload(graph, domainId!));
    }
    if (mode === 'active-filter') {
      return NextResponse.json(buildKnowledgeGraphActiveFilterPayload(graph));
    }
    if (mode === 'remaining') {
      return NextResponse.json(buildKnowledgeGraphRemainingPayload(graph));
    }

    return NextResponse.json(toPublicKnowledgeGraphPayload(graph));
  } catch (error) {
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

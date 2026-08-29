import { NextResponse } from 'next/server';
import { filterKnowledgeNodes, loadKnowledgeGraphData, toPublicKnowledgeGraphNode } from '@/lib/knowledge-graph-source';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { RuntimeKnowledgeRelationCoverageError, toPublicRuntimeKnowledgeDiagnostics } from '@/lib/knowledge-graph-relation-runtime';
import { knowledgeSurfaceSelectorRejection } from '@/lib/knowledge-surface';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const rejected = knowledgeSurfaceSelectorRejection(request);
  if (rejected) return rejected;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const bloom = searchParams.get('bloom');
    const graph = await loadKnowledgeGraphData();
    const nodes = filterKnowledgeNodes(graph.nodes, { type, bloom, search })
      .map(toPublicKnowledgeGraphNode);
    return NextResponse.json(nodes);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof RuntimeKnowledgeRelationCoverageError) {
      return NextResponse.json({
        error: 'Knowledge graph relation coverage blocked',
        code: 'KNOWLEDGE_RELATION_COVERAGE_BLOCKED',
        ...toPublicRuntimeKnowledgeDiagnostics(error.report),
      }, { status: 422 });
    }
    console.error('Error fetching knowledge nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge nodes' },
      { status: 500 }
    );
  }
}

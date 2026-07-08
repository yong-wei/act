import { NextResponse } from 'next/server';
import {
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  loadKnowledgeGraphData,
} from '@/lib/knowledge-graph-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const graph = await loadKnowledgeGraphData();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'manifest') {
      return NextResponse.json(buildKnowledgeGraphManifestPayload(graph));
    }
    if (mode === 'root') {
      return NextResponse.json(buildKnowledgeGraphRootPayload(graph));
    }
    if (mode === 'expansion') {
      return NextResponse.json(buildKnowledgeGraphExpansionPayload(graph, searchParams.get('nodeId') ?? ''));
    }
    if (mode === 'active-filter') {
      return NextResponse.json(buildKnowledgeGraphActiveFilterPayload(graph));
    }
    if (mode === 'remaining') {
      return NextResponse.json(buildKnowledgeGraphRemainingPayload(graph));
    }

    return NextResponse.json(graph);
  } catch (error) {
    console.error('Error fetching knowledge graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}

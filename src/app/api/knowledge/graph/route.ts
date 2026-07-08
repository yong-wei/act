import { NextResponse } from 'next/server';
import {
  buildKnowledgeGraphActiveFilterPayload,
  buildKnowledgeGraphExpansionPayload,
  buildKnowledgeGraphManifestPayload,
  buildKnowledgeGraphRemainingPayload,
  buildKnowledgeGraphRootPayload,
  loadKnowledgeGraphData,
  loadKnowledgeGraphRootData,
} from '@/lib/knowledge-graph-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'root') {
      const graph = await loadKnowledgeGraphRootData();
      return NextResponse.json(buildKnowledgeGraphRootPayload(graph));
    }

    if (mode === 'expansion' && !searchParams.get('nodeId')) {
      return NextResponse.json(
        { error: 'Missing nodeId for expansion shard.' },
        { status: 400 }
      );
    }

    const graph = await loadKnowledgeGraphData();
    if (mode === 'manifest') {
      return NextResponse.json(buildKnowledgeGraphManifestPayload(graph));
    }
    if (mode === 'expansion') {
      return NextResponse.json(buildKnowledgeGraphExpansionPayload(graph, searchParams.get('nodeId')!));
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

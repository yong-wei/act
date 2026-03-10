import { NextResponse } from 'next/server';
import { loadKnowledgeGraphData } from '@/lib/knowledge-graph-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const graph = await loadKnowledgeGraphData();
    return NextResponse.json(graph);
  } catch (error) {
    console.error('Error fetching knowledge graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}

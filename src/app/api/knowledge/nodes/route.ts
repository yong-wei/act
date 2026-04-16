import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { KnowledgeNodeType, BloomLevel } from '@prisma/client';
import { filterKnowledgeNodes, loadKnowledgeGraphData } from '@/lib/knowledge-graph-source';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const bloom = searchParams.get('bloom');

    const graph = await loadKnowledgeGraphData();
    if (graph.source === 'file') {
      const nodes = filterKnowledgeNodes(graph.nodes, { type, bloom, search });
      return NextResponse.json(nodes);
    }

    const where: any = {
      isActive: true,
    };

    if (type) {
      where.nodeType = type as KnowledgeNodeType;
    }

    if (bloom) {
      where.bloomLevel = bloom as BloomLevel;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } } // Search within tags array
      ];
    }

    const nodes = await prisma.knowledgeNode.findMany({
      where,
      select: {
        id: true,
        name: true,
        nodeType: true,
        description: true,
        bloomLevel: true,
        knowledgeDim: true,
        positionX: true,
        positionY: true,
        positionZ: true,
        metadata: true,
        content: true,
        resources: true,
        tags: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(nodes);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching knowledge nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge nodes' },
      { status: 500 }
    );
  }
}

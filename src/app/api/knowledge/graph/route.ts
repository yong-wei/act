
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Fetch nodes
    const nodes = await prisma.knowledgeNode.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        nodeType: true,
        description: true,
        positionX: true,
        positionY: true,
        positionZ: true,
        bloomLevel: true, // For filtering/coloring in frontend
        knowledgeDim: true,
      },
    });

    // Fetch links
    const links = await prisma.knowledgeLink.findMany({
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relation: true,
      },
    });

    return NextResponse.json({
      nodes,
      links,
    });
  } catch (error) {
    console.error('Error fetching knowledge graph data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch graph data' },
      { status: 500 }
    );
  }
}

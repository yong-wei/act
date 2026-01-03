import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const node = await prisma.knowledgeNode.findUnique({
      where: { id: params.id },
      include: {
        // 当前节点作为源的关系（当前节点 → 其他节点）
        sourceLinks: {
          include: {
            targetNode: {
              select: {
                id: true,
                name: true,
                nodeType: true,
              }
            }
          }
        },
        // 当前节点作为目标的关系（其他节点 → 当前节点）
        targetLinks: {
          include: {
            sourceNode: {
              select: {
                id: true,
                name: true,
                nodeType: true,
              }
            }
          }
        }
      }
    });

    if (!node) {
      return NextResponse.json({ error: 'Knowledge node not found' }, { status: 404 });
    }

    // 构建关联知识点列表
    const relatedNodes = [
      // 前置知识点：其他节点指向当前节点，relation 为 prerequisite 或 provides_foundation
      ...node.targetLinks
        .filter(link => link.relation === 'prerequisite' || link.relation === 'provides_foundation')
        .map(link => ({
          id: link.sourceNode.id,
          name: link.sourceNode.name,
          nodeType: link.sourceNode.nodeType,
          relation: link.relation,
          category: 'prerequisite' as const,
        })),
      // 后置知识点：当前节点指向其他节点，relation 为 follows
      ...node.sourceLinks
        .filter(link => link.relation === 'follows')
        .map(link => ({
          id: link.targetNode.id,
          name: link.targetNode.name,
          nodeType: link.targetNode.nodeType,
          relation: link.relation,
          category: 'follows' as const,
        })),
      // 关联知识点：其他所有关系
      ...node.sourceLinks
        .filter(link => link.relation !== 'follows')
        .map(link => ({
          id: link.targetNode.id,
          name: link.targetNode.name,
          nodeType: link.targetNode.nodeType,
          relation: link.relation,
          category: 'related' as const,
        })),
      ...node.targetLinks
        .filter(link => link.relation !== 'prerequisite' && link.relation !== 'provides_foundation')
        .map(link => ({
          id: link.sourceNode.id,
          name: link.sourceNode.name,
          nodeType: link.sourceNode.nodeType,
          relation: link.relation,
          category: 'related' as const,
        })),
    ];

    // 去重（可能存在双向关系）
    const uniqueRelatedNodes = relatedNodes.filter((node, index, self) =>
      index === self.findIndex(n => n.id === node.id)
    );

    return NextResponse.json({
      ...node,
      relatedNodes: uniqueRelatedNodes,
    });
  } catch (error) {
    console.error('Error fetching knowledge node:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  buildKnowledgeNodeDetailFromGraph,
  loadKnowledgeGraphData,
} from '@/lib/knowledge-graph-source';
import { RuntimeKnowledgeRelationCoverageError, toPublicRuntimeKnowledgeDiagnostics } from '@/lib/knowledge-graph-relation-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!params.id || params.id.length > 200) {
    return NextResponse.json({ error: 'Invalid canonical knowledge node id' }, { status: 400 });
  }
  try {
    const graph = await loadKnowledgeGraphData();
    const detail = buildKnowledgeNodeDetailFromGraph(graph, params.id);
    if (detail) {
      return NextResponse.json(detail);
    }
    return NextResponse.json({ error: 'Knowledge node not found' }, { status: 404 });
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
    console.error('Error fetching knowledge node:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查权限：仅 TEACHER 或 ADMIN 可编辑
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, metadata } = body;

    const node = await prisma.knowledgeNode.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(metadata !== undefined && { metadata }),
      },
    });

    return NextResponse.json(node);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error updating knowledge node:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

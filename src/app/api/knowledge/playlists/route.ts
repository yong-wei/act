
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Assuming authOptions is exported from here
import { BopppsStage, LessonItemType, UserRole } from '@prisma/client';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow public access for now for demonstration, or check session
    // In a real scenario, we might want to return public playlists + user's own playlists
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'my' or 'public'

    const where: any = {};
    
    if (mode === 'my' && session?.user?.id) {
       where.authorId = session.user.id;
    } else {
       // Default: fetch public playlists
       where.isPublic = true;
    }

    const playlists = await prisma.lessonPlan.findMany({
      where,
      include: {
        author: {
          select: { name: true, image: true }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(playlists);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching playlists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playlists' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id }
    });

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== UserRole.TEACHER && user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, isPublic, items } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const rawItems = Array.isArray(items) ? items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: '请至少选择一个知识节点' }, { status: 400 });
    }

    const knowledgeNodeIds = rawItems
      .map((item: { nodeId?: unknown; knowledgeNodeId?: unknown }) => item.knowledgeNodeId ?? item.nodeId)
      .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0);
    if (knowledgeNodeIds.length !== rawItems.length) {
      return NextResponse.json({ error: '课程流条目缺少知识节点 ID' }, { status: 400 });
    }

    const existingNodes = await prisma.knowledgeNode.findMany({
      where: { id: { in: knowledgeNodeIds }, isActive: true },
      select: { id: true, name: true, description: true },
    });
    const existingNodeIds = new Set(existingNodes.map((node) => node.id));
    const missingNodeId = knowledgeNodeIds.find((id: string) => !existingNodeIds.has(id));
    if (missingNodeId) {
      return NextResponse.json({ error: `知识节点不存在或不可用：${missingNodeId}` }, { status: 400 });
    }

    const playlist = await prisma.lessonPlan.create({
      data: {
        title,
        description,
        isPublic: isPublic || false,
        authorId: user.id,
        items: {
          create: rawItems.map((item: any, index: number) => {
            const knowledgeNodeId = item.knowledgeNodeId ?? item.nodeId;
            const node = existingNodes.find((candidate) => candidate.id === knowledgeNodeId);
            return {
              itemType: LessonItemType.KNOWLEDGE_NODE,
              knowledgeNodeId,
              stage: BopppsStage.PARTICIPATORY,
              order: index + 1,
              duration: Number.isFinite(Number(item.duration)) ? Math.max(1, Number(item.duration)) : 15,
              overrideConfig: {
                titleOverride: item.nodeName ?? node?.name,
                descriptionOverride: node?.description,
                interactionMode: item.interactionMode ?? 'lecture',
              },
            };
          }),
        },
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(playlist);

  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error creating playlist:', error);
    return NextResponse.json(
      { error: 'Failed to create playlist' },
      { status: 500 }
    );
  }
}

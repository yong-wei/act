
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage, LessonItemType } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { title, items } = body; // items: { itemType?, resourceId?, knowledgeNodeId?, stage, order, duration }[]

    if (!title) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const rawItems = Array.isArray(items) ? items : [];
    for (const item of rawItems) {
      const inferredType = item.knowledgeNodeId ? LessonItemType.KNOWLEDGE_NODE : LessonItemType.RESOURCE;
      const itemType = (item.itemType as LessonItemType | undefined) ?? inferredType;

      if (itemType === LessonItemType.RESOURCE && !item.resourceId) {
        return NextResponse.json({ error: 'Missing resourceId for RESOURCE item' }, { status: 400 });
      }
      if (itemType === LessonItemType.KNOWLEDGE_NODE && !item.knowledgeNodeId) {
        return NextResponse.json({ error: 'Missing knowledgeNodeId for KNOWLEDGE_NODE item' }, { status: 400 });
      }
    }

    const normalizedItems = rawItems.map((item: any) => {
      const inferredType = item.knowledgeNodeId ? LessonItemType.KNOWLEDGE_NODE : LessonItemType.RESOURCE;
      const itemType = (item.itemType as LessonItemType | undefined) ?? inferredType;

      return {
        itemType,
        resourceId: itemType === LessonItemType.RESOURCE ? item.resourceId : null,
        knowledgeNodeId: itemType === LessonItemType.KNOWLEDGE_NODE ? item.knowledgeNodeId : null,
        stage: item.stage as BopppsStage,
        order: item.order,
        duration: item.duration
      };
    });

    const plan = await prisma.lessonPlan.create({
      data: {
        title,
        authorId: user.id,
        items: {
            create: normalizedItems
        }
      }
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error creating lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

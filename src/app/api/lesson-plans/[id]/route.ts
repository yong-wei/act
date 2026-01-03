import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage, LessonItemType } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const plan = await prisma.lessonPlan.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: { resource: true, knowledgeNode: true },
          orderBy: [{ stage: 'asc' }, { order: 'asc' }]
        },
        author: { select: { name: true, email: true } }
      }
    });

    if (!plan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error fetching lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existingPlan = await prisma.lessonPlan.findUnique({
      where: { id: params.id },
      select: { authorId: true }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (existingPlan.authorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: not the plan owner' }, { status: 403 });
    }

    const body = await request.json();
    const { title, items } = body;
    const rawItems = Array.isArray(items) ? items : [];

    for (const item of rawItems) {
      const inferredType = item.knowledgeNodeId
        ? LessonItemType.KNOWLEDGE_NODE
        : LessonItemType.RESOURCE;
      const itemType = (item.itemType as LessonItemType | undefined) ?? inferredType;

      if (itemType === LessonItemType.RESOURCE && !item.resourceId) {
        return NextResponse.json({ error: 'Missing resourceId for RESOURCE item' }, { status: 400 });
      }
      if (itemType === LessonItemType.KNOWLEDGE_NODE && !item.knowledgeNodeId) {
        return NextResponse.json({ error: 'Missing knowledgeNodeId for KNOWLEDGE_NODE item' }, { status: 400 });
      }
    }

    // Use transaction to update plan and items atomically
    const updatedPlan = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.lessonItem.deleteMany({
        where: { planId: params.id }
      });

      // Update plan with new items
      return tx.lessonPlan.update({
        where: { id: params.id },
        data: {
          title: title || undefined,
          items: {
            create: rawItems.map((item: any) => {
              const inferredType = item.knowledgeNodeId
                ? LessonItemType.KNOWLEDGE_NODE
                : LessonItemType.RESOURCE;
              const itemType = (item.itemType as LessonItemType | undefined) ?? inferredType;

              return {
                itemType,
                resourceId: itemType === LessonItemType.RESOURCE ? item.resourceId : null,
                knowledgeNodeId: itemType === LessonItemType.KNOWLEDGE_NODE ? item.knowledgeNodeId : null,
                stage: item.stage as BopppsStage,
                order: item.order,
                duration: item.duration,
                overrideConfig: item.overrideConfig || {},
              };
            })
          }
        },
        include: {
          items: {
            include: { resource: true, knowledgeNode: true },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }]
          }
        }
      });
    });

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error('Error updating lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existingPlan = await prisma.lessonPlan.findUnique({
      where: { id: params.id },
      select: { authorId: true }
    });

    if (!existingPlan) {
      return NextResponse.json({ error: 'Lesson plan not found' }, { status: 404 });
    }

    if (existingPlan.authorId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: not the plan owner' }, { status: 403 });
    }

    // Delete plan (items will cascade delete due to schema relation)
    await prisma.lessonPlan.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

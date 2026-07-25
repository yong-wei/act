
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage, LessonItemType, Prisma } from '@prisma/client';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { EMPTY_LESSON_PLAN_MESSAGE, hasLaunchableLessonItems } from '@/lib/lesson-plan-readiness';
import { stripPresetRuntimeStepBinding } from '@/lib/lesson-plan-runtime-binding';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'ADMIN';
    const plans = await prisma.lessonPlan.findMany({
      where: isAdmin
        ? {}
        : {
          OR: [
            { authorId: session.user.id },
            { isPublic: true },
          ],
        },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        authorId: true,
        isPublic: true,
        isPreset: true,
      },
    });

    return NextResponse.json(plans);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching lesson plans:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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
    if (!hasLaunchableLessonItems(rawItems)) {
      return NextResponse.json({ error: EMPTY_LESSON_PLAN_MESSAGE }, { status: 400 });
    }

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
        duration: item.duration,
        overrideConfig: stripPresetRuntimeStepBinding(item.overrideConfig) as Prisma.InputJsonValue,
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
    rethrowIfNextDynamicError(error);
    console.error('Error creating lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

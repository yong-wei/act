import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage, LessonItemType, Prisma } from '@prisma/client';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { EMPTY_LESSON_PLAN_MESSAGE, hasLaunchableLessonItems } from '@/lib/lesson-plan-readiness';
import {
  buildLessonPlanDeleteConflictMessage,
  canDeleteLessonPlan,
} from '@/lib/lesson-plan-delete-policy';
import {
  readPresetRuntimeStepBinding,
  stripPresetRuntimeStepBinding,
  withPresetRuntimeStepBinding,
} from '@/lib/lesson-plan-runtime-binding';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    rethrowIfNextDynamicError(error);
    console.error('Error fetching lesson plan:', error);
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

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existingPlan = await prisma.lessonPlan.findUnique({
      where: { id: params.id },
      select: {
        authorId: true,
        items: {
          select: {
            id: true,
            overrideConfig: true,
          },
        },
      }
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
    if (!hasLaunchableLessonItems(rawItems)) {
      return NextResponse.json({ error: EMPTY_LESSON_PLAN_MESSAGE }, { status: 400 });
    }

    const existingItems = new Map(existingPlan.items.map((item) => [item.id, item]));
    const requestedExistingItemIds = new Set<string>();
    for (const item of rawItems) {
      if (item.id !== undefined) {
        if (
          typeof item.id !== 'string'
          || !existingItems.has(item.id)
          || requestedExistingItemIds.has(item.id)
        ) {
          return NextResponse.json({ error: 'Invalid lesson item id' }, { status: 400 });
        }
        requestedExistingItemIds.add(item.id);
      }
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
              const requestedOverrideConfig = stripPresetRuntimeStepBinding(item.overrideConfig);
              const existingItem = typeof item.id === 'string'
                ? existingItems.get(item.id)
                : null;
              const existingBinding = readPresetRuntimeStepBinding(existingItem?.overrideConfig);
              const overrideConfig = existingBinding.state === 'valid'
                ? withPresetRuntimeStepBinding(requestedOverrideConfig, existingBinding.binding)
                : requestedOverrideConfig;

              return {
                itemType,
                resourceId: itemType === LessonItemType.RESOURCE ? item.resourceId : null,
                knowledgeNodeId: itemType === LessonItemType.KNOWLEDGE_NODE ? item.knowledgeNodeId : null,
                stage: item.stage as BopppsStage,
                order: item.order,
                duration: item.duration,
                overrideConfig: overrideConfig as Prisma.InputJsonValue,
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
    rethrowIfNextDynamicError(error);
    console.error('Error updating lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    const referencedSessionCount = await prisma.classSession.count({
      where: { planId: params.id },
    });

    if (!canDeleteLessonPlan(referencedSessionCount)) {
      return NextResponse.json(
        { error: buildLessonPlanDeleteConflictMessage(referencedSessionCount) },
        { status: 409 }
      );
    }

    // Delete plan (items will cascade delete due to schema relation)
    await prisma.lessonPlan.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      let referencedSessionCount = 1;
      try {
        referencedSessionCount = await prisma.classSession.count({
          where: { planId: params.id },
        });
      } catch (countError) {
        console.warn('Failed to recount class sessions for plan deletion conflict:', countError);
      }

      return NextResponse.json(
        { error: buildLessonPlanDeleteConflictMessage(referencedSessionCount || 1) },
        { status: 409 }
      );
    }

    rethrowIfNextDynamicError(error);
    console.error('Error deleting lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

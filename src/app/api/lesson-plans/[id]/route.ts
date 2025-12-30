import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage } from '@prisma/client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const plan = await prisma.lessonPlan.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: { resource: true },
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
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
            create: items?.map((item: {
              resourceId: string;
              stage: string;
              order: number;
              duration?: number;
            }) => ({
              resourceId: item.resourceId,
              stage: item.stage as BopppsStage,
              order: item.order,
              duration: item.duration
            })) || []
          }
        },
        include: {
          items: {
            include: { resource: true },
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
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

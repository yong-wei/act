
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BopppsStage } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { title, items } = body; // items: { resourceId, stage, order, duration }[]

    if (!title) {
        return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const plan = await prisma.lessonPlan.create({
      data: {
        title,
        authorId: user.id,
        items: {
            create: items.map((item: any) => ({
                resourceId: item.resourceId,
                stage: item.stage as BopppsStage,
                order: item.order,
                duration: item.duration
            }))
        }
      }
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error('Error creating lesson plan:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

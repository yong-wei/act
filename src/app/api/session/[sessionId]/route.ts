
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentItemId, currentStage, status } = body;

    const updatedSession = await prisma.classSession.update({
      where: { id: params.sessionId },
      data: {
        currentItemId,
        currentStage,
        status // 'ACTIVE', 'PAUSED', 'FINISHED'
      }
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
    try {
        const session = await prisma.classSession.findUnique({
            where: { id: params.sessionId },
            select: {
                id: true,
                joinCode: true,
                status: true,
                currentItemId: true,
                currentStage: true,
                // Include minimal plan info for student check
                plan: {
                    select: { title: true }
                }
            }
        });
        
        if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(session);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

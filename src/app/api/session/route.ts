
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { planId } = body;

    if (!planId) return NextResponse.json({ error: 'Plan ID required' }, { status: 400 });

    // Generate Join Code (simple 6 digits)
    const joinCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newSession = await prisma.classSession.create({
      data: {
        joinCode,
        planId,
        teacherId: user.id,
        status: 'ACTIVE',
        // Initialize to first item
        currentStage: 'BRIDGE_IN',
        currentItemId: undefined // Will be set when first item is activated
      }
    });

    return NextResponse.json(newSession);
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

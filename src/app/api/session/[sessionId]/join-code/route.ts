import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateUniqueJoinCode } from '@/lib/join-code';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function PATCH(
  _request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingSession = await prisma.classSession.findUnique({
      where: { id: params.sessionId },
      select: { teacherId: true, status: true },
    });

    if (!existingSession) {
      return NextResponse.json({ error: '课堂不存在' }, { status: 404 });
    }

    if (existingSession.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限修改此课堂' }, { status: 403 });
    }

    if (existingSession.status !== 'ACTIVE') {
      return NextResponse.json({ error: '课堂已结束，无法重置入会码' }, { status: 409 });
    }

    const joinCode = await generateUniqueJoinCode(prisma);
    const updated = await prisma.classSession.update({
      where: { id: params.sessionId },
      data: { joinCode },
      select: { joinCode: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error regenerating join code:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

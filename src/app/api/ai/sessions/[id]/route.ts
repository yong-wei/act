/**
 * 控灵会话管理 API
 *
 * 删除会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/ai/sessions/[id]
 * 删除会话
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await context.params;

    // 验证会话所有权
    const konlingSession = await prisma.konlingSession.findUnique({
      where: { id: sessionId },
    });

    if (!konlingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (konlingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 删除会话
    await prisma.konlingSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/ai/sessions/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

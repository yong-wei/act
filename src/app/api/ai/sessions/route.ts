/**
 * 控灵会话 API
 *
 * 管理AI会话的创建和获取
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

const SESSION_EXPIRY_DAYS = 7;
export const dynamic = 'force-dynamic';

/**
 * GET /api/ai/sessions?courseId=X&pageId=Y
 * 获取或创建会话
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const pageId = searchParams.get('pageId');

    if (!courseId || !pageId) {
      return NextResponse.json(
        { error: 'Missing courseId or pageId' },
        { status: 400 }
      );
    }

    // 查找现有会话
    const existingSession = await prisma.konlingSession.findFirst({
      where: {
        userId: session.user.id,
        courseId,
        pageId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingSession) {
      return NextResponse.json({
        id: existingSession.id,
        userId: existingSession.userId,
        courseId: existingSession.courseId,
        pageId: existingSession.pageId,
        title: existingSession.title,
        messages: existingSession.messages as Record<string, unknown>[],
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
        expiresAt: existingSession.expiresAt,
      });
    }

    // 创建新会话
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    const newSession = await prisma.konlingSession.create({
      data: {
        userId: session.user.id,
        courseId,
        pageId,
        title: `${courseId} - ${pageId}`,
        messages: [],
        expiresAt,
      },
    });

    return NextResponse.json({
      id: newSession.id,
      userId: newSession.userId,
      courseId: newSession.courseId,
      pageId: newSession.pageId,
      title: newSession.title,
      messages: [],
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
      expiresAt: newSession.expiresAt,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in GET /api/ai/sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/sessions
 * 创建新会话
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, pageId, title, pageContext } = body;

    if (!courseId || !pageId) {
      return NextResponse.json(
        { error: 'Missing courseId or pageId' },
        { status: 400 }
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    const newSession = await prisma.konlingSession.create({
      data: {
        userId: session.user.id,
        courseId,
        pageId,
        title: title || `${courseId} - ${pageId}`,
        messages: [],
        expiresAt,
      },
    });

    return NextResponse.json({
      id: newSession.id,
      userId: newSession.userId,
      courseId: newSession.courseId,
      pageId: newSession.pageId,
      title: newSession.title,
      messages: [],
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
      expiresAt: newSession.expiresAt,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error in POST /api/ai/sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

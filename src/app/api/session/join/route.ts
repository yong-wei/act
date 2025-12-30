import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 根据入会码查找课堂会话
 * GET /api/session/join?code=123456
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const joinCode = searchParams.get('code');

    if (!joinCode || joinCode.length !== 6) {
      return NextResponse.json(
        { error: '请输入有效的6位入会码' },
        { status: 400 }
      );
    }

    const session = await prisma.classSession.findUnique({
      where: { joinCode },
      select: {
        id: true,
        joinCode: true,
        status: true,
        currentStage: true,
        currentItemId: true,
        plan: {
          select: {
            id: true,
            title: true,
          },
        },
        teacher: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: '未找到该入会码对应的课堂' },
        { status: 404 }
      );
    }

    if (session.status === 'FINISHED') {
      return NextResponse.json(
        { error: '该课堂已结束' },
        { status: 410 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error finding session by join code:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

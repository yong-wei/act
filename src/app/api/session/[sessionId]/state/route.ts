import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST: 学生提交状态数据
 * GET: 教师获取所有学生状态（用于数据大屏）
 */

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
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

    const body = await request.json();
    const { itemId, data } = body;

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // Upsert: 更新或创建学生状态
    const studentState = await prisma.studentState.upsert({
      where: {
        sessionId_userId: {
          sessionId: params.sessionId,
          userId: user.id
        }
      },
      update: {
        itemId,
        data,
        submittedAt: new Date()
      },
      create: {
        sessionId: params.sessionId,
        userId: user.id,
        itemId,
        data
      }
    });

    return NextResponse.json(studentState);
  } catch (error) {
    console.error('Error submitting student state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取所有学生状态
    const states = await prisma.studentState.findMany({
      where: { sessionId: params.sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // 计算统计信息
    const summary = {
      totalStudents: states.length,
      latestUpdate: states[0]?.submittedAt || null
    };

    return NextResponse.json({ states, summary });
  } catch (error) {
    console.error('Error fetching student states:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

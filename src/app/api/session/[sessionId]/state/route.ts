import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logClassroomEvent } from '@/lib/classroom-observability';

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
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

    if (itemId === 'student:presence' || itemId === 'teacher:course-sync') {
      logClassroomEvent('session_state_post', {
        sessionId: params.sessionId,
        userId: user.id,
        itemId,
      });
    }

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    if (scope === 'self') {
      const state = await prisma.studentState.findUnique({
        where: {
          sessionId_userId: {
            sessionId: params.sessionId,
            userId: session.user.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        states: state ? [state] : [],
        summary: {
          totalStudents: state ? 1 : 0,
          latestUpdate: state?.submittedAt || null,
        },
      });
    }

    if (scope === 'student-view') {
      const [selfState, teacherSyncState, participantStates] = await Promise.all([
        prisma.studentState.findUnique({
          where: {
            sessionId_userId: {
              sessionId: params.sessionId,
              userId: session.user.id,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.studentState.findFirst({
          where: {
            sessionId: params.sessionId,
            itemId: 'teacher:course-sync',
          },
          orderBy: { submittedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.studentState.findMany({
          where: { sessionId: params.sessionId },
          select: {
            itemId: true,
            submittedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { submittedAt: 'desc' },
        }),
      ]);

      const states = [
        teacherSyncState,
        selfState,
        ...participantStates.filter((item) => item.user.id !== session.user.id),
      ].filter(Boolean);

      return NextResponse.json({
        states,
        summary: {
          totalStudents: participantStates.length,
          latestUpdate: participantStates[0]?.submittedAt || teacherSyncState?.submittedAt || selfState?.submittedAt || null,
        },
      });
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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logClassroomEvent } from '@/lib/classroom-observability';
import type { ClassroomStateMutationInput } from '@/lib/classroom-analytics/types';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

function toDateTime(value: number | string | null | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function resolveStateKey(itemId: string | null | undefined, explicitStateKey: string | null | undefined) {
  if (explicitStateKey && explicitStateKey.trim().length > 0) {
    return explicitStateKey;
  }

  if (itemId === 'teacher:course-sync') {
    return 'teacher-sync';
  }

  return 'course';
}

/**
 * POST: 学生提交状态数据
 * GET: 教师获取所有学生状态（用于数据大屏）
 */

export async function POST(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json()) as ClassroomStateMutationInput;
    const { itemId, data, lessonKey } = body;
    const stateKey = resolveStateKey(itemId, body.stateKey);
    const lastClientEventAt = toDateTime(body.clientEventAt);

    if (!data) {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // Upsert: 更新或创建学生状态
    const studentState = await prisma.studentState.upsert({
      where: {
        sessionId_userId_stateKey: {
          sessionId: params.sessionId,
          userId: user.id,
          stateKey,
        }
      },
      update: {
        stateKey,
        lessonKey: lessonKey || null,
        itemId,
        data,
        submittedAt: new Date(),
        lastClientEventAt,
      },
      create: {
        sessionId: params.sessionId,
        userId: user.id,
        stateKey,
        lessonKey: lessonKey || null,
        itemId,
        data,
        lastClientEventAt,
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
    rethrowIfNextDynamicError(error);
    console.error('Error submitting student state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const courseStateKey = 'course';
    const teacherStateKey = 'teacher-sync';

    if (scope === 'teacher-view') {
      const [courseStates, teacherStates] = await Promise.all([
        prisma.studentState.findMany({
          where: {
            sessionId: params.sessionId,
            stateKey: courseStateKey,
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
          orderBy: { submittedAt: 'desc' },
        }),
        prisma.studentState.findMany({
          where: {
            sessionId: params.sessionId,
            stateKey: teacherStateKey,
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
          orderBy: { submittedAt: 'desc' },
        }),
      ]);

      const latestUpdate =
        courseStates[0]?.submittedAt ||
        teacherStates[0]?.submittedAt ||
        null;

      return NextResponse.json({
        states: courseStates,
        courseStates,
        teacherStates,
        summary: {
          totalStudents: courseStates.length,
          latestUpdate,
        },
      });
    }

    if (scope === 'self') {
      const state = await prisma.studentState.findUnique({
        where: {
          sessionId_userId_stateKey: {
            sessionId: params.sessionId,
            userId: session.user.id,
            stateKey: courseStateKey,
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
        courseStates: state ? [state] : [],
        teacherStates: [],
        summary: {
          totalStudents: state ? 1 : 0,
          latestUpdate: state?.submittedAt || null,
        },
      });
    }

    if (scope === 'student-view') {
      const [selfState, teacherSyncState, totalStudents] = await Promise.all([
        prisma.studentState.findUnique({
          where: {
            sessionId_userId_stateKey: {
              sessionId: params.sessionId,
              userId: session.user.id,
              stateKey: courseStateKey,
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
            stateKey: teacherStateKey,
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
        prisma.studentState.count({
          where: {
            sessionId: params.sessionId,
            stateKey: courseStateKey,
          },
        }),
      ]);

      const states = [teacherSyncState, selfState].filter(Boolean);

      return NextResponse.json({
        states,
        courseStates: selfState ? [selfState] : [],
        teacherStates: teacherSyncState ? [teacherSyncState] : [],
        summary: {
          totalStudents,
          latestUpdate: teacherSyncState?.submittedAt || selfState?.submittedAt || null,
        },
      });
    }

    // 获取所有学生状态
    const [states, teacherStates] = await Promise.all([
      prisma.studentState.findMany({
        where: {
          sessionId: params.sessionId,
          stateKey: courseStateKey,
        },
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
      }),
      prisma.studentState.findMany({
        where: {
          sessionId: params.sessionId,
          stateKey: teacherStateKey,
        },
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
      }),
    ]);

    // 计算统计信息
    const summary = {
      totalStudents: states.length,
      latestUpdate: states[0]?.submittedAt || teacherStates[0]?.submittedAt || null
    };

    return NextResponse.json({ states, courseStates: states, teacherStates, summary });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('Error fetching student states:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

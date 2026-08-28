import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logClassroomEvent } from '@/lib/classroom-observability';
import { buildClassroomIdentityPayload } from '@/lib/classroom-lifecycle-contract';
import type { ClassroomStateRuntime } from '../application/state';

const courseStateKey = 'course';
const teacherStateKey = 'teacher-sync';

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const;

export function createPrismaClassroomStateRuntime(): ClassroomStateRuntime {
  return {
    loadUser: async (id) => prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        profile: { select: { classId: true } },
      },
    }),
    loadSessionAccess: async (sessionId) => prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, classId: true },
    }),
    loadTeacherViewSession: async (sessionId) => prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        teacherId: true,
        joinCode: true,
        status: true,
        classId: true,
        currentItemId: true,
        currentStage: true,
        plan: { select: { title: true } },
        class: {
          select: {
            name: true,
            students: {
              select: {
                user: {
                  select: userSelect,
                },
              },
            },
          },
        },
      },
    }),
    listCourseStates: async (sessionId) => prisma.studentState.findMany({
      where: { sessionId, stateKey: courseStateKey },
      include: { user: { select: userSelect } },
      orderBy: { submittedAt: 'desc' },
    }),
    listTeacherStates: async (sessionId) => prisma.studentState.findMany({
      where: { sessionId, stateKey: teacherStateKey },
      include: { user: { select: userSelect } },
      orderBy: { submittedAt: 'desc' },
    }),
    loadSelfState: async (sessionId, userId) => prisma.studentState.findUnique({
      where: {
        sessionId_userId_stateKey: {
          sessionId,
          userId,
          stateKey: courseStateKey,
        },
      },
      include: { user: { select: userSelect } },
    }),
    loadLatestTeacherSync: async (sessionId) => prisma.studentState.findFirst({
      where: {
        sessionId,
        stateKey: teacherStateKey,
        itemId: 'teacher:course-sync',
      },
      orderBy: { submittedAt: 'desc' },
      include: { user: { select: userSelect } },
    }),
    upsertStudentState: async (input) => prisma.studentState.upsert({
      where: {
        sessionId_userId_stateKey: {
          sessionId: input.sessionId,
          userId: input.userId,
          stateKey: input.stateKey,
        },
      },
      update: {
        stateKey: input.stateKey,
        lessonKey: input.lessonKey,
        itemId: input.itemId,
        data: input.data as Prisma.InputJsonValue,
        submittedAt: new Date(),
        lastClientEventAt: input.lastClientEventAt,
      },
      create: {
        sessionId: input.sessionId,
        userId: input.userId,
        stateKey: input.stateKey,
        lessonKey: input.lessonKey,
        itemId: input.itemId,
        data: input.data as Prisma.InputJsonValue,
        lastClientEventAt: input.lastClientEventAt,
      },
    }),
    buildIdentity: (session) => buildClassroomIdentityPayload(session),
    logState: (payload) => {
      logClassroomEvent('session_state_post', payload);
    },
  };
}

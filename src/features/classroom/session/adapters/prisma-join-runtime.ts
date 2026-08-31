import { prisma } from '@/lib/prisma';
import { buildSessionParticipantHref, resolveSessionRouteSegment } from '@/lib/classroom-session-route';
import { logClassroomEvent } from '@/lib/classroom-observability';
import type { ClassroomJoinRuntime } from '../application/join';

export function createPrismaClassroomJoinRuntime(): ClassroomJoinRuntime {
  return {
    findByJoinCode: async (joinCode) => prisma.classSession.findUnique({
      where: { joinCode },
      select: {
        id: true,
        joinCode: true,
        status: true,
        currentStage: true,
        currentItemId: true,
        classId: true,
        plan: { select: { id: true, title: true } },
        teacher: { select: { name: true } },
        class: { select: { name: true } },
        courseBundleRevisionId: true,
        courseBundleRevision: { select: { canonicalLessonId: true } },
      },
    }),
    getStudentClassId: async (userId) => {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { classId: true },
      });
      return profile?.classId ?? null;
    },
    resolveRoute: ({ bundleCanonicalLessonId, bundleBound, planTitle, sessionId }) => {
      const routeInfo = resolveSessionRouteSegment({
        bundleCanonicalLessonId,
        bundleBound,
        planTitle,
      });
      return {
        routeSegment: routeInfo.routeSegment,
        studentHref: buildSessionParticipantHref({
          role: 'student',
          sessionId,
          planTitle,
          bundleCanonicalLessonId,
          bundleBound,
        }),
        teacherHref: buildSessionParticipantHref({
          role: 'teacher',
          sessionId,
          planTitle,
          bundleCanonicalLessonId,
          bundleBound,
        }),
      };
    },
    logJoin: (payload) => {
      logClassroomEvent('session_join_lookup', payload);
    },
  };
}

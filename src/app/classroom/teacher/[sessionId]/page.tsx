
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { TeacherPlayer } from '@/features/lesson-engine/teacher-player';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';
import { buildClassroomIdentityPayload } from '@/lib/classroom-lifecycle-contract';
import { canManageClassroomSession, isClassroomTeacherOrAdmin } from '@/lib/classroom-session-access';
import { resolveGeneratedCoursewareSessionBinding } from '@/lib/smart-courseware/classroom-runtime';
import { GeneratedCoursewareRecoveryState } from '@/features/lesson-engine/generated-courseware-recovery';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function TeacherSessionPage(props: PageProps) {
  const params = await props.params;
  const userSession = await getServerSession(authOptions);
  if (!userSession?.user?.id) {
    redirect('/login');
  }
  if (!isClassroomTeacherOrAdmin(userSession.user.role)) {
    notFound();
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      plan: {
        include: {
          items: {
            include: { resource: true, knowledgeNode: true },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }] // Need to confirm Enum order logic or mapping
          },
        },
      },
      class: {
        select: { name: true },
      },
      courseBundleRevision: {
        select: { canonicalLessonId: true },
      },
    }
  });

  if (!session) notFound();
  if (!canManageClassroomSession(session, userSession.user)) {
    notFound();
  }
  const generatedResolution = await resolveGeneratedCoursewareSessionBinding(prisma, session);
  if (!generatedResolution.ok) {
    return <GeneratedCoursewareRecoveryState recovery={generatedResolution.recovery} />;
  }

  const teacherHref = buildSessionParticipantHref({
    role: 'teacher',
    sessionId: session.id,
    planTitle: session.plan.title,
    bundleCanonicalLessonId: session.courseBundleRevision?.canonicalLessonId ?? null,
    bundleBound: session.courseBundleRevisionId !== null,
  });
  if (teacherHref !== `/classroom/teacher/${session.id}`) {
    redirect(teacherHref);
  }
  if (session.status === 'FINISHED') {
    redirect(`/classroom/teacher/${session.id}/review`);
  }

  // Prisma Enum ordering is by definition order in schema. 
  // We should manually sort if needed, but 'asc' on Enum might work based on definition index.
  // To be safe, we rely on the returned order or handle it in client.

  // Re-sort items logically in JS to be safe
  const stageOrder = ['BRIDGE_IN', 'OBJECTIVE', 'PRE_ASSESSMENT', 'PARTICIPATORY', 'POST_ASSESSMENT', 'SUMMARY'];
  const sortedItems = session.plan.items.sort((a, b) => {
      const stageDiff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return a.order - b.order;
  });

  // 显式构建 session 对象，确保 joinCode 被正确传递
  const sessionData = {
    id: session.id,
    joinCode: session.joinCode,
    status: session.status,
    currentItemId: session.currentItemId,
    currentStage: session.currentStage,
    classId: session.classId,
    plan: {
      id: session.plan.id,
      title: session.plan.title,
    },
    class: session.class,
    classroomIdentity: buildClassroomIdentityPayload(session),
    generatedCoursewareIdentity: generatedResolution.identity,
  };

  return <TeacherPlayer session={sessionData} initialItems={sortedItems} />;
}

import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { StudentPlayer } from '@/features/lesson-engine/student-player';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';
import { buildClassroomIdentityPayload } from '@/lib/classroom-lifecycle-contract';
import { authorizeClassroomSessionAccess } from '@/features/classroom/session';
import { resolveGeneratedCoursewareSessionBinding } from '@/lib/smart-courseware/classroom-runtime';
import { GeneratedCoursewareRecoveryState } from '@/features/lesson-engine/generated-courseware-recovery';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function StudentSessionPage(props: PageProps) {
  const params = await props.params;
  const userSession = await getServerSession(authOptions);
  if (!userSession?.user?.id) {
    redirect('/login');
  }

  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      plan: {
        include: {
          items: {
            include: { resource: true, knowledgeNode: true },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }]
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
  if (!authorizeClassroomSessionAccess({
    session,
    actor: userSession.user,
    operation: 'read',
  }).allowed) {
    notFound();
  }
  const generatedResolution = await resolveGeneratedCoursewareSessionBinding(prisma, session);
  if (!generatedResolution.ok) {
    return <GeneratedCoursewareRecoveryState recovery={generatedResolution.recovery} />;
  }

  const studentHref = buildSessionParticipantHref({
    role: 'student',
    sessionId: session.id,
    planTitle: session.plan.title,
    bundleCanonicalLessonId: session.courseBundleRevision?.canonicalLessonId ?? null,
    bundleBound: session.courseBundleRevisionId !== null,
  });
  if (studentHref !== `/classroom/student/${session.id}`) {
    redirect(studentHref);
  }

  // 检查课堂状态
  if (session.status === 'FINISHED') {
    // 允许学生看到结束页面
  }

  // 按 BOPPPS 阶段和顺序排序
  const stageOrder = ['BRIDGE_IN', 'OBJECTIVE', 'PRE_ASSESSMENT', 'PARTICIPATORY', 'POST_ASSESSMENT', 'SUMMARY'];
  const sortedItems = session.plan.items.sort((a, b) => {
    const stageDiff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return a.order - b.order;
  });

  // 构建简化的 session 信息传递给客户端
  const sessionInfo = {
    id: session.id,
    joinCode: session.joinCode,
    status: session.status,
    currentItemId: session.currentItemId,
    currentStage: session.currentStage,
    classId: session.classId,
    plan: { id: session.plan.id, title: session.plan.title },
    class: session.class,
    classroomIdentity: buildClassroomIdentityPayload(session),
    generatedCoursewareIdentity: generatedResolution.identity,
  };

  return <StudentPlayer session={sessionInfo} items={sortedItems} />;
}

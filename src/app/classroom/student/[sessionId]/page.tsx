import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { StudentPlayer } from '@/features/lesson-engine/student-player';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';

interface PageProps {
  params: { sessionId: string };
}

export default async function StudentSessionPage({ params }: PageProps) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      plan: {
        include: {
          items: {
            include: { resource: true, knowledgeNode: true },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }]
          }
        }
      }
    }
  });

  if (!session) notFound();

  const studentHref = buildSessionParticipantHref({
    role: 'student',
    sessionId: session.id,
    planTitle: session.plan.title,
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
    plan: { title: session.plan.title }
  };

  return <StudentPlayer session={sessionInfo} items={sortedItems} />;
}

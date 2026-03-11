
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TeacherPlayer } from '@/features/lesson-engine/teacher-player';
import { buildSessionParticipantHref } from '@/lib/classroom-session-route';

interface PageProps {
  params: { sessionId: string };
}

export default async function TeacherSessionPage({ params }: PageProps) {
  const session = await prisma.classSession.findUnique({
    where: { id: params.sessionId },
    include: {
      plan: {
        include: {
          items: {
            include: { resource: true, knowledgeNode: true },
            orderBy: [{ stage: 'asc' }, { order: 'asc' }] // Need to confirm Enum order logic or mapping
          }
        }
      }
    }
  });

  if (!session) notFound();

  const teacherHref = buildSessionParticipantHref({
    role: 'teacher',
    sessionId: session.id,
    planTitle: session.plan.title,
  });
  if (teacherHref !== `/classroom/teacher/${session.id}`) {
    redirect(teacherHref);
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

  return <TeacherPlayer session={session} initialItems={sortedItems} />;
}

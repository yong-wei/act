
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLessonPlanPage(props: PageProps) {
  const params = await props.params;
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { resource: true, knowledgeNode: true },
        orderBy: [{ stage: 'asc' }, { order: 'asc' }]
      }
    }
  });

  if (!plan) notFound();

  return <OrchestratorBuilder initialData={plan as any} />;
}

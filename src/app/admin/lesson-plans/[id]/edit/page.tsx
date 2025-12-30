
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';

interface PageProps {
  params: { id: string };
}

export default async function EditLessonPlanPage({ params }: PageProps) {
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { resource: true },
        orderBy: [{ stage: 'asc' }, { order: 'asc' }]
      }
    }
  });

  if (!plan) notFound();

  return <OrchestratorBuilder initialData={plan as any} />;
}

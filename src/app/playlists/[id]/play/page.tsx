
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlaylistPlayPage(props: PageProps) {
  const params = await props.params;
  // LessonPlan replaces CoursePlaylist
  // For playing, redirect to the new classroom system
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    select: { id: true }
  });

  if (!plan) {
    notFound();
  }

  // Redirect to admin lesson plans where users can start a session
  redirect(`/admin/lesson-plans`);
}

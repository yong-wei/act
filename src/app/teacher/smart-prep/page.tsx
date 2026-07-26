import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { SmartPreparationWorkspace } from '@/features/teacher/smart-preparation-workspace';
import { publicTask, publicTaskSummary } from '@/app/api/teacher/smart-lesson-tasks/_shared';
import { getServerAuthSession } from '@/lib/auth';
import { listCourseBases } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';
import { getSmartLessonTask, listSmartLessonTaskSummaries } from '@/lib/smart-lesson-plan';

export const dynamic = 'force-dynamic';

export default async function SmartPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string; view?: string; courseBasisId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const actor = { id: session.user.id, role: 'TEACHER' as const };
  const query = await searchParams;
  const requestedTaskId = query.taskId?.trim() || null;
  const [courseBasisPage, selectedCourseBases, taskSummaries, classes] = await Promise.all([
    listCourseBases(prisma, actor),
    query.courseBasisId
      ? listCourseBases(prisma, actor, { courseBasisId: query.courseBasisId })
      : Promise.resolve([]),
    listSmartLessonTaskSummaries(prisma, actor),
    prisma.class.findMany({
      where: { teacherId: session.user.id, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const courseBases = [
    ...courseBasisPage,
    ...selectedCourseBases.filter((selected) => !courseBasisPage.some((basis) => basis.id === selected.id)),
  ];
  const snapshots = classes.length ? await prisma.diagnosisReportSnapshot.findMany({
    where: { classId: { in: classes.map((item) => item.id) }, subjectKind: 'class' },
    orderBy: { generatedAt: 'desc' },
    select: { id: true, classId: true, generatedAt: true },
  }) : [];
  const latestByClass = new Map<string, typeof snapshots[number]>();
  for (const snapshot of snapshots) if (snapshot.classId && !latestByClass.has(snapshot.classId)) latestByClass.set(snapshot.classId, snapshot);
  const classDiagnosisOptions = classes.flatMap((item) => {
    const snapshot = latestByClass.get(item.id);
    return snapshot ? [{ classId: item.id, className: item.name, diagnosisRef: snapshot.id, generatedAt: snapshot.generatedAt.toISOString() }] : [];
  });
  const selectedSummary = taskSummaries.find((task) => task.id === requestedTaskId) ?? taskSummaries[0];
  const firstTask = selectedSummary
    ? await getSmartLessonTask(prisma, { actor, taskId: selectedSummary.id })
    : null;
  const initialTasks = taskSummaries.map((task) => task.id === selectedSummary?.id && firstTask
    ? publicTask(firstTask as unknown as Record<string, unknown>)
    : publicTaskSummary(task as unknown as Record<string, unknown>));
  return <SmartPreparationWorkspace
    courseBases={courseBases}
    classDiagnosisOptions={classDiagnosisOptions}
    initialTasks={initialTasks}
    initialSelectedTaskId={selectedSummary?.id}
    initialView={query.view === 'basis' ? 'basis' : 'tasks'}
    initialCourseBasisId={query.courseBasisId}
    initialCourseBasisOffset={courseBasisPage.length}
    initialHasMoreCourseBases={courseBasisPage.length === 50}
  />;
}

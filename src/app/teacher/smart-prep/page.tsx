import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { CourseBasisWorkspace } from '@/features/teacher/course-basis-workspace';
import { SmartLessonPlanWorkspace } from '@/features/teacher/smart-lesson-plan-workspace';
import { publicTask } from '@/app/api/teacher/smart-lesson-tasks/_shared';
import { getServerAuthSession } from '@/lib/auth';
import { listCourseBases } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';
import { listSmartLessonTasks } from '@/lib/smart-lesson-plan';

export const dynamic = 'force-dynamic';

export default async function SmartPrepPage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const actor = { id: session.user.id, role: 'TEACHER' as const };
  const [courseBases, tasks, classes] = await Promise.all([
    listCourseBases(prisma, actor),
    listSmartLessonTasks(prisma, actor),
    prisma.class.findMany({
      where: { teacherId: session.user.id, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
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
  return <main className="space-y-8"><CourseBasisWorkspace initialCourseBases={courseBases} /><SmartLessonPlanWorkspace courseBases={courseBases} classDiagnosisOptions={classDiagnosisOptions} initialTasks={tasks.map((task) => publicTask(task))} /></main>;
}

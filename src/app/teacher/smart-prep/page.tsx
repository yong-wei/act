import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { SmartPreparationWorkspace } from '@/features/teacher/smart-preparation-workspace';
import { publicTask, publicTaskSummary } from '@/app/api/teacher/smart-lesson-tasks/_shared';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { listCourseBases } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';
import { getSmartLessonTask, listSmartLessonTaskSummaries } from '@/lib/smart-lesson-plan';
import { readTeacherClassEvidencePort } from '@/features/learning-record/consumers/public-api';
import { loadSmartPreparationTextbookCatalog } from '@/lib/smart-lesson-plan/textbook-resource-pack';

export const dynamic = 'force-dynamic';

export default async function SmartPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string; view?: string; courseBasisId?: string }>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect(buildLoginRedirectForPath('/teacher/smart-prep'));
  if (session.user.role !== UserRole.TEACHER) redirect(session.user.role === UserRole.ADMIN ? '/admin' : '/dashboard');

  const actor = { id: session.user.id, role: 'TEACHER' as const };
  const query = await searchParams;
  const requestedTaskId = query.taskId?.trim() || null;
  const [courseBasisPage, selectedCourseBases, taskSummaries, classes, teacher, textbookCatalog] = await Promise.all([
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
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultTeachingClassId: true },
    }),
    loadSmartPreparationTextbookCatalog(),
  ]);
  const courseBases = [
    ...courseBasisPage,
    ...selectedCourseBases.filter((selected) => !courseBasisPage.some((basis) => basis.id === selected.id)),
  ];
  const portraitRows = await Promise.all(classes.map(async (item) => ({
    item,
    portrait: (await readTeacherClassEvidencePort({
      db: prisma,
      viewer: { role: 'teacher', subjectUserId: session.user.id, classIds: [item.id] },
      classId: item.id,
      memberUserIds: [],
    })).classPortrait,
  })));
  const classDiagnosisOptions = portraitRows.map(({ item, portrait }) => ({
    classId: item.id,
    className: item.name,
    isDefault: teacher?.defaultTeachingClassId === item.id,
    available: portrait.stateKind === 'SNAPSHOT',
    availabilityReason: portrait.availabilityReason,
    asOf: portrait.evidenceAsOf ?? portrait.generatedAt,
  }));
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
    textbookCatalog={textbookCatalog}
    initialTasks={initialTasks}
    initialSelectedTaskId={selectedSummary?.id}
    initialView={query.view === 'basis' ? 'basis' : 'tasks'}
    initialCourseBasisId={query.courseBasisId}
    initialCourseBasisOffset={courseBasisPage.length}
    initialHasMoreCourseBases={courseBasisPage.length === 50}
  />;
}

import { Prisma, type PrismaClient } from '@prisma/client';

import { SmartLessonPlanError, type SmartLessonActor } from './domain';

type SmartLessonLifecycleDb = PrismaClient;

export type SmartLessonTaskDeletionBlocker = {
  category: 'publication' | 'classroom';
  count: number;
  managementPath: string;
};

export async function archiveSmartLessonTask(
  db: SmartLessonLifecycleDb,
  input: { actor: SmartLessonActor; taskId: string; archived: boolean },
) {
  const task = await db.smartLessonTask.findFirst({
    where: ownedTaskWhere(input.actor, input.taskId),
    select: { id: true },
  });
  if (!task) throw new SmartLessonPlanError('smart-lesson-task-not-found', 404);
  return db.smartLessonTask.update({
    where: { id: task.id },
    data: { archivedAt: input.archived ? new Date() : null },
  });
}

export async function deleteSmartLessonTask(
  db: SmartLessonLifecycleDb,
  input: { actor: SmartLessonActor; taskId: string },
) {
  return db.$transaction(async (tx) => {
    const task = await tx.smartLessonTask.findFirst({
      where: ownedTaskWhere(input.actor, input.taskId),
      select: {
        id: true,
        coursewarePublicationSeries: {
          select: {
            revisions: {
              select: { id: true, _count: { select: { classSessions: true } } },
            },
          },
        },
      },
    });
    if (!task) throw new SmartLessonPlanError('smart-lesson-task-not-found', 404);
    const publications = task.coursewarePublicationSeries?.revisions ?? [];
    if (publications.length > 0) {
      const classroomCount = publications.reduce((sum, item) => sum + item._count.classSessions, 0);
      const blockers: SmartLessonTaskDeletionBlocker[] = [{
        category: 'publication',
        count: publications.length,
        managementPath: '/teacher/preset-lessons',
      }];
      if (classroomCount > 0) {
        blockers.push({
          category: 'classroom',
          count: classroomCount,
          managementPath: '/teacher/history',
        });
      }
      return { deleted: false as const, blockers };
    }

    await deleteUnpublishedTaskGraph(tx, task.id);
    return { deleted: true as const, blockers: [] };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function deleteUnpublishedTaskGraph(tx: Prisma.TransactionClient, taskId: string) {
  const knowledgePointIds = (await tx.smartLessonKnowledgePoint.findMany({
    where: { taskId },
    select: { id: true },
  })).map((item) => item.id);
  const goalIds = (await tx.smartLessonGoal.findMany({
    where: { taskId },
    select: { id: true },
  })).map((item) => item.id);
  const generationJobIds = (await tx.smartLessonGenerationJob.findMany({
    where: { draft: { taskId } },
    select: { id: true },
  })).map((item) => item.id);
  const lessonRevisionIds = (await tx.smartLessonRevision.findMany({
    where: { taskId },
    select: { id: true },
  })).map((item) => item.id);
  const coursewareDraftIds = lessonRevisionIds.length
    ? (await tx.smartCoursewareDraft.findMany({
        where: { planRevisionId: { in: lessonRevisionIds } },
        select: { id: true },
      })).map((item) => item.id)
    : [];
  const coursewareJobIds = coursewareDraftIds.length
    ? (await tx.smartCoursewareGenerationJob.findMany({
        where: { draftId: { in: coursewareDraftIds } },
        select: { id: true },
      })).map((item) => item.id)
    : [];
  const coursewareRevisionIds = coursewareDraftIds.length
    ? (await tx.smartCoursewareRevision.findMany({
        where: { draftId: { in: coursewareDraftIds } },
        select: { id: true },
      })).map((item) => item.id)
    : [];

  await tx.$executeRaw`SELECT set_config('app.smart_lesson_task_delete', ${taskId}, true)`;
  const [fence] = await tx.$queryRaw<Array<{ taskId: string | null }>>`
    SELECT current_setting('app.smart_lesson_task_delete', true) AS "taskId"
  `;
  if (fence?.taskId !== taskId) {
    throw new SmartLessonPlanError('smart-lesson-task-delete-fence-failed', 500);
  }

  const referenceClauses = [
    referenceIdsClause('SMART_LESSON_KNOWLEDGE_POINT', knowledgePointIds),
    referenceIdsClause('SMART_LESSON_GOAL', goalIds),
    referenceIdsClause('GENERATION_JOB', generationJobIds),
    referenceIdsClause('LESSON_PLAN_REVISION', lessonRevisionIds),
    referenceIdsClause('COURSEWARE_REVISION', coursewareRevisionIds),
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);
  if (referenceClauses.length > 0) {
    await tx.courseBasisReferenceLink.deleteMany({ where: { OR: referenceClauses } });
  }

  if (coursewareRevisionIds.length) {
    await tx.smartCoursewarePublicationReceipt.deleteMany({ where: { sourceRevisionId: { in: coursewareRevisionIds } } });
    await tx.smartCoursewareGapAcknowledgement.deleteMany({ where: { sourceRevisionId: { in: coursewareRevisionIds } } });
    await tx.smartCoursewareStalePlanAcknowledgement.deleteMany({ where: { sourceRevisionId: { in: coursewareRevisionIds } } });
    await tx.smartCoursewarePublicationOperation.deleteMany({ where: { sourceRevisionId: { in: coursewareRevisionIds } } });
  }
  if (coursewareDraftIds.length) {
    await tx.smartCoursewareModuleRevision.deleteMany({ where: { module: { draftId: { in: coursewareDraftIds } } } });
  }
  if (coursewareJobIds.length) {
    await tx.smartCoursewareProviderAttempt.deleteMany({ where: { generationJobId: { in: coursewareJobIds } } });
    await tx.smartCoursewareGenerationUnit.deleteMany({ where: { jobId: { in: coursewareJobIds } } });
    await tx.smartCoursewareGenerationCommand.deleteMany({ where: { jobId: { in: coursewareJobIds } } });
    await tx.smartCoursewareGenerationJob.deleteMany({ where: { id: { in: coursewareJobIds } } });
  }
  if (coursewareDraftIds.length) {
    await tx.smartCoursewareModule.deleteMany({ where: { draftId: { in: coursewareDraftIds } } });
    await tx.smartCoursewareRevision.deleteMany({ where: { draftId: { in: coursewareDraftIds } } });
    await tx.smartCoursewareDraft.deleteMany({ where: { id: { in: coursewareDraftIds } } });
  }

  await tx.smartLessonAdvisoryReview.deleteMany({ where: { draft: { taskId } } });
  await tx.smartLessonProviderAttempt.deleteMany({ where: { stage: { job: { draft: { taskId } } } } });
  await tx.smartLessonGenerationCommand.deleteMany({ where: { job: { draft: { taskId } } } });
  await tx.smartLessonGenerationStage.deleteMany({ where: { job: { draft: { taskId } } } });
  await tx.smartLessonGenerationJob.deleteMany({ where: { draft: { taskId } } });
  await tx.smartLessonDraft.updateMany({ where: { taskId }, data: { basedOnRevisionId: null } });
  await tx.smartLessonRevision.deleteMany({ where: { taskId } });
  await tx.smartLessonDraft.deleteMany({ where: { taskId } });
  await tx.smartLessonKnowledgePoint.deleteMany({ where: { taskId } });
  await tx.smartLessonGoal.deleteMany({ where: { taskId } });
  await tx.smartLessonSourceSelection.deleteMany({ where: { taskId } });
  await tx.smartCoursewarePublicationSeries.deleteMany({ where: { taskId } });
  await tx.smartLessonTask.delete({ where: { id: taskId } });
}

function referenceIdsClause(
  referenceType: Prisma.CourseBasisReferenceLinkWhereInput['referenceType'],
  referenceIds: string[],
) {
  return referenceIds.length > 0 ? { referenceType, referenceId: { in: referenceIds } } : null;
}

function ownedTaskWhere(actor: SmartLessonActor, taskId: string) {
  if (!taskId.trim()) throw new SmartLessonPlanError('invalid-id');
  return actor.role === 'ADMIN' ? { id: taskId } : { id: taskId, ownerId: actor.id };
}

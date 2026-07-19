import { Prisma, type PrismaClient } from '@prisma/client';

import { CourseBasisError } from '../course-basis/domain';
import {
  buildCourseBasisLessonDesignSar,
  buildCourseBasisLessonDesignSourcePack,
} from '../course-basis/lesson-design-source-pack';
import { teacherCourseBasisCitationTargetId } from '../source-pack/teacher-course-basis';

import { generateSmartLessonAdvisoryReport } from './provider-runtime';

import {
  SmartLessonPlanError,
  assertSingleLessonDuration,
  canonicalSourceFields,
  contentHash,
  deterministicPlanChecks,
  newAggregateIdentity,
  normalizeSourceBindings,
  projectPersistedClassDiagnosis,
  smartLessonGenerationInputHash,
  type AggregateClassContextRef,
  type SmartLessonActor,
  type SmartLessonSourceBinding,
  type SmartLessonSourceState,
} from './domain';
import {
  smartLessonOutlineOutputSchema,
  validateSmartLessonPlan,
  type SmartLessonPlan,
} from './schema';

const GENERATION_STAGES = [
  'OUTLINE',
  'BRIDGE_IN',
  'OBJECTIVES',
  'PRE_ASSESSMENT',
  'PARTICIPATORY_LEARNING',
  'POST_ASSESSMENT',
  'SUMMARY',
] as const;

type GenerationStageKind = typeof GENERATION_STAGES[number];
type SmartLessonDb = PrismaClient;

type CanonicalItemInput = {
  id?: string;
  lineageId?: string;
  content: string;
  sourceState?: SmartLessonSourceState;
  sourceBindings: SmartLessonSourceBinding[];
};

export type CreateSmartLessonTaskInput = {
  actor: SmartLessonActor;
  courseBasisId: string;
  topic: string;
  audience: string;
  prerequisites?: string;
  durationMinutes: number;
  outlineConfirmationRequired?: boolean;
  sourceVersionIds: string[];
  knowledgePoints: Array<CanonicalItemInput & { title?: string; origin: 'SUGGESTED' | 'TEACHER_CREATED'; supersedesIds?: string[] }>;
  goals: Array<CanonicalItemInput & { origin?: 'SUGGESTED' | 'TEACHER_CREATED'; standardsMappings?: Array<{ standardId: string; label: string }> }>;
  aggregateClassContextRef?: AggregateClassContextRef;
  confirmScope?: boolean;
  confirmGoals?: boolean;
};

export type UpdateSmartLessonTaskInput = Omit<CreateSmartLessonTaskInput, 'actor' | 'courseBasisId' | 'aggregateClassContextRef'> & {
  actor: SmartLessonActor;
  taskId: string;
  courseBasisId?: string;
  aggregateClassContextRef?: AggregateClassContextRef | null;
  expectedRevision: number;
  confirmingTurnId: string;
  agentSessionId?: string;
};

export async function listSmartLessonTasks(db: SmartLessonDb, actorInput: SmartLessonActor) {
  const actor = validateActor(actorInput);
  return db.smartLessonTask.findMany({
    where: actor.role === 'ADMIN' ? {} : { ownerId: actor.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: 50,
    include: {
      sources: true,
      knowledgePoints: { orderBy: { createdAt: 'asc' } },
      goals: { orderBy: { createdAt: 'asc' } },
      drafts: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
        include: {
          jobs: { orderBy: { createdAt: 'desc' }, take: 1, include: { stages: { orderBy: { orderIndex: 'asc' } } } },
          reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
      revisions: { orderBy: { revisionNumber: 'desc' }, take: 10 },
    },
  });
}

export async function getSmartLessonTask(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  taskId: string;
}) {
  const actor = validateActor(input.actor);
  const task = await db.smartLessonTask.findFirst({
    where: readableWhere(actor, { id: validateId(input.taskId) }),
    include: {
      sources: true,
      knowledgePoints: { orderBy: { createdAt: 'asc' } },
      goals: { orderBy: { createdAt: 'asc' } },
      drafts: {
        orderBy: { updatedAt: 'desc' },
        include: {
          jobs: { orderBy: { createdAt: 'desc' }, take: 1, include: { stages: { orderBy: { orderIndex: 'asc' } } } },
          reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
      revisions: { orderBy: { revisionNumber: 'desc' }, take: 20 },
    },
  });
  if (!task) throw new SmartLessonPlanError('smart-lesson-task-not-found', 404);
  return task;
}

export async function createSmartLessonTask(db: SmartLessonDb, input: CreateSmartLessonTaskInput) {
  const actor = validateActor(input.actor);
  const taskId = newAggregateIdentity();
  const taskLineageId = newAggregateIdentity();
  const durationMinutes = assertSingleLessonDuration(input.durationMinutes);
  const topic = requiredText(input.topic, 'topic-required', 500);
  const audience = requiredText(input.audience, 'audience-required', 1000);
  const prerequisites = optionalText(input.prerequisites, 5000);
  const sourceVersionIds = uniqueIds(input.sourceVersionIds);
  if (sourceVersionIds.length === 0) throw new SmartLessonPlanError('source-version-required');
  if (input.knowledgePoints.length === 0) throw new SmartLessonPlanError('knowledge-point-required');
  if (input.goals.length === 0) throw new SmartLessonPlanError('goal-required');
  assertNoClientVerifiedSourceState([...input.knowledgePoints, ...input.goals]);
  for (const binding of [...input.knowledgePoints, ...input.goals].flatMap((item) => item.sourceBindings)) {
    if (!sourceVersionIds.includes(binding.sourceVersionId)) throw new SmartLessonPlanError('source-binding-not-selected');
  }

  const basis = await db.courseBasis.findFirst({
    where: { id: validateId(input.courseBasisId), ownerId: actor.id },
    select: { id: true, ownerId: true },
  });
  if (!basis) throw new SmartLessonPlanError('course-basis-not-found', 404);
  const ownerId = basis.ownerId;
  const versions = await db.courseBasisDocumentVersion.findMany({
    where: {
      id: { in: sourceVersionIds },
      reviewState: 'CONFIRMED',
      retiredAt: null,
      document: { courseBasisId: basis.id, courseBasis: { ownerId } },
    },
    select: { id: true },
  });
  if (versions.length !== sourceVersionIds.length) throw new SmartLessonPlanError('source-version-ineligible');
  let aggregateClassContext: ReturnType<typeof projectPersistedClassDiagnosis> | null = null;
  if (input.aggregateClassContextRef) {
    const aggregateRef = {
      classId: validateId(input.aggregateClassContextRef.classId),
      diagnosisRef: validateId(input.aggregateClassContextRef.diagnosisRef),
    };
    const ownedClass = await db.class.findFirst({
      where: { id: aggregateRef.classId, teacherId: ownerId },
      select: { id: true, _count: { select: { students: true } } },
    });
    if (!ownedClass) throw new SmartLessonPlanError('aggregate-class-context-not-authorized', 403);
    const diagnosis = await db.diagnosisReportSnapshot.findFirst({
      where: { id: aggregateRef.diagnosisRef, classId: ownedClass.id, subjectKind: 'class' },
      select: { id: true, generatedAt: true, snapshot: true },
    });
    if (!diagnosis) throw new SmartLessonPlanError('aggregate-diagnosis-not-found', 404);
    if (ownedClass._count.students < 1) throw new SmartLessonPlanError('aggregate-diagnosis-empty-cohort', 409);
    aggregateClassContext = projectPersistedClassDiagnosis({
      classId: ownedClass.id,
      diagnosisRef: diagnosis.id,
      generatedAt: diagnosis.generatedAt,
      cohortSize: ownedClass._count.students,
      snapshot: diagnosis.snapshot,
    });
  }
  const canonicalBindings = await resolveCanonicalSourceBindings(
    db,
    { id: basis.id, ownerId },
    sourceVersionIds,
    [...input.knowledgePoints, ...input.goals].flatMap((item) => item.sourceBindings),
  );
  const verifiedBindingKeys = await resolveSourcePackVerifiedBindingKeys(
    db,
    ownerId,
    sourceVersionIds,
    [
      ...input.knowledgePoints.map((item) => ({
        content: item.title ?? item.content,
        bindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
      })),
      ...input.goals.map((item) => ({
        content: item.content,
        bindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
      })),
    ],
  );

  const now = new Date();
  const knowledgePoints = input.knowledgePoints.map((item) => {
    const id = item.id ?? newAggregateIdentity();
    const lineageId = item.lineageId ?? newAggregateIdentity();
    const title = requiredText(item.title ?? item.content, 'knowledge-point-title-required', 500);
    return {
      id,
      ownerId,
      lineageId,
      state: input.confirmScope ? 'CONFIRMED' as const : 'DRAFT' as const,
      title,
      ...canonicalSourceFields({
        itemId: id,
        itemLineageId: lineageId,
        taskLineageId,
        content: title,
        sourceState: serverDerivedSourceState(
          item.origin,
          item.sourceState,
          canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
          verifiedBindingKeys.get(title),
        ),
        sourceBindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
      }),
      origin: item.origin,
      supersedesIds: uniqueIds(item.supersedesIds ?? []),
      confirmedAt: input.confirmScope ? now : null,
    };
  });
  const goals = input.goals.map((item) => {
    const id = item.id ?? newAggregateIdentity();
    const lineageId = item.lineageId ?? newAggregateIdentity();
    const goalContent = requiredText(item.content, 'goal-content-required', 2000);
    return {
      id,
      ownerId,
      lineageId,
      state: input.confirmGoals ? 'CONFIRMED' as const : 'DRAFT' as const,
      content: goalContent,
      ...canonicalSourceFields({
        itemId: id,
        itemLineageId: lineageId,
        taskLineageId,
        content: goalContent,
        sourceState: serverDerivedSourceState(
          item.origin ?? 'TEACHER_CREATED',
          item.sourceState,
          canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
          verifiedBindingKeys.get(item.content),
        ),
        sourceBindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
      }),
      standardsMappings: item.standardsMappings ?? [],
      confirmedAt: input.confirmGoals ? now : null,
    };
  });

  return db.smartLessonTask.create({
    data: {
      id: taskId,
      ownerId,
      courseBasisId: basis.id,
      lineageId: taskLineageId,
      topic,
      audience,
      prerequisites,
      durationMinutes,
      outlineConfirmationRequired: input.outlineConfirmationRequired ?? false,
      scopeConfirmedAt: input.confirmScope ? now : null,
      goalsConfirmedAt: input.confirmGoals ? now : null,
      aggregateClassContext: aggregateClassContext ? asJson(aggregateClassContext) : Prisma.JsonNull,
      aggregateClassContextRef: aggregateClassContext?.diagnosisRef ?? null,
      sources: { create: sourceVersionIds.map((sourceVersionId) => ({ ownerId, sourceVersionId })) },
      knowledgePoints: { create: knowledgePoints.map((point) => ({ ...point, sourceBindings: asJson(point.sourceBindings) })) },
      goals: { create: goals.map((goal) => ({ ...goal, sourceBindings: asJson(goal.sourceBindings), standardsMappings: asJson(goal.standardsMappings) })) },
      drafts: { create: { ownerId } },
    },
    include: { sources: true, knowledgePoints: true, goals: true, drafts: true },
  });
}

export async function updateSmartLessonTask(db: SmartLessonDb, input: UpdateSmartLessonTaskInput) {
  const actor = validateActor(input.actor);
  const taskId = validateId(input.taskId);
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new SmartLessonPlanError('task-revision-invalid');
  }
  const confirmingTurnId = requiredText(input.confirmingTurnId, 'confirming-turn-required', 200);
  const topic = requiredText(input.topic, 'topic-required', 500);
  const audience = requiredText(input.audience, 'audience-required', 1000);
  const prerequisites = optionalText(input.prerequisites, 5000);
  const durationMinutes = assertSingleLessonDuration(input.durationMinutes);
  const sourceVersionIds = uniqueIds(input.sourceVersionIds);
  if (sourceVersionIds.length === 0 || input.knowledgePoints.length === 0 || input.goals.length === 0) {
    throw new SmartLessonPlanError('confirmed-task-scope-required');
  }
  try {
    return await db.$transaction(async (tx) => {
    const task = await tx.smartLessonTask.findFirst({
      where: ownedWhere(actor, { id: taskId }),
      include: {
        sources: true,
        knowledgePoints: true,
        goals: true,
        drafts: { include: { jobs: { select: { id: true, state: true } } } },
      },
    });
    if (!task) throw new SmartLessonPlanError('smart-lesson-task-not-found', 404);
    if (task.revision !== input.expectedRevision) throw new SmartLessonPlanError('task-revision-conflict', 409);
    if (task.drafts.some((draft) => draft.jobs.some((job) => ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'].includes(job.state)))) {
      throw new SmartLessonPlanError('active-generation-locks-task', 409);
    }

    const courseBasisId = input.courseBasisId ? validateId(input.courseBasisId) : task.courseBasisId;
    const basis = await tx.courseBasis.findFirst({
      where: { id: courseBasisId, ownerId: actor.id },
      select: { id: true, ownerId: true },
    });
    if (!basis || basis.ownerId !== task.ownerId) throw new SmartLessonPlanError('course-basis-not-found', 404);
    const versions = await tx.courseBasisDocumentVersion.findMany({
      where: {
        id: { in: sourceVersionIds },
        reviewState: 'CONFIRMED',
        retiredAt: null,
        document: { courseBasisId: basis.id, courseBasis: { ownerId: task.ownerId } },
      },
      select: { id: true },
    });
    if (versions.length !== sourceVersionIds.length) throw new SmartLessonPlanError('source-version-ineligible');
    const canonicalBindings = await resolveCanonicalSourceBindings(
      tx as unknown as SmartLessonDb,
      { id: basis.id, ownerId: task.ownerId },
      sourceVersionIds,
      [...input.knowledgePoints, ...input.goals].flatMap((item) => item.sourceBindings),
    );
    const verifiedBindingKeys = await resolveSourcePackVerifiedBindingKeys(
      tx as unknown as SmartLessonDb,
      task.ownerId,
      sourceVersionIds,
      [
        ...input.knowledgePoints.map((item) => ({
          content: item.title ?? item.content,
          bindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
        })),
        ...input.goals.map((item) => ({
          content: item.content,
          bindings: canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings),
        })),
      ],
    );
    const aggregateUpdate: {
      aggregateClassContext?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
      aggregateClassContextRef?: string | null;
    } = {};
    if (input.aggregateClassContextRef === null) {
      aggregateUpdate.aggregateClassContext = Prisma.JsonNull;
      aggregateUpdate.aggregateClassContextRef = null;
    } else if (input.aggregateClassContextRef) {
      const aggregateRef = {
        classId: validateId(input.aggregateClassContextRef.classId),
        diagnosisRef: validateId(input.aggregateClassContextRef.diagnosisRef),
      };
      const ownedClass = await tx.class.findFirst({
        where: { id: aggregateRef.classId, teacherId: task.ownerId },
        select: { id: true, _count: { select: { students: true } } },
      });
      if (!ownedClass) throw new SmartLessonPlanError('aggregate-class-context-not-authorized', 403);
      const diagnosis = await tx.diagnosisReportSnapshot.findFirst({
        where: { id: aggregateRef.diagnosisRef, classId: ownedClass.id, subjectKind: 'class' },
        select: { id: true, generatedAt: true, snapshot: true },
      });
      if (!diagnosis) throw new SmartLessonPlanError('aggregate-diagnosis-not-found', 404);
      if (ownedClass._count.students < 1) throw new SmartLessonPlanError('aggregate-diagnosis-empty-cohort', 409);
      aggregateUpdate.aggregateClassContext = asJson(projectPersistedClassDiagnosis({
        classId: ownedClass.id,
        diagnosisRef: diagnosis.id,
        generatedAt: diagnosis.generatedAt,
        cohortSize: ownedClass._count.students,
        snapshot: diagnosis.snapshot,
      }));
      aggregateUpdate.aggregateClassContextRef = diagnosis.id;
    }
    const now = new Date();
    const existingPoints = new Map(task.knowledgePoints.map((item) => [item.id, item]));
    const existingGoals = new Map(task.goals.map((item) => [item.id, item]));
    const nextPointIds = new Set<string>();
    const nextGoalIds = new Set<string>();

    for (const item of input.knowledgePoints) {
      const requestedExisting = item.id ? existingPoints.get(validateId(item.id)) : undefined;
      if (item.id && !requestedExisting) throw new SmartLessonPlanError('knowledge-point-not-found', 404);
      const existing = requestedExisting?.state === 'REMOVED' ? undefined : requestedExisting;
      const id = existing?.id ?? newAggregateIdentity();
      const lineageId = existing?.lineageId ?? newAggregateIdentity();
      const title = requiredText(item.title ?? item.content, 'knowledge-point-title-required', 500);
      const itemBindings = canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings);
      const sourceFields = canonicalSourceFields({
        itemId: id,
        itemLineageId: lineageId,
        taskLineageId: task.lineageId,
        content: title,
        sourceState: serverDerivedSourceState(item.origin, item.sourceState, itemBindings, verifiedBindingKeys.get(title), existing, title),
        sourceBindings: itemBindings,
      });
      await tx.smartLessonKnowledgePoint.upsert({
        where: { id },
        create: {
          id, ownerId: task.ownerId, taskId: task.id, lineageId, state: 'CONFIRMED', title,
          ...sourceFields, sourceBindings: asJson(sourceFields.sourceBindings), origin: item.origin,
          supersedesIds: uniqueIds(item.supersedesIds ?? []), confirmedAt: now,
        },
        update: {
          state: 'CONFIRMED', title, ...sourceFields, sourceBindings: asJson(sourceFields.sourceBindings),
          origin: item.origin, supersedesIds: uniqueIds(item.supersedesIds ?? []), confirmedAt: now, removedAt: null,
        },
      });
      nextPointIds.add(id);
    }
    for (const item of input.goals) {
      const requestedExisting = item.id ? existingGoals.get(validateId(item.id)) : undefined;
      if (item.id && !requestedExisting) throw new SmartLessonPlanError('goal-not-found', 404);
      const existing = requestedExisting?.state === 'REMOVED' ? undefined : requestedExisting;
      const id = existing?.id ?? newAggregateIdentity();
      const lineageId = existing?.lineageId ?? newAggregateIdentity();
      const content = requiredText(item.content, 'goal-content-required', 2000);
      const itemBindings = canonicalizeItemBindings(item.sourceBindings, sourceVersionIds, canonicalBindings);
      const sourceFields = canonicalSourceFields({
        itemId: id,
        itemLineageId: lineageId,
        taskLineageId: task.lineageId,
        content,
        sourceState: serverDerivedSourceState(item.origin ?? 'TEACHER_CREATED', item.sourceState, itemBindings, verifiedBindingKeys.get(item.content), existing, content),
        sourceBindings: itemBindings,
      });
      await tx.smartLessonGoal.upsert({
        where: { id },
        create: {
          id, ownerId: task.ownerId, taskId: task.id, lineageId, state: 'CONFIRMED', content,
          ...sourceFields, sourceBindings: asJson(sourceFields.sourceBindings),
          standardsMappings: asJson(item.standardsMappings ?? []), confirmedAt: now,
        },
        update: {
          state: 'CONFIRMED', content, ...sourceFields, sourceBindings: asJson(sourceFields.sourceBindings),
          standardsMappings: asJson(item.standardsMappings ?? []), confirmedAt: now, removedAt: null,
        },
      });
      nextGoalIds.add(id);
    }
    await tx.smartLessonKnowledgePoint.updateMany({
      where: { taskId: task.id, id: { notIn: [...nextPointIds] }, state: { not: 'REMOVED' } },
      data: { state: 'REMOVED', removedAt: now },
    });
    await tx.smartLessonGoal.updateMany({
      where: { taskId: task.id, id: { notIn: [...nextGoalIds] }, state: { not: 'REMOVED' } },
      data: { state: 'REMOVED', removedAt: now },
    });
    await tx.smartLessonSourceSelection.updateMany({
      where: { taskId: task.id, sourceVersionId: { notIn: sourceVersionIds }, state: 'SELECTED' },
      data: { state: 'REMOVED', removedAt: now },
    });
    for (const sourceVersionId of sourceVersionIds) {
      await tx.smartLessonSourceSelection.upsert({
        where: { taskId_sourceVersionId: { taskId: task.id, sourceVersionId } },
        create: { ownerId: task.ownerId, taskId: task.id, sourceVersionId },
        update: { state: 'SELECTED', removedAt: null },
      });
    }

    const updatedCount = await tx.smartLessonTask.updateMany({
      where: { id: task.id, ownerId: task.ownerId, revision: input.expectedRevision },
      data: {
        courseBasisId: basis.id, topic, audience, prerequisites, durationMinutes,
        outlineConfirmationRequired: input.outlineConfirmationRequired ?? false,
        ...aggregateUpdate,
        scopeConfirmedAt: input.confirmScope ? now : null,
        goalsConfirmedAt: input.confirmGoals ? now : null,
        revision: { increment: 1 },
      },
    });
    if (updatedCount.count !== 1) throw new SmartLessonPlanError('task-revision-conflict', 409);
    await tx.smartLessonGenerationJob.updateMany({
      where: {
        draft: { taskId: task.id },
        state: { in: ['FAILED', 'CANCELLED', 'COMPLETED'] },
      },
      data: {
        activeIdentity: null,
        supersededAt: now,
        supersededByTaskRevision: input.expectedRevision + 1,
      },
    });
    await tx.smartLessonDraft.updateMany({
      where: { taskId: task.id, state: { not: 'APPROVED' } },
      data: { state: 'EDITABLE', staleDownstreamAt: now },
    });

    const updatedTask = await tx.smartLessonTask.findUniqueOrThrow({
      where: { id: task.id },
      include: {
        sources: true,
        knowledgePoints: { orderBy: { createdAt: 'asc' } },
        goals: { orderBy: { createdAt: 'asc' } },
        drafts: { orderBy: { updatedAt: 'desc' }, take: 1 },
        revisions: { orderBy: { revisionNumber: 'desc' }, take: 20 },
      },
    });

    const historySession = await resolveTaskHistorySession(tx, {
      actor, task, expectedRevision: input.expectedRevision, agentSessionId: input.agentSessionId,
    });
    await tx.agentToolRun.create({
      data: {
        agentSessionId: historySession.id,
        ownerUserId: task.ownerId,
        actorUserId: actor.id,
        targetUserId: task.ownerId,
        courseId: task.courseBasisId,
        pageId: '/teacher/smart-prep',
        toolName: 'smart_lesson_task_confirm',
        permissionTier: 'teacher-confirmed',
        approvalState: 'approved',
        status: 'succeeded',
        inputSummary: asJson(taskDecisionSnapshot(task)),
        outputSummary: asJson({
          ...taskDecisionSnapshot(updatedTask),
          confirmingTurnId,
          confirmedBy: actor.id,
          confirmedAt: now.toISOString(),
        }),
        idempotencyKey: `task:${task.id}:revision:${input.expectedRevision + 1}`,
        correlationId: confirmingTurnId,
        completedAt: now,
      },
    });
    return updatedTask;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new SmartLessonPlanError('task-revision-conflict', 409);
    }
    throw error;
  }
}

export async function updateSmartLessonDraft(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  draftId: string;
  expectedVersion: number;
  content: unknown;
}) {
  const actor = validateActor(input.actor);
  const draft = await db.smartLessonDraft.findFirst({
    where: ownedWhere(actor, { id: validateId(input.draftId) }),
    include: {
      task: {
        include: {
          sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
          knowledgePoints: { where: { state: 'CONFIRMED' } },
          goals: { where: { state: 'CONFIRMED' } },
          courseBasis: { select: { title: true } },
        },
      },
    },
  });
  if (!draft) throw new SmartLessonPlanError('draft-not-found', 404);
  if (draft.state === 'APPROVED') throw new SmartLessonPlanError('approved-draft-immutable', 409);
  if (draft.state === 'GENERATING') throw new SmartLessonPlanError('active-generation-locks-draft', 409);
  const plan = validateSmartLessonPlan(input.content, draft.task.durationMinutes);
  assertPlanMatchesConfirmedTask(plan, draft.task);
  await assertPlanSourceBindingsCanonical(db, draft.task, plan);
  const planHash = contentHash(plan);
  const result = await db.smartLessonDraft.updateMany({
    where: { id: draft.id, ownerId: draft.ownerId, version: input.expectedVersion, state: { not: 'APPROVED' } },
    data: { content: asJson(plan), contentHash: planHash, state: 'READY', version: { increment: 1 }, staleDownstreamAt: new Date() },
  });
  if (result.count !== 1) throw new SmartLessonPlanError('draft-version-conflict', 409);
  return db.smartLessonDraft.findUniqueOrThrow({ where: { id: draft.id } });
}

export async function deriveDraftFromRevision(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  revisionId: string;
}) {
  const actor = validateActor(input.actor);
  const revision = await db.smartLessonRevision.findFirst({ where: ownedWhere(actor, { id: validateId(input.revisionId) }) });
  if (!revision) throw new SmartLessonPlanError('revision-not-found', 404);
  const existing = await db.smartLessonDraft.findFirst({
    where: ownedWhere(actor, { basedOnRevisionId: revision.id, state: { not: 'APPROVED' } }),
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;
  return db.smartLessonDraft.create({
    data: {
      ownerId: revision.ownerId,
      taskId: revision.taskId,
      basedOnRevisionId: revision.id,
      state: 'READY',
      content: revision.content === null ? Prisma.JsonNull : asJson(revision.content),
      contentHash: revision.contentHash,
      staleDownstreamAt: new Date(),
    },
  });
}

export async function startGenerationJob(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  draftId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ draftId: input.draftId });
  const replay = await findCommandReplay(db, actor, 'START', idempotencyKey, requestHash);
  if (replay) return replay;

  try {
    return await db.$transaction(async (tx) => {
      const draft = await tx.smartLessonDraft.findFirst({
        where: ownedWhere(actor, { id: validateId(input.draftId) }),
        include: {
          task: {
            include: {
              sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
              knowledgePoints: { where: { state: 'CONFIRMED' } },
              goals: { where: { state: 'CONFIRMED' } },
            },
          },
        },
      });
      if (!draft) throw new SmartLessonPlanError('draft-not-found', 404);
      assertGenerationReady(draft);
      const existing = await tx.smartLessonGenerationJob.findFirst({
        where: { draftId: draft.id, activeIdentity: `draft:${draft.id}` },
      });
      if (existing) {
        await recordCommand(tx, { ownerId: draft.ownerId, jobId: existing.id, action: 'START', idempotencyKey, requestHash, result: jobSnapshot(existing) });
        return existing;
      }
      const jobId = newAggregateIdentity();
      const generationInputHash = smartLessonGenerationInputHash(draft.task);
      const job = await tx.smartLessonGenerationJob.create({
        data: {
          id: jobId,
          ownerId: draft.ownerId,
          draftId: draft.id,
          taskRevision: draft.task.revision,
          inputHash: generationInputHash,
          deliveryGeneration: 1,
          outlineConfirmation: draft.task.outlineConfirmationRequired,
          activeIdentity: `draft:${draft.id}`,
          stages: {
            create: GENERATION_STAGES.map((kind, orderIndex) => ({ ownerId: draft.ownerId, kind, orderIndex })),
          },
          commands: {
            create: {
              ownerId: draft.ownerId,
              action: 'START',
              idempotencyKey,
              requestHash,
              resultSnapshot: asJson({ jobId, state: 'QUEUED' }),
            },
          },
        },
        include: { stages: { orderBy: { orderIndex: 'asc' } } },
      });
      await tx.smartLessonDraft.update({ where: { id: draft.id }, data: { state: 'GENERATING' } });
      return job;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isRetryableTransactionConflict(error)) {
      const replayAfterRace = await findCommandReplay(db, actor, 'START', idempotencyKey, requestHash);
      if (replayAfterRace) return replayAfterRace;
      const active = await db.smartLessonGenerationJob.findFirst({ where: ownedWhere(actor, { draftId: input.draftId, activeIdentity: `draft:${input.draftId}` }) });
      if (active) return active;
    }
    throw error;
  }
}

export async function resumeGenerationJob(db: SmartLessonDb, input: JobCommandInput) {
  return transitionGenerationJob(db, input, 'RESUME', ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'], async (tx, job, now) => {
    await assertGenerationInputUnchanged(tx, job);
    await tx.smartLessonGenerationStage.updateMany({
      where: { jobId: job.id, state: { in: ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'] } },
      data: { state: 'PENDING', startedAt: null },
    });
    await tx.smartLessonDraft.update({ where: { id: job.draftId }, data: { state: 'GENERATING' } });
    return tx.smartLessonGenerationJob.update({
      where: { id: job.id },
      data: {
        state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, failureCode: null,
        cancelledAt: null, completedAt: null, deliveryGeneration: { increment: 1 }, updatedAt: now,
      },
    });
  });
}

export async function cancelGenerationJob(db: SmartLessonDb, input: JobCommandInput) {
  return transitionGenerationJob(db, input, 'CANCEL', ['QUEUED', 'RUNNING', 'PAUSED', 'RETRYABLE'], async (tx, job, now) => {
    await tx.smartLessonGenerationStage.updateMany({
      where: { jobId: job.id, state: { in: ['PENDING', 'RUNNING', 'PAUSED', 'RETRYABLE'] } },
      data: { state: 'CANCELLED' },
    });
    await tx.smartLessonDraft.update({ where: { id: job.draftId }, data: { state: 'EDITABLE' } });
    return tx.smartLessonGenerationJob.update({
      where: { id: job.id },
      data: { state: 'CANCELLED', activeIdentity: null, cancelledAt: now },
    });
  });
}

export async function retryGenerationJob(db: SmartLessonDb, input: JobCommandInput & { stage?: GenerationStageKind }) {
  const stage = input.stage;
  return transitionGenerationJob(db, input, 'RETRY', ['RETRYABLE', 'FAILED'], async (tx, job) => {
    await assertGenerationInputUnchanged(tx, job);
    const failedStage = await tx.smartLessonGenerationStage.findFirst({
      where: { jobId: job.id, ...(stage ? { kind: stage } : {}), state: { in: ['RETRYABLE', 'FAILED'] } },
      orderBy: { orderIndex: 'asc' },
    });
    if (!failedStage) throw new SmartLessonPlanError('retryable-stage-not-found', 409);
    await tx.smartLessonGenerationStage.update({ where: { id: failedStage.id }, data: { state: 'PENDING', startedAt: null } });
    await tx.smartLessonDraft.update({ where: { id: job.draftId }, data: { state: 'GENERATING' } });
    return tx.smartLessonGenerationJob.update({
      where: { id: job.id },
      data: {
        state: 'QUEUED', activeIdentity: `draft:${job.draftId}`, failureCode: null,
        firstIncompleteStage: failedStage.kind, deliveryGeneration: { increment: 1 },
      },
    });
  });
}

export async function updatePausedGenerationOutline(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  jobId: string;
  output: unknown;
}) {
  const actor = validateActor(input.actor);
  const output = smartLessonOutlineOutputSchema.parse(input.output);
  const job = await db.smartLessonGenerationJob.findFirst({
    where: ownedWhere(actor, { id: validateId(input.jobId) }),
    include: {
      stages: { where: { kind: 'OUTLINE' }, take: 1 },
      draft: { select: { task: { select: { durationMinutes: true, aggregateClassContextRef: true } } } },
    },
  });
  if (!job) throw new SmartLessonPlanError('generation-job-not-found', 404);
  if (job.state !== 'PAUSED' || job.stages[0]?.state !== 'COMPLETED') {
    throw new SmartLessonPlanError('paused-outline-required', 409);
  }
  assertOutlineMatchesTask(output, job.draft.task.durationMinutes, job.draft.task.aggregateClassContextRef);
  return db.smartLessonGenerationStage.update({
    where: { id: job.stages[0].id },
    data: { output: asJson(output), outputHash: contentHash(output), updatedAt: new Date() },
  });
}

export async function beginProviderAttempt(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  jobId: string;
  stage: GenerationStageKind;
  serviceId: string;
  providerKind: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  request: unknown;
  leaseMs?: number;
}) {
  const actor = validateActor(input.actor);
  const requestHash = contentHash(input.request);
  const identity = {
    serviceId: requiredText(input.serviceId, 'service-id-required', 200),
    providerKind: requiredText(input.providerKind, 'provider-kind-required', 100),
    model: requiredText(input.model, 'model-required', 300),
    promptVersion: requiredText(input.promptVersion, 'prompt-version-required', 100),
    schemaVersion: requiredText(input.schemaVersion, 'schema-version-required', 100),
    requestHash,
  };
  const claimToken = newAggregateIdentity();
  const now = new Date();
  const claimExpiresAt = new Date(now.getTime() + Math.max(60_000, input.leaseMs ?? 60_000));
  return db.$transaction(async (tx) => {
    const job = await tx.smartLessonGenerationJob.findFirst({ where: ownedWhere(actor, { id: validateId(input.jobId) }) });
    if (!job) throw new SmartLessonPlanError('generation-job-not-found', 404);
    if (!['QUEUED', 'RUNNING'].includes(job.state)) throw new SmartLessonPlanError('generation-job-not-runnable', 409);
    let stage = await tx.smartLessonGenerationStage.findUnique({ where: { jobId_kind: { jobId: job.id, kind: input.stage } } });
    if (!stage || stage.state === 'COMPLETED') throw new SmartLessonPlanError('generation-stage-not-runnable', 409);
    if (stage.kind !== job.firstIncompleteStage) throw new SmartLessonPlanError('generation-stage-out-of-order', 409);
    if (stage.state === 'RUNNING' && stage.claimExpiresAt && stage.claimExpiresAt > now) {
      const activeAttempt = await tx.smartLessonProviderAttempt.findFirst({
        where: { stageId: stage.id, outcome: 'RUNNING' },
        orderBy: { attemptNumber: 'desc' },
      });
      return { claimed: false as const, claimToken: null, attempt: activeAttempt };
    }
    if (stage.state === 'RUNNING') {
      await tx.smartLessonGenerationStage.updateMany({
        where: { id: stage.id, state: 'RUNNING', claimToken: stage.claimToken },
        data: { state: 'RETRYABLE', claimToken: null, claimExpiresAt: null },
      });
      stage = await tx.smartLessonGenerationStage.findUnique({ where: { id: stage.id } });
      if (!stage) throw new SmartLessonPlanError('generation-stage-not-found', 404);
    }
    const latestAttempt = await tx.smartLessonProviderAttempt.findFirst({
      where: { stageId: stage.id },
      orderBy: { attemptNumber: 'desc' },
    });
    const reusableAttempt = latestAttempt
      && ['RUNNING', 'RETRYABLE_FAILURE'].includes(latestAttempt.outcome)
      && providerAttemptMatches(latestAttempt, identity)
      ? latestAttempt
      : null;
    const attemptNumber = reusableAttempt ? reusableAttempt.attemptNumber : (latestAttempt?.attemptNumber ?? 0) + 1;
    const claimed = await tx.smartLessonGenerationStage.updateMany({
      where: {
        id: stage.id,
        attemptGeneration: stage.attemptGeneration,
        state: { in: ['PENDING', 'RETRYABLE'] },
      },
      data: {
        state: 'RUNNING',
        attemptGeneration: { increment: 1 },
        claimToken,
        claimExpiresAt,
        startedAt: stage.startedAt ?? now,
      },
    });
    if (claimed.count !== 1) {
      const activeAttempt = await tx.smartLessonProviderAttempt.findFirst({
        where: { stageId: stage.id, outcome: 'RUNNING' },
        orderBy: { attemptNumber: 'desc' },
      });
      return { claimed: false as const, claimToken: null, attempt: activeAttempt };
    }
    await tx.smartLessonGenerationJob.update({ where: { id: job.id }, data: { state: 'RUNNING', startedAt: job.startedAt ?? now } });
    let attempt;
    if (reusableAttempt) {
      const resumed = await tx.smartLessonProviderAttempt.updateMany({
        where: { id: reusableAttempt.id, outcome: { in: ['RUNNING', 'RETRYABLE_FAILURE'] } },
        data: { outcome: 'RUNNING', finishedAt: null },
      });
      if (resumed.count !== 1) throw new SmartLessonPlanError('provider-attempt-claim-conflict', 409);
      attempt = { ...reusableAttempt, outcome: 'RUNNING' as const, finishedAt: null };
    } else {
      attempt = await tx.smartLessonProviderAttempt.create({
        data: {
          ownerId: job.ownerId,
          stageId: stage.id,
          attemptNumber,
          idempotencyKey: `smart-lesson-stage:${stage.id}:${attemptNumber}`,
          ...identity,
          requestSnapshot: asJson(input.request),
        },
      });
    }
    return { claimed: true as const, claimToken, attempt };
  });
}

function providerAttemptMatches(
  attempt: { serviceId: string; providerKind: string; model: string; promptVersion: string; schemaVersion: string; requestHash: string },
  identity: { serviceId: string; providerKind: string; model: string; promptVersion: string; schemaVersion: string; requestHash: string },
) {
  return attempt.serviceId === identity.serviceId
    && attempt.providerKind === identity.providerKind
    && attempt.model === identity.model
    && attempt.promptVersion === identity.promptVersion
    && attempt.schemaVersion === identity.schemaVersion
    && attempt.requestHash === identity.requestHash;
}

export async function finishProviderAttempt(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  attemptId: string;
  claimToken: string;
  outcome: 'SUCCEEDED' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE' | 'CANCELLED';
  normalizedResponseId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costMicros?: bigint | null;
}) {
  const actor = validateActor(input.actor);
  const attempt = await db.smartLessonProviderAttempt.findFirst({ where: ownedWhere(actor, { id: validateId(input.attemptId) }) });
  if (!attempt) throw new SmartLessonPlanError('provider-attempt-not-found', 404);
  if (attempt.outcome !== 'RUNNING') return attempt;
  const updated = await db.smartLessonProviderAttempt.updateMany({
    where: { id: attempt.id, outcome: 'RUNNING', stage: { claimToken: validateId(input.claimToken) } },
    data: {
      outcome: input.outcome,
      normalizedResponseId: optionalText(input.normalizedResponseId, 300) || null,
      inputTokens: optionalNonNegativeInteger(input.inputTokens),
      outputTokens: optionalNonNegativeInteger(input.outputTokens),
      costMicros: optionalNonNegativeBigInt(input.costMicros),
      finishedAt: new Date(),
    },
  });
  if (updated.count !== 1) throw new SmartLessonPlanError('provider-attempt-claim-lost', 409);
  return db.smartLessonProviderAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
}

export async function completeGenerationStage(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  jobId: string;
  stage: GenerationStageKind;
  claimToken: string;
  attemptId: string;
  output: unknown;
  completedPlan?: unknown;
  normalizedResponseId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costMicros?: bigint | null;
}) {
  const actor = validateActor(input.actor);
  return db.$transaction(async (tx) => {
    const job = await tx.smartLessonGenerationJob.findFirst({
      where: ownedWhere(actor, { id: validateId(input.jobId) }),
      include: {
        draft: {
          include: {
            task: {
              include: {
                sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
                knowledgePoints: { where: { state: 'CONFIRMED' } },
                goals: { where: { state: 'CONFIRMED' } },
                courseBasis: { select: { title: true } },
              },
            },
          },
        },
      },
    });
    if (!job) throw new SmartLessonPlanError('generation-job-not-found', 404);
    const stage = await tx.smartLessonGenerationStage.findUnique({ where: { jobId_kind: { jobId: job.id, kind: input.stage } } });
    if (!stage) throw new SmartLessonPlanError('generation-stage-not-found', 404);
    const outputHash = contentHash(input.output);
    if (stage.state === 'COMPLETED') {
      if (stage.outputHash !== outputHash) throw new SmartLessonPlanError('completed-stage-output-conflict', 409);
      return job;
    }
    if (stage.state !== 'RUNNING') throw new SmartLessonPlanError('generation-stage-not-running', 409);
    const attempt = await tx.smartLessonProviderAttempt.findFirst({
      where: { id: validateId(input.attemptId), stageId: stage.id, outcome: 'RUNNING' },
    });
    if (!attempt) throw new SmartLessonPlanError('provider-attempt-not-running', 409);
    const completed = await tx.smartLessonGenerationStage.updateMany({
      where: { id: stage.id, state: 'RUNNING', claimToken: validateId(input.claimToken) },
      data: {
        state: 'COMPLETED',
        output: asJson(input.output),
        outputHash,
        completedAt: new Date(),
        claimToken: null,
        claimExpiresAt: null,
      },
    });
    if (completed.count !== 1) throw new SmartLessonPlanError('generation-stage-claim-lost', 409);
    await tx.smartLessonProviderAttempt.update({
      where: { id: attempt.id },
      data: {
        outcome: 'SUCCEEDED',
        normalizedResponseId: optionalText(input.normalizedResponseId, 300) || null,
        inputTokens: optionalNonNegativeInteger(input.inputTokens),
        outputTokens: optionalNonNegativeInteger(input.outputTokens),
        costMicros: optionalNonNegativeBigInt(input.costMicros),
        finishedAt: new Date(),
      },
    });
    const next = await tx.smartLessonGenerationStage.findFirst({
      where: { jobId: job.id, orderIndex: { gt: stage.orderIndex }, state: { not: 'COMPLETED' } },
      orderBy: { orderIndex: 'asc' },
    });
    if (input.stage === 'OUTLINE' && job.outlineConfirmation) {
      return tx.smartLessonGenerationJob.update({
        where: { id: job.id },
        data: { state: 'PAUSED', firstIncompleteStage: next?.kind ?? 'BRIDGE_IN' },
      });
    }
    if (next) {
      return tx.smartLessonGenerationJob.update({ where: { id: job.id }, data: { firstIncompleteStage: next.kind } });
    }
    if (input.completedPlan === undefined) throw new SmartLessonPlanError('completed-plan-required', 409);
    const plan = validateSmartLessonPlan(input.completedPlan, job.draft.task.durationMinutes);
    assertPlanMatchesConfirmedTask(plan, job.draft.task);
    const checks = deterministicPlanChecks(plan);
    if (checks.length > 0) throw new SmartLessonPlanError(`deterministic-check-failed:${checks[0].code}`, 409);
    await tx.smartLessonDraft.update({
      where: { id: job.draftId },
      data: { state: 'READY', content: asJson(plan), contentHash: contentHash(plan), version: { increment: 1 } },
    });
    return tx.smartLessonGenerationJob.update({
      where: { id: job.id },
      data: { state: 'COMPLETED', activeIdentity: null, completedAt: new Date(), firstIncompleteStage: 'SUMMARY' },
    });
  });
}

export async function failGenerationStage(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  jobId: string;
  stage: GenerationStageKind;
  claimToken: string;
  attemptId: string;
  failureCode: string;
  retryable: boolean;
}) {
  const actor = validateActor(input.actor);
  return db.$transaction(async (tx) => {
    const job = await tx.smartLessonGenerationJob.findFirst({ where: ownedWhere(actor, { id: validateId(input.jobId) }) });
    if (!job) throw new SmartLessonPlanError('generation-job-not-found', 404);
    const stage = await tx.smartLessonGenerationStage.findUnique({ where: { jobId_kind: { jobId: job.id, kind: input.stage } } });
    if (!stage || stage.state === 'COMPLETED') throw new SmartLessonPlanError('generation-stage-not-failable', 409);
    const stageState = input.retryable ? 'RETRYABLE' : 'FAILED';
    const attempt = await tx.smartLessonProviderAttempt.findFirst({
      where: { id: validateId(input.attemptId), stageId: stage.id, outcome: 'RUNNING' },
    });
    if (!attempt) throw new SmartLessonPlanError('provider-attempt-not-running', 409);
    const failed = await tx.smartLessonGenerationStage.updateMany({
      where: { id: stage.id, state: 'RUNNING', claimToken: validateId(input.claimToken) },
      data: { state: stageState, claimToken: null, claimExpiresAt: null },
    });
    if (failed.count !== 1) throw new SmartLessonPlanError('generation-stage-claim-lost', 409);
    await tx.smartLessonProviderAttempt.update({
      where: { id: attempt.id },
      data: { outcome: input.retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE', finishedAt: new Date() },
    });
    await tx.smartLessonDraft.update({ where: { id: job.draftId }, data: { state: 'EDITABLE' } });
    return tx.smartLessonGenerationJob.update({
      where: { id: job.id },
      data: {
        state: stageState,
        failureCode: requiredText(input.failureCode, 'failure-code-required', 200),
        firstIncompleteStage: stage.kind,
      },
    });
  });
}

export async function recordAdvisoryReview(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  draftId: string;
  idempotencyKey: string;
}, generateReview = generateSmartLessonAdvisoryReport) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const draft = await db.smartLessonDraft.findFirst({ where: ownedWhere(actor, { id: validateId(input.draftId) }) });
  if (!draft) throw new SmartLessonPlanError('draft-not-found', 404);
  if (!draft.contentHash || !draft.content) throw new SmartLessonPlanError('reviewable-draft-required', 409);
  const requestHash = contentHash({ draftId: draft.id, contentHash: draft.contentHash });
  const existing = await db.smartLessonAdvisoryReview.findFirst({
    where: { ownerId: draft.ownerId, idempotencyKey },
  });
  if (existing) return assertAdvisoryReviewReplay(existing, requestHash);

  let reservation;
  try {
    reservation = await db.smartLessonAdvisoryReview.create({
      data: {
        ownerId: draft.ownerId,
        draftId: draft.id,
        contentHash: draft.contentHash,
        idempotencyKey,
        requestHash,
        state: 'RUNNING',
        report: Prisma.JsonNull,
        providerAudit: Prisma.JsonNull,
        advisoryOnly: true,
      },
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const replay = await db.smartLessonAdvisoryReview.findFirst({ where: { ownerId: draft.ownerId, idempotencyKey } });
    if (!replay) throw error;
    return assertAdvisoryReviewReplay(replay, requestHash);
  }

  try {
    const generated = await generateReview({ plan: draft.content, idempotencyKey: `smart-lesson-review:${reservation.id}` });
    return await db.smartLessonAdvisoryReview.update({
      where: { id: reservation.id },
      data: {
        state: 'COMPLETED',
        report: asJson(generated.output),
        providerAudit: asJson(generated.audit),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const failureCode = error instanceof SmartLessonPlanError ? error.code : 'advisory-provider-failed';
    await db.smartLessonAdvisoryReview.update({
      where: { id: reservation.id },
      data: { state: 'FAILED', failureCode, completedAt: new Date() },
    }).catch(() => undefined);
    if (error instanceof SmartLessonPlanError) throw error;
    throw new SmartLessonPlanError('advisory-provider-failed', 503);
  }
}

function assertAdvisoryReviewReplay<T extends { requestHash: string; state: string }>(review: T, requestHash: string): T {
  if (review.requestHash !== requestHash) throw new SmartLessonPlanError('idempotency-key-conflict', 409);
  if (review.state === 'RUNNING') throw new SmartLessonPlanError('advisory-review-in-progress', 409);
  if (review.state !== 'COMPLETED') throw new SmartLessonPlanError('advisory-review-failed', 409);
  return review;
}

export async function approveSmartLessonDraft(db: SmartLessonDb, input: {
  actor: SmartLessonActor;
  draftId: string;
  idempotencyKey: string;
}) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const draftId = validateId(input.draftId);
  const existing = await db.smartLessonRevision.findFirst({
    where: { ownerId: actor.id, approvalIdempotencyKey: idempotencyKey },
  });
  if (existing) {
    if (existing.draftId !== draftId) throw new SmartLessonPlanError('idempotency-key-conflict', 409);
    const draft = await db.smartLessonDraft.findFirst({ where: { id: draftId, ownerId: actor.id }, select: { contentHash: true } });
    if (!draft?.contentHash || existing.approvalRequestHash !== approvalRequestHash(draftId, draft.contentHash)) {
      throw new SmartLessonPlanError('idempotency-key-conflict', 409);
    }
    return existing;
  }
  let requestHash: string | null = null;
  try {
    return await db.$transaction(async (tx) => {
      const draft = await tx.smartLessonDraft.findFirst({
        where: ownedWhere(actor, { id: draftId }),
        include: {
          task: {
            include: {
              sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
              knowledgePoints: { where: { state: 'CONFIRMED' } },
              goals: { where: { state: 'CONFIRMED' } },
              courseBasis: { select: { title: true } },
            },
          },
          jobs: {
            where: { state: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            take: 1,
            include: {
              stages: {
                orderBy: { orderIndex: 'asc' },
                include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
              },
            },
          },
        },
      });
      if (!draft) throw new SmartLessonPlanError('draft-not-found', 404);
      if (draft.state === 'APPROVED') throw new SmartLessonPlanError('draft-already-approved', 409);
      if (draft.state !== 'READY' || !draft.content || !draft.contentHash) throw new SmartLessonPlanError('valid-ready-draft-required', 409);
      const plan = validateSmartLessonPlan(draft.content, draft.task.durationMinutes);
      assertPlanMatchesConfirmedTask(plan, draft.task);
      await assertPlanSourceBindingsCanonical(tx as unknown as SmartLessonDb, draft.task, plan);
      const checks = deterministicPlanChecks(plan);
      if (checks.length > 0) throw new SmartLessonPlanError(`deterministic-check-failed:${checks[0].code}`, 409);
      const approvalHash = approvalRequestHash(draft.id, draft.contentHash);
      requestHash = approvalHash;
      const latest = await tx.smartLessonRevision.findFirst({ where: { taskId: draft.taskId }, orderBy: { revisionNumber: 'desc' }, select: { revisionNumber: true } });
      const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
      const revision = await tx.smartLessonRevision.create({
        data: {
          ownerId: draft.ownerId,
          taskId: draft.taskId,
          draftId: draft.id,
          revisionNumber,
          displayName: `教案第${revisionNumber}版`,
          content: asJson(plan),
          contentHash: draft.contentHash,
          sourcesSnapshot: asJson(draft.task.sources.map((source) => source.sourceVersionId)),
          knowledgeSnapshot: asJson(draft.task.knowledgePoints),
          goalsSnapshot: asJson(draft.task.goals),
          provenanceSnapshot: asJson({
            generationJobId: draft.jobs[0]?.id ?? null,
            stages: draft.jobs[0]?.stages.map((stage) => ({
              kind: stage.kind,
              outputHash: stage.outputHash,
              attempts: stage.attempts.map(providerAttemptAuditSnapshot),
            })) ?? [],
          }),
          approvalIdempotencyKey: idempotencyKey,
          approvalRequestHash: approvalHash,
          approvedById: actor.id,
        },
      });
      await tx.courseBasisReferenceLink.createMany({
        data: draft.task.sources.map((source) => ({
          versionId: source.sourceVersionId,
          referenceType: 'LESSON_PLAN_REVISION' as const,
          referenceId: revision.id,
        })),
        skipDuplicates: true,
      });
      await tx.smartLessonDraft.update({
        where: { id: draft.id },
        data: { state: 'APPROVED', approvedRevisionNumber: revisionNumber },
      });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const replay = await db.smartLessonRevision.findFirst({
        where: { ownerId: actor.id, approvalIdempotencyKey: idempotencyKey },
      });
      if (replay && replay.draftId === draftId && requestHash && replay.approvalRequestHash === requestHash) return replay;
      throw new SmartLessonPlanError('idempotency-key-conflict', 409);
    }
    throw error;
  }
}

type JobCommandInput = { actor: SmartLessonActor; jobId: string; idempotencyKey: string };

async function transitionGenerationJob(
  db: SmartLessonDb,
  input: JobCommandInput,
  action: 'RESUME' | 'CANCEL' | 'RETRY',
  allowedStates: string[],
  transition: (tx: Prisma.TransactionClient, job: Awaited<ReturnType<Prisma.TransactionClient['smartLessonGenerationJob']['findFirstOrThrow']>>, now: Date) => Promise<unknown>,
) {
  const actor = validateActor(input.actor);
  const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = contentHash({ jobId: input.jobId, ...('stage' in input ? { stage: input.stage } : {}) });
  const replay = await findCommandReplay(db, actor, action, idempotencyKey, requestHash);
  if (replay) return replay;
  try {
    return await db.$transaction(async (tx) => {
      const job = await tx.smartLessonGenerationJob.findFirst({ where: ownedWhere(actor, { id: validateId(input.jobId) }) });
      if (!job) throw new SmartLessonPlanError('generation-job-not-found', 404);
      if (!allowedStates.includes(job.state)) throw new SmartLessonPlanError(`generation-job-${action.toLowerCase()}-invalid`, 409);
      const updated = await transition(tx, job as never, new Date());
      await recordCommand(tx, { ownerId: job.ownerId, jobId: job.id, action, idempotencyKey, requestHash, result: jobSnapshot(updated) });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isRetryableTransactionConflict(error)) {
      const replayAfterRace = await findCommandReplay(db, actor, action, idempotencyKey, requestHash);
      if (replayAfterRace) return replayAfterRace;
    }
    throw error;
  }
}

async function findCommandReplay(db: SmartLessonDb, actor: SmartLessonActor, action: string, idempotencyKey: string, requestHash: string) {
  const command = await db.smartLessonGenerationCommand.findFirst({
    where: { ownerId: actor.id, action, idempotencyKey },
  });
  if (!command) return null;
  if (command.requestHash !== requestHash) throw new SmartLessonPlanError('idempotency-key-conflict', 409);
  return db.smartLessonGenerationJob.findFirst({ where: ownedWhere(actor, { id: command.jobId }) });
}

async function recordCommand(tx: Prisma.TransactionClient, input: {
  ownerId: string;
  jobId: string;
  action: string;
  idempotencyKey: string;
  requestHash: string;
  result: unknown;
}) {
  const { result, ...command } = input;
  await tx.smartLessonGenerationCommand.create({
    data: { ...command, resultSnapshot: asJson(result) },
  });
}

function assertGenerationReady(draft: {
  state: string;
  task: {
    scopeConfirmedAt: Date | null;
    goalsConfirmedAt: Date | null;
    sources: unknown[];
    knowledgePoints: unknown[];
    goals: unknown[];
  };
}) {
  if (draft.state === 'APPROVED') throw new SmartLessonPlanError('approved-draft-immutable', 409);
  if (!draft.task.scopeConfirmedAt) throw new SmartLessonPlanError('scope-confirmation-required', 409);
  if (!draft.task.goalsConfirmedAt || draft.task.goals.length === 0) throw new SmartLessonPlanError('goal-confirmation-required', 409);
  if (draft.task.sources.length === 0) throw new SmartLessonPlanError('source-version-required', 409);
  if (draft.task.knowledgePoints.length === 0) throw new SmartLessonPlanError('knowledge-point-confirmation-required', 409);
}

async function assertGenerationInputUnchanged(
  tx: Prisma.TransactionClient,
  job: { draftId: string; taskRevision: number; inputHash: string },
) {
  const draft = await tx.smartLessonDraft.findUnique({
    where: { id: job.draftId },
    include: {
      task: {
        include: {
          sources: { where: { state: 'SELECTED' }, select: { sourceVersionId: true } },
          knowledgePoints: { where: { state: 'CONFIRMED' } },
          goals: { where: { state: 'CONFIRMED' } },
        },
      },
    },
  });
  if (!draft) throw new SmartLessonPlanError('draft-not-found', 404);
  const currentHash = smartLessonGenerationInputHash(draft.task);
  if (draft.task.revision !== job.taskRevision || currentHash !== job.inputHash) {
    throw new SmartLessonPlanError('generation-input-changed', 409);
  }
}

async function resolveTaskHistorySession(
  tx: Prisma.TransactionClient,
  input: {
    actor: SmartLessonActor;
    task: { id: string; ownerId: string; courseBasisId: string };
    expectedRevision: number;
    agentSessionId?: string;
  },
) {
  if (input.agentSessionId) {
    const session = await tx.agentSession.findFirst({
      where: { id: validateId(input.agentSessionId), ownerUserId: input.task.ownerId },
      select: { id: true, stateJson: true },
    });
    if (!session) throw new SmartLessonPlanError('agent-session-not-found', 404);
    const state = recordJson(session.stateJson);
    const binding = recordJson(state.smartPrepBinding);
    if (binding.taskId !== input.task.id || binding.taskRevision !== String(input.expectedRevision)) {
      throw new SmartLessonPlanError('agent-session-task-revision-conflict', 409);
    }
    return session;
  }
  const existing = await tx.agentSession.findFirst({
    where: {
      ownerUserId: input.task.ownerId,
      courseId: input.task.courseBasisId,
      pageId: 'smart-prep-task-history',
      stateJson: { path: ['smartLessonTaskId'], equals: input.task.id },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, stateJson: true },
  });
  if (existing) return existing;
  return tx.agentSession.create({
    data: {
      ownerUserId: input.task.ownerId,
      actorUserId: input.actor.id,
      courseId: input.task.courseBasisId,
      pageId: 'smart-prep-task-history',
      phase: 'task-confirmation-history',
      status: 'active',
      stateJson: asJson({ smartLessonTaskId: input.task.id }),
      permittedTools: [],
    },
    select: { id: true, stateJson: true },
  });
}

function taskDecisionSnapshot(task: {
  id: string;
  revision: number;
  topic: string;
  audience: string;
  prerequisites: string;
  durationMinutes: number;
  outlineConfirmationRequired: boolean;
  scopeConfirmedAt: Date | null;
  goalsConfirmedAt: Date | null;
  sources: Array<{ sourceVersionId: string; state: string }>;
  knowledgePoints: Array<{ id: string; lineageId: string; state: string; title: string; sourceState: string; sourceBindings: Prisma.JsonValue; supersedesIds: string[] }>;
  goals: Array<{ id: string; lineageId: string; state: string; content: string; sourceState: string; sourceBindings: Prisma.JsonValue; standardsMappings: Prisma.JsonValue }>;
}) {
  return {
    taskId: task.id,
    revision: task.revision,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites,
    durationMinutes: task.durationMinutes,
    outlineConfirmationRequired: task.outlineConfirmationRequired,
    scopeConfirmedAt: task.scopeConfirmedAt?.toISOString() ?? null,
    goalsConfirmedAt: task.goalsConfirmedAt?.toISOString() ?? null,
    sourceVersionIds: task.sources.filter((source) => source.state === 'SELECTED').map((source) => source.sourceVersionId),
    knowledgePoints: task.knowledgePoints.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, title: item.title, sourceState: item.sourceState,
      sourceBindings: item.sourceBindings, supersedesIds: item.supersedesIds,
    })),
    goals: task.goals.filter((item) => item.state !== 'REMOVED').map((item) => ({
      id: item.id, lineageId: item.lineageId, content: item.content, sourceState: item.sourceState,
      sourceBindings: item.sourceBindings, standardsMappings: item.standardsMappings,
    })),
  };
}

function recordJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validateActor(actor: SmartLessonActor): SmartLessonActor {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || !['TEACHER', 'ADMIN'].includes(actor.role)) {
    throw new SmartLessonPlanError('teacher-or-admin-required', 403);
  }
  return { id: actor.id.trim(), role: actor.role };
}

function ownedWhere(actor: SmartLessonActor, where: Record<string, unknown>) {
  return { ...where, ownerId: actor.id };
}

function readableWhere(actor: SmartLessonActor, where: Record<string, unknown>) {
  return actor.role === 'ADMIN' ? where : { ...where, ownerId: actor.id };
}

function requiredText(value: string, code: string, max: number) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max) throw new SmartLessonPlanError(code);
  return normalized;
}

function optionalText(value: string | null | undefined, max: number) {
  if (value === null || value === undefined) return '';
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > max) throw new SmartLessonPlanError('text-too-long');
  return normalized;
}

function validateId(value: string) {
  return requiredText(value, 'id-invalid', 200);
}

function validateIdempotencyKey(value: string) {
  const normalized = requiredText(value, 'idempotency-key-invalid', 160);
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(normalized)) throw new SmartLessonPlanError('idempotency-key-invalid');
  return normalized;
}

function uniqueIds(values: string[]) {
  return [...new Set(values.map(validateId))];
}

function assertNoClientVerifiedSourceState(items: Array<{ sourceState?: SmartLessonSourceState }>) {
  if (items.some((item) => item.sourceState === 'VERIFIED')) {
    throw new SmartLessonPlanError('verified-source-state-server-owned');
  }
}

function teacherInputSourceState(
  origin: 'SUGGESTED' | 'TEACHER_CREATED',
  requested: SmartLessonSourceState | undefined,
): SmartLessonSourceState {
  if (requested === 'VERIFIED') throw new SmartLessonPlanError('verified-source-state-server-owned');
  if (origin === 'TEACHER_CREATED') return 'TEACHER_CREATED_SOURCE_PENDING';
  return requested ?? 'AI_GENERATED_SOURCE_PENDING';
}

function serverDerivedSourceState(
  origin: 'SUGGESTED' | 'TEACHER_CREATED',
  requested: SmartLessonSourceState | undefined,
  bindings: SmartLessonSourceBinding[],
  verifiedBindingKeys: ReadonlySet<string> | undefined,
  existing?: {
    sourceState: string;
    contentHash: string;
    sourceBindingSetHash: string;
  },
  content?: string,
): SmartLessonSourceState {
  const normalizedBindings = normalizeSourceBindings(bindings);
  if (existing?.sourceState === 'VERIFIED'
    && content
    && existing.contentHash === contentHash(content)
    && existing.sourceBindingSetHash === contentHash(normalizedBindings)) {
    return 'VERIFIED';
  }
  if (normalizedBindings.length > 0
    && verifiedBindingKeys
    && normalizedBindings.every((binding) => verifiedBindingKeys.has(sourceBindingEvidenceKey(binding)))) {
    return 'VERIFIED';
  }
  return teacherInputSourceState(origin, requested === 'VERIFIED' ? undefined : requested);
}

function optionalNonNegativeInteger(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 0) throw new SmartLessonPlanError('token-count-invalid');
  return value;
}

function optionalNonNegativeBigInt(value: bigint | null | undefined) {
  if (value === null || value === undefined) return null;
  if (value < BigInt(0)) throw new SmartLessonPlanError('cost-invalid');
  return value;
}

function canonicalizeItemBindings(
  bindings: SmartLessonSourceBinding[],
  selectedSourceVersionIds: string[],
  canonicalBindings: Map<string, SmartLessonSourceBinding>,
) {
  const selected = new Set(selectedSourceVersionIds);
  return bindings.map((binding) => {
    if (!selected.has(binding.sourceVersionId)) throw new SmartLessonPlanError('source-binding-not-selected');
    const canonical = canonicalBindings.get(sourceBindingEvidenceKey(binding));
    if (!canonical) throw new SmartLessonPlanError('source-binding-unverified');
    return canonical;
  });
}

async function resolveCanonicalSourceBindings(
  db: SmartLessonDb,
  basis: { id: string; ownerId: string },
  sourceVersionIds: string[],
  bindings: SmartLessonSourceBinding[],
) {
  if (bindings.length === 0) return new Map<string, SmartLessonSourceBinding>();
  const projections = await db.courseBasisProjection.findMany({
    where: {
      versionId: { in: sourceVersionIds },
      version: {
        reviewState: 'CONFIRMED',
        retiredAt: null,
        document: { courseBasisId: basis.id, courseBasis: { ownerId: basis.ownerId } },
      },
    },
    select: {
      versionId: true,
      segment: { select: { stableAnchor: true, contentHash: true } },
    },
  });
  const canonical = new Map<string, SmartLessonSourceBinding>();
  for (const projection of projections) {
    const binding = {
      sourceVersionId: projection.versionId,
      anchor: projection.segment.stableAnchor,
      contentHash: projection.segment.contentHash,
      citationId: teacherCourseBasisCitationTargetId({
        courseBasisId: basis.id,
        versionId: projection.versionId,
        stableAnchor: projection.segment.stableAnchor,
      }),
    };
    canonical.set(sourceBindingEvidenceKey(binding), binding);
  }
  return canonical;
}

async function resolveSourcePackVerifiedBindingKeys(
  db: SmartLessonDb,
  ownerId: string,
  sourceVersionIds: string[],
  items: Array<{ content: string; bindings: SmartLessonSourceBinding[] }>,
) {
  const result = new Map<string, ReadonlySet<string>>();
  const byContent = new Map<string, SmartLessonSourceBinding[]>();
  for (const item of items) {
    if (item.bindings.length > 0 && !byContent.has(item.content)) byContent.set(item.content, item.bindings);
  }
  for (const [content, bindings] of byContent) {
    try {
      const actor = { id: ownerId, role: 'TEACHER' as const };
      const sar = await buildCourseBasisLessonDesignSar(db, {
        actor,
        selectedVersionIds: sourceVersionIds,
        query: content,
      });
      const sourcePack = await buildCourseBasisLessonDesignSourcePack(db, {
        actor,
        selectedVersionIds: sourceVersionIds,
        sar,
        retrieval: { query: content, topK: 8 },
      });
      const keys = new Set(sourcePack.retrieval.pack.items.flatMap((item) => {
        const versionId = item.metadata?.versionId;
        const anchor = item.metadata?.stableAnchor;
        const hash = item.metadata?.contentHash;
        if (typeof versionId !== 'string' || typeof anchor !== 'string' || typeof hash !== 'string') return [];
        return [sourceBindingEvidenceKey({ sourceVersionId: versionId, anchor, contentHash: hash })];
      }));
      if (bindings.some((binding) => keys.has(sourceBindingEvidenceKey(binding)))) result.set(content, keys);
    } catch (error) {
      if (!(error instanceof CourseBasisError)) throw error;
      result.set(content, new Set());
    }
  }
  return result;
}

function sourceBindingEvidenceKey(binding: Pick<SmartLessonSourceBinding, 'sourceVersionId' | 'anchor' | 'contentHash'>) {
  return `${binding.sourceVersionId}\u0000${binding.anchor}\u0000${binding.contentHash}`;
}

function approvalRequestHash(draftId: string, draftContentHash: string) {
  return contentHash({ draftId, contentHash: draftContentHash });
}

function providerAttemptAuditSnapshot(attempt: {
  id: string;
  attemptNumber: number;
  idempotencyKey: string;
  serviceId: string;
  providerKind: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  requestHash: string;
  requestSnapshot: Prisma.JsonValue;
  normalizedResponseId: string | null;
  outcome: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: bigint | null;
  startedAt: Date;
  finishedAt: Date | null;
}) {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    idempotencyKey: attempt.idempotencyKey,
    serviceId: attempt.serviceId,
    providerKind: attempt.providerKind,
    model: attempt.model,
    promptVersion: attempt.promptVersion,
    schemaVersion: attempt.schemaVersion,
    requestHash: attempt.requestHash,
    request: attempt.requestSnapshot,
    normalizedResponseId: attempt.normalizedResponseId,
    outcome: attempt.outcome,
    inputTokens: attempt.inputTokens,
    outputTokens: attempt.outputTokens,
    costMicros: attempt.costMicros?.toString() ?? null,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
  };
}

function assertPlanMatchesConfirmedTask(plan: SmartLessonPlan, task: {
  topic: string;
  audience: string;
  prerequisites: string;
  aggregateClassContextRef: string | null;
  courseBasis: { title: string };
  sources: Array<{ sourceVersionId: string }>;
  knowledgePoints: Array<{ id: string; title: string; sourceState: string; sourceBindings: Prisma.JsonValue; gapIdentity: string | null }>;
  goals: Array<{ id: string; content: string; sourceState: string; sourceBindings: Prisma.JsonValue; gapIdentity: string | null }>;
}) {
  if (plan.course !== task.courseBasis.title) throw new SmartLessonPlanError('plan-course-changed', 409);
  if (plan.topic !== task.topic) throw new SmartLessonPlanError('plan-topic-changed', 409);
  if (plan.audience !== task.audience) throw new SmartLessonPlanError('plan-audience-changed', 409);
  if (plan.prerequisites !== task.prerequisites) throw new SmartLessonPlanError('plan-prerequisites-changed', 409);
  if ((plan.classAdaptation?.aggregateContextRef ?? null) !== task.aggregateClassContextRef) {
    throw new SmartLessonPlanError('aggregate-context-ref-changed', 409);
  }
  const selectedSources = new Set(task.sources.map((source) => source.sourceVersionId));
  if (plan.sources.some((source) => !selectedSources.has(source.sourceVersionId))) {
    throw new SmartLessonPlanError('plan-source-not-selected', 409);
  }
  assertConfirmedItemsMatch(
    plan.goals.map((goal) => ({ id: goal.id, content: goal.content, sourceState: goal.sourceState, sourceBindings: goal.sourceBindings, gapIdentity: goal.gapIdentity })),
    task.goals.map((goal) => ({ id: goal.id, content: goal.content, sourceState: goal.sourceState, sourceBindings: goal.sourceBindings, gapIdentity: goal.gapIdentity })),
    'goal',
  );
  assertConfirmedItemsMatch(
    plan.knowledgePoints.map((point) => ({ id: point.id, content: point.title, sourceState: point.sourceState, sourceBindings: point.sourceBindings, gapIdentity: point.gapIdentity })),
    task.knowledgePoints.map((point) => ({ id: point.id, content: point.title, sourceState: point.sourceState, sourceBindings: point.sourceBindings, gapIdentity: point.gapIdentity })),
    'knowledge-point',
  );
}

async function assertPlanSourceBindingsCanonical(
  db: SmartLessonDb,
  task: { id: string; ownerId: string; courseBasisId: string; sources: Array<{ sourceVersionId: string }> },
  plan: SmartLessonPlan,
) {
  const bindings = planSourceBindings(plan);
  const sourceVersionIds = task.sources.map((source) => source.sourceVersionId);
  const canonical = await resolveCanonicalSourceBindings(
    db,
    { id: task.courseBasisId, ownerId: task.ownerId },
    sourceVersionIds,
    bindings,
  );
  for (const binding of bindings) {
    const resolved = canonical.get(sourceBindingEvidenceKey(binding));
    if (!resolved || resolved.citationId !== binding.citationId) {
      throw new SmartLessonPlanError('plan-source-binding-unverified', 409);
    }
  }
}

function planSourceBindings(plan: SmartLessonPlan) {
  return [
    ...plan.sources,
    ...plan.goals.flatMap((goal) => goal.sourceBindings),
    ...plan.knowledgePoints.flatMap((point) => point.sourceBindings),
    ...Object.values(plan.boppps).flatMap((stage) => stage.steps.flatMap((step) => step.sourceBindings)),
  ];
}

function assertOutlineMatchesTask(
  output: ReturnType<typeof smartLessonOutlineOutputSchema.parse>,
  durationMinutes: number,
  aggregateClassContextRef: string | null,
) {
  const counts = new Map<string, number>();
  for (const step of output.coursewareStepOutline) {
    counts.set(step.bopppsStage, (counts.get(step.bopppsStage) ?? 0) + 1);
  }
  for (const stage of ['bridgeIn', 'objectives', 'preAssessment', 'participatoryLearning', 'postAssessment', 'summary']) {
    if (!counts.has(stage)) throw new SmartLessonPlanError(`outline-stage-missing:${stage}`, 409);
  }
  const totalMinutes = output.coursewareStepOutline.reduce((total, step) => total + step.minutes, 0);
  if (totalMinutes !== durationMinutes) throw new SmartLessonPlanError('outline-duration-mismatch', 409);
  if ((output.classAdaptation?.aggregateContextRef ?? null) !== aggregateClassContextRef) {
    throw new SmartLessonPlanError('aggregate-context-ref-changed', 409);
  }
}

function assertConfirmedItemsMatch(
  actual: Array<{ id: string; content: string; sourceState: string; sourceBindings: unknown; gapIdentity: string | null }>,
  expected: Array<{ id: string; content: string; sourceState: string; sourceBindings: unknown; gapIdentity: string | null }>,
  kind: string,
) {
  if (actual.length !== expected.length) throw new SmartLessonPlanError(`${kind}-set-changed`, 409);
  const actualById = new Map(actual.map((item) => [item.id, item]));
  for (const expectedItem of expected) {
    const actualItem = actualById.get(expectedItem.id);
    if (!actualItem || contentHash({
      content: actualItem.content,
      sourceState: actualItem.sourceState,
      sourceBindings: normalizeJsonBindings(actualItem.sourceBindings),
      gapIdentity: actualItem.gapIdentity,
    }) !== contentHash({
      content: expectedItem.content,
      sourceState: expectedItem.sourceState,
      sourceBindings: normalizeJsonBindings(expectedItem.sourceBindings),
      gapIdentity: expectedItem.gapIdentity,
    })) {
      throw new SmartLessonPlanError(`${kind}-changed`, 409);
    }
  }
}

function normalizeJsonBindings(value: unknown) {
  return Array.isArray(value) ? [...value].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) : value;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraint(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRetryableTransactionConflict(error: unknown) {
  return isUniqueConstraint(error)
    || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
}

function jobSnapshot(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  const job = value as { id?: unknown; state?: unknown; firstIncompleteStage?: unknown };
  return { jobId: job.id ?? null, state: job.state ?? null, firstIncompleteStage: job.firstIncompleteStage ?? null };
}

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sourcePackMocks = vi.hoisted(() => ({
  sar: vi.fn(),
  pack: vi.fn(),
}));

vi.mock('../../course-basis/lesson-design-source-pack', () => ({
  buildCourseBasisLessonDesignSar: sourcePackMocks.sar,
  buildCourseBasisLessonDesignSourcePack: sourcePackMocks.pack,
}));

import { contentHash, smartLessonGenerationInputHash } from '../domain';
import { teacherCourseBasisCitationTargetId } from '../../source-pack/teacher-course-basis';
import {
  approveSmartLessonDraft,
  beginProviderAttempt,
  createSmartLessonTask,
  deriveDraftFromRevision,
  failGenerationStage,
  listSmartLessonTaskSummaries,
  listSmartLessonTasks,
  recordAdvisoryReview,
  resumeGenerationJob,
  retryGenerationJob,
  setGenerationStageActionState,
  startGenerationJob,
  updateSmartLessonDraft,
  updatePausedGenerationOutline,
  updateSmartLessonTask,
} from '../service';
import { validPlanFixture } from './fixtures';

const teacher = { id: 'teacher-1', role: 'TEACHER' as const };
const binding = {
  citationId: 'citation-1',
  sourceVersionId: 'version-1',
  anchor: 'chapter-1',
  contentHash: 'a'.repeat(64),
};

function generationTaskFixture(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-07-19T00:00:00.000Z');
  return {
    id: 'task-1', lineageId: 'task-lineage-1', revision: 1, courseBasisId: 'basis-1',
    topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '复数与传递函数',
    durationMinutes: 30, outlineConfirmationRequired: false,
    scopeConfirmedAt: now, goalsConfirmedAt: now,
    aggregateClassContext: null, aggregateClassContextRef: null,
    sources: [{ sourceVersionId: 'version-1' }],
    knowledgePoints: [{
      id: 'kp-1', lineageId: 'kp-lineage-1', title: '稳定性判据', contentHash: contentHash('稳定性判据'),
      sourceState: 'VERIFIED', sourceBindings: [binding], sourceBindingSetHash: contentHash([binding]),
      gapIdentity: null, origin: 'SUGGESTED', supersedesIds: [],
    }],
    goals: [{
      id: 'goal-1', lineageId: 'goal-lineage-1', content: '判断闭环系统稳定性', contentHash: contentHash('判断闭环系统稳定性'),
      sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], sourceBindingSetHash: contentHash([]),
      gapIdentity: `smart-goal-gap:${'b'.repeat(64)}`, standardsMappings: [],
    }],
    ...overrides,
  };
}

function generationTransitionFixture(state: 'CANCELLED' | 'FAILED' | 'RETRYABLE', currentTask = generationTaskFixture()) {
  const originalTask = generationTaskFixture();
  const job: Record<string, any> = {
    id: 'job-1', ownerId: teacher.id, draftId: 'draft-1', state,
    taskRevision: originalTask.revision,
    inputHash: smartLessonGenerationInputHash(originalTask),
    deliveryGeneration: 1,
    firstIncompleteStage: 'OUTLINE',
  };
  const updateJob = vi.fn(async ({ data }) => {
    Object.assign(job, data, {
      deliveryGeneration: data.deliveryGeneration?.increment
        ? job.deliveryGeneration + data.deliveryGeneration.increment
        : job.deliveryGeneration,
    });
    return { ...job };
  });
  const tx = {
    smartLessonGenerationJob: { findFirst: vi.fn(async () => ({ ...job })), update: updateJob },
    smartLessonDraft: {
      findUnique: vi.fn(async () => ({ id: 'draft-1', task: currentTask })),
      update: vi.fn(async () => ({})),
    },
    smartLessonGenerationStage: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => ({ id: 'stage-1', kind: 'OUTLINE', state })),
      update: vi.fn(async () => ({})),
    },
    smartLessonGenerationCommand: { create: vi.fn(async () => ({})) },
  };
  return {
    job,
    tx,
    updateJob,
    db: {
      smartLessonGenerationCommand: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    },
  };
}

function taskRevisionFixture(options: {
  terminalState?: 'FAILED' | 'CANCELLED' | 'COMPLETED';
  verifiedPoint?: boolean;
} = {}) {
  const now = new Date('2026-07-19T00:00:00.000Z');
  const pointBindings = options.verifiedPoint ? [{
    ...binding,
    citationId: 'teacher-course-basis-citation:basis-1:version-1:chapter-1',
  }] : [];
  const pointState = options.verifiedPoint ? 'VERIFIED' : 'TEACHER_CREATED_SOURCE_PENDING';
  const task = {
    id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1', lineageId: 'lineage-1', revision: 2,
    topic: '旧主题', audience: '本科生', prerequisites: '', durationMinutes: 45,
    outlineConfirmationRequired: false, scopeConfirmedAt: now, goalsConfirmedAt: now,
    aggregateClassContext: null, aggregateClassContextRef: null,
    sources: [{ sourceVersionId: 'version-1', state: 'SELECTED' }],
    knowledgePoints: [{
      id: 'kp-1', lineageId: 'kp-lineage', state: 'CONFIRMED', title: '稳定性判据',
      contentHash: contentHash('稳定性判据'), sourceState: pointState,
      sourceBindings: pointBindings, sourceBindingSetHash: contentHash(pointBindings),
      origin: 'SUGGESTED', supersedesIds: [],
    }],
    goals: [{
      id: 'goal-1', lineageId: 'goal-lineage', state: 'CONFIRMED', content: '判断稳定性',
      contentHash: contentHash('判断稳定性'), sourceState: 'TEACHER_CREATED_SOURCE_PENDING',
      sourceBindings: [], sourceBindingSetHash: contentHash([]), standardsMappings: [],
    }],
    drafts: [{ jobs: options.terminalState ? [{ id: 'job-1', state: options.terminalState }] : [] }],
  };
  const updatedTask = { ...task, revision: 3, drafts: [], revisions: [] };
  const tx = {
    smartLessonTask: {
      findFirst: vi.fn(async () => task),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => updatedTask),
    },
    courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
    courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-1' }]) },
    courseBasisProjection: { findMany: vi.fn(async () => [{ versionId: 'version-1', segment: { stableAnchor: binding.anchor, contentHash: binding.contentHash } }]) },
    smartLessonKnowledgePoint: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
    smartLessonGoal: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
    smartLessonSourceSelection: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
    smartLessonGenerationJob: { updateMany: vi.fn(async () => ({ count: options.terminalState ? 1 : 0 })) },
    smartLessonDraft: { updateMany: vi.fn(async () => ({ count: 1 })) },
    agentSession: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'history-session', stateJson: { smartLessonTaskId: task.id } })),
    },
    agentToolRun: { create: vi.fn(async () => ({})) },
  };
  return { task, tx, db: { $transaction: vi.fn(async (run) => run(tx)) } };
}

function taskRevisionInput(verifiedPoint = false) {
  return {
    actor: teacher,
    taskId: 'task-1', expectedRevision: 2, confirmingTurnId: 'turn-22',
    topic: '新主题', audience: '本科生', durationMinutes: 45, sourceVersionIds: ['version-1'],
    knowledgePoints: [{
      id: 'kp-1', content: '稳定性判据', title: '稳定性判据', origin: 'SUGGESTED' as const,
      sourceState: verifiedPoint ? 'VERIFIED' as const : 'TEACHER_CREATED_SOURCE_PENDING' as const,
      sourceBindings: verifiedPoint ? [binding] : [],
    }],
    goals: [{ id: 'goal-1', content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING' as const, sourceBindings: [] }],
    confirmScope: true,
    confirmGoals: true,
  };
}

describe('smart lesson aggregate service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sourcePackMocks.sar.mockResolvedValue({ candidateRefs: { retrievalChunkIds: [] } });
    sourcePackMocks.pack.mockResolvedValue({ retrieval: { pack: { items: [] } } });
  });

  it('loads the latest persisted job, stages, and reviews when reopening the workspace', async () => {
    const findMany = vi.fn(async () => []);
    await listSmartLessonTasks({ smartLessonTask: { findMany } } as never, teacher);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: teacher.id, archivedAt: null },
      include: expect.objectContaining({
        drafts: expect.objectContaining({
          take: 1,
          include: {
            jobs: expect.objectContaining({ take: 1, include: { stages: expect.any(Object) } }),
            reviews: expect.objectContaining({ take: 5 }),
          },
        }),
      }),
    }));
  });

  it('queries bounded archived task summaries with only projection facts', async () => {
    const findMany = vi.fn(async () => []);
    await listSmartLessonTaskSummaries({ smartLessonTask: { findMany } } as never, teacher, {
      archived: true,
      query: '闭环',
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        ownerId: teacher.id,
        archivedAt: { not: null },
        topic: { contains: '闭环', mode: 'insensitive' },
      },
      take: 50,
      select: expect.objectContaining({
        sources: expect.any(Object),
        knowledgePoints: expect.any(Object),
        goals: expect.any(Object),
        coursewarePublicationSeries: expect.any(Object),
      }),
    }));
  });

  it('creates a task only from owner-scoped confirmed sources and persists canonical item state', async () => {
    let createData: Record<string, unknown> | undefined;
    const db = {
      courseBasis: {
        findFirst: vi.fn(async ({ where }) => {
          expect(where).toEqual({ id: 'basis-1', ownerId: teacher.id });
          return { id: 'basis-1', ownerId: teacher.id };
        }),
      },
      courseBasisDocumentVersion: {
        findMany: vi.fn(async ({ where }) => {
          expect(where).toMatchObject({
            id: { in: ['version-1'] },
            reviewState: 'CONFIRMED',
            retiredAt: null,
            document: { courseBasisId: 'basis-1', courseBasis: { ownerId: teacher.id } },
          });
          return [{ id: 'version-1' }];
        }),
      },
      courseBasisProjection: {
        findMany: vi.fn(async () => [{
          versionId: 'version-1',
          segment: { stableAnchor: binding.anchor, contentHash: binding.contentHash },
        }]),
      },
      smartLessonTask: {
        create: vi.fn(async ({ data }) => {
          createData = data;
          return data;
        }),
      },
    };

    const task = await createSmartLessonTask(db as never, {
      actor: teacher,
      courseBasisId: 'basis-1',
      topic: '闭环稳定性',
      audience: '自动化专业本科生',
      durationMinutes: 45,
      sourceVersionIds: ['version-1', 'version-1'],
      confirmScope: true,
      confirmGoals: true,
      knowledgePoints: [{ content: '稳定性判据', origin: 'SUGGESTED', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [] }],
      goals: [{ content: '判断闭环系统稳定性', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [] }],
    });

    expect(task).toBe(createData);
    expect(createData).toMatchObject({
      ownerId: teacher.id,
      courseBasisId: 'basis-1',
      durationMinutes: 45,
      sources: { create: [{ ownerId: teacher.id, sourceVersionId: 'version-1' }] },
      knowledgePoints: { create: [expect.objectContaining({
        state: 'CONFIRMED', sourceState: 'AI_GENERATED_SOURCE_PENDING', gapIdentity: expect.stringMatching(/^smart-goal-gap:/),
        sourceBindings: [],
      })] },
      goals: { create: [expect.objectContaining({ state: 'CONFIRMED', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', gapIdentity: expect.stringMatching(/^smart-goal-gap:/) })] },
      drafts: { create: { ownerId: teacher.id } },
    });
  });

  it('promotes only canonical bindings returned by the lesson-design Source Pack to VERIFIED', async () => {
    sourcePackMocks.pack.mockResolvedValue({
      retrieval: {
        pack: {
          items: [{
            citationTargetId: 'citation-server',
            metadata: { versionId: binding.sourceVersionId, stableAnchor: binding.anchor, contentHash: binding.contentHash },
          }],
        },
      },
    });
    let createData: Record<string, any> | undefined;
    const db = {
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-1' }]) },
      courseBasisProjection: { findMany: vi.fn(async () => [{ versionId: 'version-1', segment: { stableAnchor: binding.anchor, contentHash: binding.contentHash } }]) },
      smartLessonTask: { create: vi.fn(async ({ data }) => { createData = data; return data; }) },
    };

    await createSmartLessonTask(db as never, {
      actor: teacher, courseBasisId: 'basis-1', topic: '稳定性', audience: '本科生', durationMinutes: 45,
      sourceVersionIds: ['version-1'], confirmScope: true, confirmGoals: true,
      knowledgePoints: [{ content: '稳定性判据', origin: 'SUGGESTED', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [binding] }],
      goals: [{ content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
    });

    expect(sourcePackMocks.sar).toHaveBeenCalledWith(db, expect.objectContaining({ query: '稳定性判据' }));
    expect(createData?.knowledgePoints.create[0]).toMatchObject({
      sourceState: 'VERIFIED',
      gapIdentity: null,
      sourceBindings: [{ ...binding, citationId: expect.stringContaining('teacher-course-basis-citation:') }],
    });
  });

  it('rejects source versions that are not all eligible for the owning course basis', async () => {
    const db = {
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => []) },
    };
    await expect(createSmartLessonTask(db as never, {
      actor: teacher,
      courseBasisId: 'basis-1',
      topic: '闭环稳定性',
      audience: '本科生',
      durationMinutes: 45,
      sourceVersionIds: ['foreign-version'],
      knowledgePoints: [{ content: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
    })).rejects.toMatchObject({ code: 'source-version-ineligible' });
  });

  it('updates a task by expected revision and records the superseded decision with its confirming turn', async () => {
    const now = new Date('2026-07-19T00:00:00Z');
    const task = {
      id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1', lineageId: 'lineage-1', revision: 2,
      topic: '旧主题', audience: '本科生', prerequisites: '', durationMinutes: 45,
      outlineConfirmationRequired: false, scopeConfirmedAt: now, goalsConfirmedAt: now,
      aggregateClassContext: null, aggregateClassContextRef: null,
      sources: [{ sourceVersionId: 'version-1', state: 'SELECTED' }],
      knowledgePoints: [
        { id: 'kp-1', lineageId: 'kp-lineage', state: 'CONFIRMED', title: '旧知识点', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], supersedesIds: [] },
        { id: 'kp-removed', lineageId: 'kp-removed-lineage', state: 'REMOVED', title: '已删除知识点', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], supersedesIds: [] },
      ],
      goals: [
        { id: 'goal-1', lineageId: 'goal-lineage', state: 'CONFIRMED', content: '旧目标', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], standardsMappings: [] },
        { id: 'goal-removed', lineageId: 'goal-removed-lineage', state: 'REMOVED', content: '已删除目标', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [], standardsMappings: [] },
      ],
      drafts: [{ jobs: [] }],
    };
    const updatedTask = { ...task, revision: 3, topic: '新主题', courseBasisId: 'basis-2', aggregateClassContextRef: 'diagnosis-1', drafts: [], revisions: [] };
    const createToolRun = vi.fn(async ({ data }) => data);
    const tx = {
      smartLessonTask: {
        findFirst: vi.fn(async () => task),
        updateMany: vi.fn(async ({ where }) => where.revision === 2 ? { count: 1 } : { count: 0 }),
        findUniqueOrThrow: vi.fn(async () => updatedTask),
      },
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-2', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-2' }]) },
      courseBasisProjection: { findMany: vi.fn(async () => [{ versionId: 'version-1', segment: { stableAnchor: binding.anchor, contentHash: binding.contentHash } }]) },
      class: { findFirst: vi.fn(async () => ({ id: 'class-1', _count: { students: 20 } })) },
      diagnosisReportSnapshot: { findFirst: vi.fn(async () => ({ id: 'diagnosis-1', generatedAt: now, snapshot: { dimensions: [] } })) },
      smartLessonKnowledgePoint: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      smartLessonGoal: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      smartLessonSourceSelection: { upsert: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 0 })) },
      smartLessonGenerationJob: { updateMany: vi.fn(async () => ({ count: 0 })) },
      smartLessonDraft: { updateMany: vi.fn(async () => ({ count: 1 })) },
      agentSession: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: 'history-session', stateJson: { smartLessonTaskId: 'task-1' } })),
      },
      agentToolRun: { create: createToolRun },
    };
    const db = { $transaction: vi.fn(async (run) => run(tx)) };

    await expect(updateSmartLessonTask(db as never, {
      actor: teacher, taskId: 'task-1', expectedRevision: 2, confirmingTurnId: 'turn-22',
      courseBasisId: 'basis-2', aggregateClassContextRef: { classId: 'class-1', diagnosisRef: 'diagnosis-1' },
      topic: '新主题', audience: '本科生', durationMinutes: 45, sourceVersionIds: ['version-2'],
      knowledgePoints: [
        { id: 'kp-1', content: '新知识点', title: '新知识点', origin: 'TEACHER_CREATED', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] },
        { id: 'kp-removed', content: '重建知识点', origin: 'TEACHER_CREATED', sourceBindings: [] },
      ],
      goals: [
        { id: 'goal-1', content: '新目标', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] },
        { id: 'goal-removed', content: '重建目标', sourceBindings: [] },
      ],
      confirmScope: true, confirmGoals: true,
    })).resolves.toMatchObject({ id: 'task-1', revision: 3 });
    expect(tx.smartLessonTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1', ownerId: teacher.id, revision: 2 }, data: expect.objectContaining({ courseBasisId: 'basis-2', aggregateClassContextRef: 'diagnosis-1', revision: { increment: 1 } }),
    }));
    expect(createToolRun).toHaveBeenCalledWith({ data: expect.objectContaining({
      agentSessionId: 'history-session', correlationId: 'turn-22', toolName: 'smart_lesson_task_confirm',
      inputSummary: expect.objectContaining({ revision: 2, topic: '旧主题' }),
      outputSummary: expect.objectContaining({ revision: 3, topic: '新主题', confirmingTurnId: 'turn-22', confirmedBy: teacher.id }),
    }) });
    const recreated = (tx.smartLessonKnowledgePoint.upsert.mock.calls as unknown as Array<[{ create: Record<string, any> }]>)[1]![0].create;
    expect(recreated.id).not.toBe('kp-removed');
    expect(recreated.lineageId).not.toBe('kp-removed-lineage');
    expect(recreated.sourceState).toBe('TEACHER_CREATED_SOURCE_PENDING');
    const recreatedGoal = (tx.smartLessonGoal.upsert.mock.calls as unknown as Array<[{ create: Record<string, any> }]>)[1]![0].create;
    expect(recreatedGoal.id).not.toBe('goal-removed');
    expect(recreatedGoal.lineageId).not.toBe('goal-removed-lineage');
    expect(recreatedGoal.gapIdentity).not.toBeNull();
  });

  it('preserves a server-verified item across an unrelated edit without trusting the client state', async () => {
    const fixture = taskRevisionFixture({ verifiedPoint: true });
    sourcePackMocks.pack.mockResolvedValue({ retrieval: { pack: { items: [] } } });

    await updateSmartLessonTask(fixture.db as never, taskRevisionInput(true));

    const update = (fixture.tx.smartLessonKnowledgePoint.upsert.mock.calls as unknown as Array<[{ update: Record<string, unknown> }]>)[0]![0].update;
    expect(update).toMatchObject({ sourceState: 'VERIFIED', gapIdentity: null });
  });

  it('retains a selected source version that retired after the task selected it', async () => {
    const fixture = taskRevisionFixture();

    await expect(updateSmartLessonTask(fixture.db as never, taskRevisionInput()))
      .resolves.toMatchObject({ id: 'task-1', revision: 3 });
    expect(fixture.tx.courseBasisDocumentVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['version-1'] },
        reviewState: 'CONFIRMED',
        OR: [{ retiredAt: null }, { id: { in: ['version-1'] } }],
      }),
    }));
  });

  it('rejects adding a retired source version that the task had not selected', async () => {
    const fixture = taskRevisionFixture();
    fixture.tx.courseBasisDocumentVersion.findMany.mockResolvedValueOnce([]);
    const input = { ...taskRevisionInput(), sourceVersionIds: ['version-retired'] };

    await expect(updateSmartLessonTask(fixture.db as never, input))
      .rejects.toMatchObject({ code: 'source-version-ineligible' });
    expect(fixture.tx.courseBasisDocumentVersion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['version-retired'] },
        OR: [{ retiredAt: null }, { id: { in: [] } }],
      }),
    }));
  });

  it.each(['FAILED', 'CANCELLED', 'COMPLETED'] as const)(
    'supersedes a %s generation job when the task revision changes',
    async (state) => {
      const fixture = taskRevisionFixture({ terminalState: state });

      await updateSmartLessonTask(fixture.db as never, taskRevisionInput());

      expect(fixture.tx.smartLessonGenerationJob.updateMany).toHaveBeenCalledWith({
        where: { draft: { taskId: 'task-1' }, state: { in: ['FAILED', 'CANCELLED', 'COMPLETED'] } },
        data: {
          activeIdentity: null,
          supersededAt: expect.any(Date),
          supersededByTaskRevision: 3,
        },
      });
      expect(fixture.tx.smartLessonDraft.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'EDITABLE' }),
      }));
    },
  );

  it('rejects client-asserted VERIFIED state before accepting its bindings', async () => {
    const db = {
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-1' }]) },
      courseBasisProjection: { findMany: vi.fn(async () => [{
        versionId: 'version-1', segment: { stableAnchor: 'real-anchor', contentHash: binding.contentHash },
      }]) },
    };
    await expect(createSmartLessonTask(db as never, {
      actor: teacher, courseBasisId: 'basis-1', topic: '稳定性', audience: '本科生', durationMinutes: 45,
      sourceVersionIds: ['version-1'],
      knowledgePoints: [{ content: '稳定性', origin: 'SUGGESTED', sourceState: 'VERIFIED', sourceBindings: [{ ...binding, anchor: 'forged-anchor' }] }],
      goals: [{ content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
    })).rejects.toMatchObject({ code: 'verified-source-state-server-owned' });
  });

  it('rejects aggregate class context outside the course-basis owner and unselected item bindings', async () => {
    const db = {
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-1' }]) },
      class: { findFirst: vi.fn(async () => null) },
    };
    const base = {
      actor: teacher,
      courseBasisId: 'basis-1',
      topic: '闭环稳定性',
      audience: '本科生',
      durationMinutes: 45,
      sourceVersionIds: ['version-1'],
      knowledgePoints: [{ content: '稳定性', origin: 'TEACHER_CREATED' as const, sourceState: 'TEACHER_CREATED_SOURCE_PENDING' as const, sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING' as const, sourceBindings: [] }],
    };
    await expect(createSmartLessonTask(db as never, {
      ...base,
      aggregateClassContextRef: { classId: 'foreign-class', diagnosisRef: 'aggregate-1' },
    })).rejects.toMatchObject({ code: 'aggregate-class-context-not-authorized' });

    await expect(createSmartLessonTask({ ...db, class: { findFirst: vi.fn(async () => ({ id: 'class-1' })) } } as never, {
      ...base,
      goals: [{ ...base.goals[0], sourceBindings: [{ ...binding, sourceVersionId: 'unselected-version' }] }],
    })).rejects.toMatchObject({ code: 'source-binding-not-selected' });
  });

  it('builds aggregate context only from an authorized persisted diagnosis snapshot', async () => {
    let createData: Record<string, any> | undefined;
    const db = {
      courseBasis: { findFirst: vi.fn(async () => ({ id: 'basis-1', ownerId: teacher.id })) },
      courseBasisDocumentVersion: { findMany: vi.fn(async () => [{ id: 'version-1' }]) },
      class: { findFirst: vi.fn(async () => ({ id: 'class-1', _count: { students: 24 } })) },
      diagnosisReportSnapshot: { findFirst: vi.fn(async () => ({
        id: 'diagnosis-1', generatedAt: new Date('2026-07-19T00:00:00.000Z'),
        snapshot: { dimensions: [{ dimensionId: 'stability', judgment: 'developing', confidence: 'medium' }], limitations: [{ message: '样本窗口有限' }] },
      })) },
      smartLessonTask: { create: vi.fn(async ({ data }) => { createData = data; return data; }) },
    };
    await createSmartLessonTask(db as never, {
      actor: teacher, courseBasisId: 'basis-1', topic: '稳定性', audience: '本科生', durationMinutes: 45,
      sourceVersionIds: ['version-1'], aggregateClassContextRef: { classId: 'class-1', diagnosisRef: 'diagnosis-1' },
      knowledgePoints: [{ content: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'TEACHER_CREATED_SOURCE_PENDING', sourceBindings: [] }],
    });
    expect(db.diagnosisReportSnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'diagnosis-1', classId: 'class-1', subjectKind: 'class' },
    }));
    expect(createData?.aggregateClassContext).toMatchObject({
      classId: 'class-1', diagnosisRef: 'diagnosis-1', cohortSize: 24,
      dimensions: [{ key: 'stability', level: 'MEDIUM', confidence: 0.65 }],
      constraints: ['样本窗口有限'],
    });
  });

  it('derives a mutable ready draft without changing the approved revision snapshot', async () => {
    const revision = { id: 'revision-1', ownerId: teacher.id, taskId: 'task-1', content: { frozen: true }, contentHash: 'hash-1' };
    const create = vi.fn(async ({ data }) => ({ id: 'draft-2', ...data }));
    const db = {
      smartLessonRevision: { findFirst: vi.fn(async ({ where }) => (where.ownerId === teacher.id ? revision : null)) },
      smartLessonDraft: { findFirst: vi.fn(async () => null), create },
    };
    await expect(deriveDraftFromRevision(db as never, { actor: teacher, revisionId: revision.id })).resolves.toMatchObject({
      basedOnRevisionId: revision.id,
      state: 'READY',
      contentHash: revision.contentHash,
    });
    expect(revision.content).toEqual({ frozen: true });
  });

  it('rejects edits that alter the confirmed goal contract or occur during active generation', async () => {
    const plan = validPlanFixture();
    const task = {
      id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1',
      topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '复数与传递函数',
      aggregateClassContextRef: null, courseBasis: { title: '自动控制原理' },
      durationMinutes: 30,
      sources: [{ sourceVersionId: 'version-1' }],
      knowledgePoints: [{ id: 'kp-1', title: '稳定性判据', sourceState: 'VERIFIED', sourceBindings: [binding], gapIdentity: null }],
      goals: [{ id: 'goal-1', content: '判断闭环系统稳定性', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], gapIdentity: `smart-goal-gap:${'b'.repeat(64)}` }],
    };
    const db = {
      smartLessonDraft: {
        findFirst: vi.fn(async () => ({ id: 'draft-1', ownerId: teacher.id, state: 'READY', version: 1, task })),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({})),
      },
    };
    plan.goals[0].content = '模型擅自扩大后的目标';
    await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: plan }))
      .rejects.toMatchObject({ code: 'goal-changed' });

    db.smartLessonDraft.findFirst.mockResolvedValueOnce({ id: 'draft-1', ownerId: teacher.id, state: 'GENERATING', version: 1, task });
    await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: validPlanFixture() }))
      .rejects.toMatchObject({ code: 'active-generation-locks-draft' });
  });

  it('rejects edited task facts and non-canonical source bindings', async () => {
    const canonicalBinding = {
      ...binding,
      citationId: teacherCourseBasisCitationTargetId({ courseBasisId: 'basis-1', versionId: 'version-1', stableAnchor: 'chapter-1' }),
    };
    const task = {
      id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1', durationMinutes: 30,
      topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '复数与传递函数',
      aggregateClassContextRef: null, courseBasis: { title: '自动控制原理' },
      sources: [{ sourceVersionId: 'version-1' }],
      knowledgePoints: [{ id: 'kp-1', title: '稳定性判据', sourceState: 'VERIFIED', sourceBindings: [canonicalBinding], gapIdentity: null }],
      goals: [{ id: 'goal-1', content: '判断闭环系统稳定性', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], gapIdentity: `smart-goal-gap:${'b'.repeat(64)}` }],
    };
    const findCanonicalProjections = vi.fn(async () => [{
      versionId: 'version-1', segment: { stableAnchor: 'chapter-1', contentHash: 'a'.repeat(64) },
    }]);
    const db = {
      smartLessonDraft: {
        findFirst: vi.fn(async () => ({ id: 'draft-1', ownerId: teacher.id, state: 'READY', version: 1, task })),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => ({})),
      },
      courseBasisProjection: { findMany: findCanonicalProjections },
      $transaction: vi.fn(async (run) => run({
        smartLessonDraft: db.smartLessonDraft,
        smartLessonGenerationJob: { updateMany: vi.fn(async () => ({ count: 0 })) },
      })),
    };
    const canonicalPlan = () => {
      const plan = validPlanFixture();
      plan.knowledgePoints[0].sourceBindings[0].citationId = canonicalBinding.citationId;
      plan.sources[0].citationId = canonicalBinding.citationId;
      for (const stage of Object.values(plan.boppps)) stage.steps[0].sourceBindings[0].citationId = canonicalBinding.citationId;
      return plan;
    };
    const basePlan = canonicalPlan();
    for (const [field, value, code] of [
      ['course', '伪造课程', 'plan-course-changed'],
      ['topic', '伪造主题', 'plan-topic-changed'],
      ['audience', '伪造受众', 'plan-audience-changed'],
      ['prerequisites', '伪造先修要求', 'plan-prerequisites-changed'],
    ] as const) {
      const plan = structuredClone(basePlan);
      plan[field] = value;
      await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: plan }))
        .rejects.toMatchObject({ code });
    }
    for (const forge of [
      (plan: ReturnType<typeof validPlanFixture>) => { plan.sources[0] = { ...plan.sources[0], anchor: 'forged-anchor' }; },
      (plan: ReturnType<typeof validPlanFixture>) => { plan.sources[0] = { ...plan.sources[0], contentHash: 'f'.repeat(64) }; },
      (plan: ReturnType<typeof validPlanFixture>) => { plan.sources[0] = { ...plan.sources[0], citationId: 'forged-citation' }; },
      (plan: ReturnType<typeof validPlanFixture>) => {
        plan.boppps.bridgeIn.steps[0].sourceBindings[0] = { ...plan.boppps.bridgeIn.steps[0].sourceBindings[0], anchor: 'forged-step-anchor' };
      },
    ]) {
      const forged = canonicalPlan();
      forge(forged);
      await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: forged }))
        .rejects.toMatchObject({ code: 'plan-source-binding-unverified' });
    }
    db.smartLessonDraft.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: canonicalPlan() }))
      .rejects.toMatchObject({ code: 'draft-version-conflict' });
    expect(db.smartLessonDraft.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ state: { notIn: ['APPROVED', 'GENERATING'] } }),
    }));
    expect(findCanonicalProjections).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        versionId: { in: ['version-1'] },
        version: expect.not.objectContaining({ retiredAt: null }),
      }),
    }));
  });

  it('atomically supersedes recoverable old jobs after a draft edit without touching a concurrent queued job', async () => {
    const canonicalBinding = {
      ...binding,
      citationId: teacherCourseBasisCitationTargetId({ courseBasisId: 'basis-1', versionId: 'version-1', stableAnchor: 'chapter-1' }),
    };
    const task = {
      id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1', durationMinutes: 30,
      topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '复数与传递函数',
      aggregateClassContextRef: null, courseBasis: { title: '自动控制原理' },
      sources: [{ sourceVersionId: 'version-1' }],
      knowledgePoints: [{ id: 'kp-1', title: '稳定性判据', sourceState: 'VERIFIED', sourceBindings: [canonicalBinding], gapIdentity: null }],
      goals: [{ id: 'goal-1', content: '判断闭环系统稳定性', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], gapIdentity: `smart-goal-gap:${'b'.repeat(64)}` }],
    };
    const plan = validPlanFixture();
    plan.knowledgePoints[0].sourceBindings[0].citationId = canonicalBinding.citationId;
    plan.sources[0].citationId = canonicalBinding.citationId;
    for (const stage of Object.values(plan.boppps)) stage.steps[0].sourceBindings[0].citationId = canonicalBinding.citationId;
    const jobs = [
      { id: 'job-old', draftId: 'draft-1', state: 'FAILED', activeIdentity: 'draft:draft-1', supersededAt: null as Date | null },
      { id: 'job-new', draftId: 'draft-1', state: 'QUEUED', activeIdentity: 'draft:draft-1:new', supersededAt: null as Date | null },
    ];
    const updateJobs = vi.fn(async ({ where, data }) => {
      for (const job of jobs) {
        if (job.draftId === where.draftId && where.state.in.includes(job.state) && job.supersededAt === null) Object.assign(job, data);
      }
      return { count: 1 };
    });
    const draftStore = {
      findFirst: vi.fn(async () => ({ id: 'draft-1', ownerId: teacher.id, state: 'READY', version: 1, task })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async () => ({ id: 'draft-1', state: 'READY', version: 2 })),
    };
    const tx = { smartLessonDraft: draftStore, smartLessonGenerationJob: { updateMany: updateJobs } };
    const db = {
      smartLessonDraft: draftStore,
      courseBasisProjection: { findMany: vi.fn(async () => [{ versionId: 'version-1', segment: { stableAnchor: 'chapter-1', contentHash: 'a'.repeat(64) } }]) },
      $transaction: vi.fn(async (run) => run(tx)),
    };

    await expect(updateSmartLessonDraft(db as never, { actor: teacher, draftId: 'draft-1', expectedVersion: 1, content: plan }))
      .resolves.toMatchObject({ version: 2 });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(updateJobs).toHaveBeenCalledWith({
      where: {
        draftId: 'draft-1', state: { in: ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'] }, supersededAt: null,
      },
      data: { activeIdentity: null, supersededAt: expect.any(Date) },
    });
    expect(jobs[0]).toMatchObject({ activeIdentity: null, supersededAt: expect.any(Date) });
    expect(jobs[1]).toMatchObject({ state: 'QUEUED', activeIdentity: 'draft:draft-1:new', supersededAt: null });

    const recoveryDb = {
      smartLessonGenerationCommand: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async (run) => run({
        smartLessonGenerationJob: { findFirst: vi.fn(async () => ({ ...jobs[0], ownerId: teacher.id })) },
      })),
    };
    await expect(retryGenerationJob(recoveryDb as never, {
      actor: teacher, jobId: 'job-old', idempotencyKey: 'retry-superseded-job',
    })).rejects.toMatchObject({ code: 'generation-job-retry-invalid' });
  });

  it('rejects paused outlines with duplicate stages or a mismatched total duration', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['导入', 'bridgeIn'], ['目标', 'objectives'], ['前测', 'preAssessment'],
        ['参与', 'participatoryLearning'], ['后测', 'postAssessment'], ['总结', 'summary'],
      ].map(([title, bopppsStage]) => ({ title, bopppsStage, minutes: 5 })),
    };
    const tx = {
      smartLessonGenerationJob: { findFirst: vi.fn(async () => ({
        id: 'job-1', state: 'PAUSED', draft: { task: { durationMinutes: 30, aggregateClassContextRef: null } },
        stages: [{ id: 'outline-1', state: 'COMPLETED', outputHash: 'old-outline-hash' }],
      })) },
      smartLessonGenerationStage: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: vi.fn(async () => ({})),
      },
    };
    const db = { $transaction: vi.fn(async (run) => run(tx)) };
    const duplicate = structuredClone(outline);
    duplicate.coursewareStepOutline[5].bopppsStage = 'bridgeIn';
    await expect(updatePausedGenerationOutline(db as never, { actor: teacher, jobId: 'job-1', output: duplicate }))
      .rejects.toMatchObject({ code: 'outline-stage-missing:summary' });
    const wrongDuration = structuredClone(outline);
    wrongDuration.coursewareStepOutline[0].minutes = 10;
    await expect(updatePausedGenerationOutline(db as never, { actor: teacher, jobId: 'job-1', output: wrongDuration }))
      .rejects.toMatchObject({ code: 'outline-duration-mismatch' });
    const forgedContext = {
      ...structuredClone(outline),
      classAdaptation: { aggregateContextRef: 'forged-diagnosis', emphasis: [] },
    };
    await expect(updatePausedGenerationOutline(db as never, { actor: teacher, jobId: 'job-1', output: forgedContext }))
      .rejects.toMatchObject({ code: 'aggregate-context-ref-changed' });
    await expect(updatePausedGenerationOutline(db as never, { actor: teacher, jobId: 'job-1', output: outline }))
      .rejects.toMatchObject({ code: 'paused-outline-conflict' });
    expect(tx.smartLessonGenerationStage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'outline-1', state: 'COMPLETED', outputHash: 'old-outline-hash',
        job: { id: 'job-1', state: 'PAUSED' },
      },
    }));
  });

  it('updates a paused outline through the job-state and old-hash CAS', async () => {
    const outline = {
      keyContent: ['稳定性'], difficultContent: [], limitations: [], classAdaptation: null,
      coursewareStepOutline: [
        ['导入', 'bridgeIn'], ['目标', 'objectives'], ['前测', 'preAssessment'],
        ['参与', 'participatoryLearning'], ['后测', 'postAssessment'], ['总结', 'summary'],
      ].map(([title, bopppsStage]) => ({ title, bopppsStage, minutes: 5 })),
    };
    const persisted = { id: 'outline-1', state: 'COMPLETED', outputHash: contentHash(outline) };
    const tx = {
      smartLessonGenerationJob: { findFirst: vi.fn(async () => ({
        id: 'job-1', state: 'PAUSED', draft: { task: { durationMinutes: 30, aggregateClassContextRef: null } },
        stages: [{ id: 'outline-1', state: 'COMPLETED', outputHash: 'old-outline-hash' }],
      })) },
      smartLessonGenerationStage: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUniqueOrThrow: vi.fn(async () => persisted),
      },
    };
    const db = { $transaction: vi.fn(async (run) => run(tx)) };

    await expect(updatePausedGenerationOutline(db as never, { actor: teacher, jobId: 'job-1', output: outline }))
      .resolves.toBe(persisted);
    expect(tx.smartLessonGenerationStage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'outline-1', state: 'COMPLETED', outputHash: 'old-outline-hash', job: { id: 'job-1', state: 'PAUSED' },
      }),
      data: expect.objectContaining({ outputHash: contentHash(outline) }),
    }));
  });

  it('starts one durable seven-stage job and replays the same command without duplicate creation', async () => {
    const commands: Array<{ ownerId: string; action: string; idempotencyKey: string; requestHash: string; jobId: string }> = [];
    const jobs = new Map<string, Record<string, unknown>>();
    const tx = {
      smartLessonDraft: {
        findFirst: vi.fn(async () => ({
          id: 'draft-1',
          ownerId: teacher.id,
          state: 'EDITABLE',
          task: generationTaskFixture(),
        })),
        update: vi.fn(async () => ({})),
      },
      smartLessonGenerationJob: {
        findFirst: vi.fn(async ({ where }) => [...jobs.values()].find((job) => job.draftId === where.draftId && job.activeIdentity === where.activeIdentity) ?? null),
        create: vi.fn(async ({ data }) => {
          const job = {
            id: data.id,
            ownerId: data.ownerId,
            draftId: data.draftId,
            state: 'QUEUED',
            activeIdentity: data.activeIdentity,
            taskRevision: data.taskRevision,
            inputHash: data.inputHash,
            deliveryGeneration: data.deliveryGeneration,
            firstIncompleteStage: 'OUTLINE',
            stages: data.stages.create,
          };
          jobs.set(String(job.id), job);
          commands.push({ ...data.commands.create, jobId: String(job.id) });
          return job;
        }),
      },
    };
    const db = {
      smartLessonGenerationCommand: {
        findFirst: vi.fn(async ({ where }) => commands.find((command) => command.action === where.action && command.idempotencyKey === where.idempotencyKey && command.ownerId === where.ownerId) ?? null),
      },
      smartLessonGenerationJob: {
        findFirst: vi.fn(async ({ where }) => jobs.get(where.id) ?? null),
      },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    const first = await startGenerationJob(db as never, { actor: teacher, draftId: 'draft-1', idempotencyKey: 'start-request-001' });
    const replay = await startGenerationJob(db as never, { actor: teacher, draftId: 'draft-1', idempotencyKey: 'start-request-001' });

    expect(first.id).toBe(replay?.id);
    expect(tx.smartLessonGenerationJob.create).toHaveBeenCalledTimes(1);
    expect(tx.smartLessonGenerationJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskRevision: 1,
        inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        deliveryGeneration: 1,
        stages: {
          create: [
            expect.objectContaining({ kind: 'OUTLINE', orderIndex: 0 }),
            expect.objectContaining({ kind: 'BRIDGE_IN', orderIndex: 1 }),
            expect.objectContaining({ kind: 'OBJECTIVES', orderIndex: 2 }),
            expect.objectContaining({ kind: 'PRE_ASSESSMENT', orderIndex: 3 }),
            expect.objectContaining({ kind: 'PARTICIPATORY_LEARNING', orderIndex: 4 }),
            expect.objectContaining({ kind: 'POST_ASSESSMENT', orderIndex: 5 }),
            expect.objectContaining({ kind: 'SUMMARY', orderIndex: 6 }),
          ],
        },
      }),
    }));
  });

  it('binds resume to the persisted task input and advances an independent delivery generation', async () => {
    const fixture = generationTransitionFixture('CANCELLED');
    const completedOutline = {
      id: 'stage-1',
      kind: 'OUTLINE',
      state: 'COMPLETED',
      actionState: 'WAITING_CONFIRMATION',
      output: { outline: [{ title: '稳定性判据' }] },
    };
    const incompleteBridgeIn = {
      id: 'stage-2',
      kind: 'BRIDGE_IN',
      state: 'CANCELLED',
      actionState: 'CANCELLED',
      output: null,
    };
    fixture.tx.smartLessonGenerationStage.findFirst.mockResolvedValue(incompleteBridgeIn as never);
    fixture.tx.smartLessonGenerationStage.updateMany.mockImplementation(async (...args: unknown[]) => {
      const { where, data } = args[0] as {
        where: { state?: string | { in: string[] } };
        data: Record<string, unknown>;
      };
      if (where.state === 'COMPLETED') Object.assign(completedOutline, data);
      if (typeof where.state === 'object' && where.state.in.includes(incompleteBridgeIn.state)) {
        Object.assign(incompleteBridgeIn, data);
      }
      return { count: 1 };
    });
    const resumed = await resumeGenerationJob(fixture.db as never, {
      actor: teacher, jobId: 'job-1', idempotencyKey: 'resume-request-001',
    });

    expect(resumed).toMatchObject({ state: 'QUEUED', deliveryGeneration: 2 });
    expect(completedOutline).toEqual({
      id: 'stage-1',
      kind: 'OUTLINE',
      state: 'COMPLETED',
      actionState: 'COMPLETED',
      output: { outline: [{ title: '稳定性判据' }] },
    });
    expect(incompleteBridgeIn).toMatchObject({
      state: 'PENDING',
      actionState: 'WAITING',
      output: null,
    });
    expect(fixture.tx.smartLessonGenerationStage.updateMany).toHaveBeenNthCalledWith(1, {
      where: { jobId: 'job-1', state: 'COMPLETED' },
      data: { actionState: 'COMPLETED' },
    });
    expect(fixture.tx.smartLessonGenerationStage.updateMany).toHaveBeenNthCalledWith(2, {
      where: { jobId: 'job-1', state: { in: ['PAUSED', 'RETRYABLE', 'FAILED', 'CANCELLED'] } },
      data: { state: 'PENDING', actionState: 'WAITING', startedAt: null },
    });
    expect(fixture.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deliveryGeneration: { increment: 1 },
        firstIncompleteStage: 'BRIDGE_IN',
      }),
    }));

    const changed = generationTransitionFixture('CANCELLED', generationTaskFixture({ revision: 2, topic: '已修改主题' }));
    await expect(resumeGenerationJob(changed.db as never, {
      actor: teacher, jobId: 'job-1', idempotencyKey: 'resume-request-002',
    })).rejects.toMatchObject({ code: 'generation-input-changed' });
    expect(changed.updateJob).not.toHaveBeenCalled();
  });

  it('does not let pre-claim evidence preparation overwrite a concurrently cancelled stage', async () => {
    const updateMany = vi.fn(async ({ where }) => ({
      count: where.state === 'PENDING'
        && where.job?.state?.in?.includes('QUEUED')
        ? 0
        : 1,
    }));
    const db = { smartLessonGenerationStage: { updateMany } };

    await expect(setGenerationStageActionState(db as never, {
      actor: teacher,
      jobId: 'job-1',
      stage: 'OUTLINE',
      actionState: 'PREPARING_EVIDENCE',
    })).rejects.toMatchObject({ code: 'generation-stage-action-state-conflict', status: 409 });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        jobId: 'job-1',
        kind: 'OUTLINE',
        state: 'PENDING',
        job: { ownerId: teacher.id, state: { in: ['QUEUED', 'RUNNING'] } },
      },
      data: { actionState: 'PREPARING_EVIDENCE' },
    });
  });

  it('advances delivery generation when retrying a failed stage', async () => {
    const fixture = generationTransitionFixture('RETRYABLE');
    const retried = await retryGenerationJob(fixture.db as never, {
      actor: teacher, jobId: 'job-1', idempotencyKey: 'retry-request-001', stage: 'OUTLINE',
    });

    expect(retried).toMatchObject({ state: 'QUEUED', deliveryGeneration: 2, firstIncompleteStage: 'OUTLINE' });
    expect(fixture.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deliveryGeneration: { increment: 1 } }),
    }));
    expect(fixture.tx.smartLessonGenerationStage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'stage-1' },
      data: expect.objectContaining({ providerAttemptGeneration: { increment: 1 } }),
    }));
  });

  it('claims one persisted attempt identity for duplicate stage delivery', async () => {
    const stage: Record<string, any> = {
      id: 'stage-1', jobId: 'job-1', kind: 'OUTLINE', state: 'PENDING', attemptGeneration: 0,
      claimToken: null, claimExpiresAt: null, startedAt: null,
    };
    const attempts: Array<Record<string, any>> = [];
    const tx = {
      smartLessonGenerationJob: {
        findFirst: vi.fn(async () => ({ id: 'job-1', ownerId: teacher.id, state: 'QUEUED', firstIncompleteStage: 'OUTLINE', startedAt: null })),
        update: vi.fn(async () => ({})),
      },
      smartLessonGenerationStage: {
        findUnique: vi.fn(async () => ({ ...stage })),
        updateMany: vi.fn(async ({ where, data }) => {
          if (where.attemptGeneration !== undefined && where.attemptGeneration !== stage.attemptGeneration) return { count: 0 };
          if (where.state?.in && !where.state.in.includes(stage.state)) return { count: 0 };
          Object.assign(stage, data, {
            attemptGeneration: data.attemptGeneration?.increment ? stage.attemptGeneration + data.attemptGeneration.increment : stage.attemptGeneration,
          });
          return { count: 1 };
        }),
      },
      smartLessonProviderAttempt: {
        findFirst: vi.fn(async () => attempts.find((attempt) => attempt.outcome === 'RUNNING') ?? null),
        create: vi.fn(async ({ data }) => {
          const attempt = { id: `attempt-${attempts.length + 1}`, outcome: 'RUNNING', ...data };
          attempts.push(attempt);
          return attempt;
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const input = {
      actor: teacher, jobId: 'job-1', stage: 'OUTLINE' as const,
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      promptVersion: 'prompt.v1', schemaVersion: 'outline.v1', request: { prompt: 'safe' },
    };
    const first = await beginProviderAttempt(db as never, input);
    const duplicate = await beginProviderAttempt(db as never, input);
    expect(first).toMatchObject({ claimed: true, attempt: { attemptNumber: 1, idempotencyKey: 'smart-lesson-stage:stage-1:generation:1' } });
    expect(duplicate).toMatchObject({ claimed: false, attempt: { id: 'attempt-1' } });
    expect(tx.smartLessonProviderAttempt.create).toHaveBeenCalledTimes(1);
    expect(tx.smartLessonProviderAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      requestHash: contentHash({ prompt: 'safe' }),
      requestSnapshot: { prompt: 'safe' },
    }) });
  });

  it('reuses the persisted provider identity when a retry resumes the same request', async () => {
    const request = { prompt: 'safe' };
    const stage: Record<string, any> = {
      id: 'stage-1', jobId: 'job-1', kind: 'OUTLINE', state: 'RETRYABLE', attemptGeneration: 1,
      claimToken: null, claimExpiresAt: null, startedAt: new Date(),
    };
    const attempt: Record<string, any> = {
      id: 'attempt-1', stageId: stage.id, attemptNumber: 1,
      idempotencyKey: 'smart-lesson-stage:stage-1:generation:1', outcome: 'RETRYABLE_FAILURE',
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      promptVersion: 'prompt.v1', schemaVersion: 'outline.v1', requestHash: contentHash(request),
      finishedAt: new Date(),
    };
    const tx = {
      smartLessonGenerationJob: {
        findFirst: vi.fn(async () => ({ id: 'job-1', ownerId: teacher.id, state: 'QUEUED', firstIncompleteStage: 'OUTLINE', startedAt: new Date() })),
        update: vi.fn(async () => ({})),
      },
      smartLessonGenerationStage: {
        findUnique: vi.fn(async () => ({ ...stage })),
        updateMany: vi.fn(async ({ data }) => {
          Object.assign(stage, data, { attemptGeneration: stage.attemptGeneration + 1 });
          return { count: 1 };
        }),
      },
      smartLessonProviderAttempt: {
        findFirst: vi.fn(async () => ({ ...attempt })),
        create: vi.fn(),
        updateMany: vi.fn(async ({ data }) => { Object.assign(attempt, data); return { count: 1 }; }),
      },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };

    const result = await beginProviderAttempt(db as never, {
      actor: teacher, jobId: 'job-1', stage: 'OUTLINE', request,
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      promptVersion: 'prompt.v1', schemaVersion: 'outline.v1',
    });

    expect(result).toMatchObject({ claimed: true, attempt: { id: 'attempt-1', idempotencyKey: 'smart-lesson-stage:stage-1:generation:1', outcome: 'RUNNING' } });
    expect(stage.attemptGeneration).toBe(2);
    expect(tx.smartLessonProviderAttempt.create).not.toHaveBeenCalled();
  });

  it('keeps the failed job identity reserved so start cannot create a duplicate paid job', async () => {
    const updateJob = vi.fn(async ({ data }) => ({ id: 'job-1', state: data.state, activeIdentity: 'draft:draft-1' }));
    const tx = {
      smartLessonGenerationJob: {
        findFirst: vi.fn(async () => ({ id: 'job-1', ownerId: teacher.id, draftId: 'draft-1' })),
        update: updateJob,
      },
      smartLessonGenerationStage: {
        findUnique: vi.fn(async () => ({ id: 'stage-1', jobId: 'job-1', kind: 'OUTLINE', state: 'RUNNING' })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      smartLessonProviderAttempt: {
        findFirst: vi.fn(async () => ({ id: 'attempt-1', stageId: 'stage-1', outcome: 'RUNNING' })),
        update: vi.fn(async () => ({})),
      },
      smartLessonDraft: { update: vi.fn(async () => ({})) },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) };

    await failGenerationStage(db as never, {
      actor: teacher, jobId: 'job-1', stage: 'OUTLINE', claimToken: 'claim-1', attemptId: 'attempt-1',
      failureCode: 'provider-timeout', retryable: true,
    });

    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ activeIdentity: expect.anything() }),
    }));
  });

  it('generates advisory review and audit on the server and replays without a second provider call', async () => {
    let review: Record<string, any> | null = null;
    const db = {
      smartLessonDraft: { findFirst: vi.fn(async () => ({ id: 'draft-1', ownerId: teacher.id, contentHash: 'plan-hash', content: { topic: '稳定性' } })) },
      smartLessonAdvisoryReview: {
        findFirst: vi.fn(async () => review),
        create: vi.fn(async ({ data }) => { review = { id: 'review-1', ...data }; return review; }),
        update: vi.fn(async ({ data }) => { review = { ...review, ...data }; return review; }),
      },
    };
    const generate = vi.fn(async () => ({
      output: { goalCoverage: '完整', sourceConsistency: '一致', bopppsStructure: '完整', findings: [], suggestions: [] },
      audit: { serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1', promptVersion: 'review.v1', schemaVersion: 'review.v1', normalizedResponseId: 'response-1', inputTokens: 1, outputTokens: 2, costMicros: null },
    }));
    const first = await recordAdvisoryReview(db as never, { actor: teacher, draftId: 'draft-1', idempotencyKey: 'review-request-001' }, generate as never);
    const replay = await recordAdvisoryReview(db as never, { actor: teacher, draftId: 'draft-1', idempotencyKey: 'review-request-001' }, generate as never);
    expect(first).toMatchObject({ state: 'COMPLETED', report: { goalCoverage: '完整' }, providerAudit: { serviceId: 'provider-1' } });
    expect(replay).toEqual(first);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('registers every approved source version as a lesson-plan revision reference', async () => {
    const plan = validPlanFixture();
    const canonicalBinding = {
      ...binding,
      citationId: teacherCourseBasisCitationTargetId({ courseBasisId: 'basis-1', versionId: 'version-1', stableAnchor: 'chapter-1' }),
    };
    plan.sources[0].citationId = canonicalBinding.citationId;
    plan.knowledgePoints[0].sourceBindings[0].citationId = canonicalBinding.citationId;
    for (const stage of Object.values(plan.boppps)) stage.steps[0].sourceBindings[0].citationId = canonicalBinding.citationId;
    const createReferences = vi.fn(async () => ({ count: 2 }));
    const createRevision = vi.fn(async ({ data }) => ({ id: 'revision-1', ...data }));
    const attempt = {
      id: 'attempt-1', attemptNumber: 1, idempotencyKey: 'provider-attempt-1',
      serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
      promptVersion: 'prompt.v1', schemaVersion: 'schema.v1', requestHash: 'request-hash',
      requestSnapshot: { prompt: 'bounded' }, normalizedResponseId: 'response-1', outcome: 'SUCCEEDED',
      inputTokens: 120, outputTokens: 80, costMicros: BigInt(900),
      startedAt: new Date('2026-07-19T00:00:00.000Z'), finishedAt: new Date('2026-07-19T00:00:01.000Z'),
    };
    const tx = {
      smartLessonDraft: {
        findFirst: vi.fn(async () => ({
          id: 'draft-1', ownerId: teacher.id, taskId: 'task-1', state: 'READY',
          content: plan, contentHash: contentHash(plan),
          task: {
            id: 'task-1', ownerId: teacher.id, courseBasisId: 'basis-1',
            topic: '闭环稳定性', audience: '自动化专业本科生', prerequisites: '复数与传递函数',
            aggregateClassContextRef: null, courseBasis: { title: '自动控制原理' },
            durationMinutes: 30,
            sources: [{ sourceVersionId: 'version-1' }, { sourceVersionId: 'version-2' }],
            knowledgePoints: [{ id: 'kp-1', title: '稳定性判据', sourceState: 'VERIFIED', sourceBindings: [canonicalBinding], gapIdentity: null }],
            goals: [{ id: 'goal-1', content: '判断闭环系统稳定性', sourceState: 'AI_GENERATED_SOURCE_PENDING', sourceBindings: [], gapIdentity: `smart-goal-gap:${'b'.repeat(64)}` }],
          },
          jobs: [{ id: 'job-1', stages: [{ kind: 'OUTLINE', outputHash: 'output-hash', attempts: [attempt] }] }],
        })),
        update: vi.fn(async () => ({})),
      },
      smartLessonRevision: {
        findFirst: vi.fn(async () => null),
        create: createRevision,
      },
      courseBasisReferenceLink: { createMany: createReferences },
      courseBasisProjection: { findMany: vi.fn(async () => [{ versionId: 'version-1', segment: { stableAnchor: 'chapter-1', contentHash: 'a'.repeat(64) } }]) },
    };
    const db = {
      smartLessonRevision: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    await approveSmartLessonDraft(db as never, {
      actor: teacher, draftId: 'draft-1', idempotencyKey: 'approve-request-001',
    });

    expect(createReferences).toHaveBeenCalledWith({
      data: [
        { versionId: 'version-1', referenceType: 'LESSON_PLAN_REVISION', referenceId: 'revision-1' },
        { versionId: 'version-2', referenceType: 'LESSON_PLAN_REVISION', referenceId: 'revision-1' },
      ],
      skipDuplicates: true,
    });
    expect(createRevision).toHaveBeenCalledWith({ data: expect.objectContaining({
      provenanceSnapshot: {
        generationJobId: 'job-1',
        stages: [{
          kind: 'OUTLINE', outputHash: 'output-hash', attempts: [expect.objectContaining({
            serviceId: 'provider-1', providerKind: 'openai-compatible', model: 'model-1',
            promptVersion: 'prompt.v1', schemaVersion: 'schema.v1', requestHash: 'request-hash',
            request: { prompt: 'bounded' }, normalizedResponseId: 'response-1', outcome: 'SUCCEEDED',
            inputTokens: 120, outputTokens: 80, costMicros: '900',
            startedAt: '2026-07-19T00:00:00.000Z', finishedAt: '2026-07-19T00:00:01.000Z',
          })],
        }],
      },
    }) });
  });

  it('does not let an ADMIN mutate or approve another owner task', async () => {
    const admin = { id: 'admin-1', role: 'ADMIN' as const };
    const tx = {
      smartLessonDraft: {
        findFirst: vi.fn(async ({ where }) => {
          expect(where).toEqual({ id: 'draft-1', ownerId: admin.id });
          return null;
        }),
      },
    };
    const db = {
      smartLessonRevision: { findFirst: vi.fn(async ({ where }) => {
        expect(where).toEqual({ ownerId: admin.id, approvalIdempotencyKey: 'approve-admin-001' });
        return null;
      }) },
      $transaction: vi.fn(async (callback) => callback(tx)),
    };

    await expect(approveSmartLessonDraft(db as never, {
      actor: admin, draftId: 'draft-1', idempotencyKey: 'approve-admin-001',
    })).rejects.toMatchObject({ code: 'draft-not-found', status: 404 });
  });

  it('rejects an approval idempotency key reused for a different draft', async () => {
    const db = {
      smartLessonRevision: { findFirst: vi.fn(async () => ({
        id: 'revision-1', ownerId: teacher.id, draftId: 'draft-other',
        approvalIdempotencyKey: 'approve-shared-001', approvalRequestHash: 'old-hash',
      })) },
    };

    await expect(approveSmartLessonDraft(db as never, {
      actor: teacher, draftId: 'draft-1', idempotencyKey: 'approve-shared-001',
    })).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
  });

  it('maps an approval P2002 race to a stable idempotency conflict', async () => {
    const unique = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002', clientVersion: 'test', meta: { target: ['ownerId', 'approvalIdempotencyKey'] },
    });
    const findFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'revision-other', ownerId: teacher.id, draftId: 'draft-other',
        approvalIdempotencyKey: 'approve-race-001', approvalRequestHash: 'other-hash',
      });
    const db = {
      smartLessonRevision: { findFirst },
      $transaction: vi.fn(async () => { throw unique; }),
    };

    await expect(approveSmartLessonDraft(db as never, {
      actor: teacher, draftId: 'draft-1', idempotencyKey: 'approve-race-001',
    })).rejects.toMatchObject({ code: 'idempotency-key-conflict', status: 409 });
  });
});

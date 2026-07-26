import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  toolRunFindMany: vi.fn(),
  toolRunFindFirst: vi.fn(),
  toolRunUpdateMany: vi.fn(),
  toolRunUpdate: vi.fn(),
  agentSessionUpdateMany: vi.fn(),
  transaction: vi.fn(),
  listTasks: vi.fn(),
  listTaskSummaries: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deriveDraft: vi.fn(),
  getDraftForEditing: vi.fn(),
  getOutlineForEditing: vi.fn(),
  updateOutline: vi.fn(),
  updateDraft: vi.fn(),
  start: vi.fn(),
  resume: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  enqueue: vi.fn(),
  review: vi.fn(),
  approve: vi.fn(),
  archiveTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.session }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  smartLessonTask: { findMany: mocks.findMany, findFirst: mocks.findFirst },
  agentToolRun: { findMany: mocks.toolRunFindMany, findFirst: mocks.toolRunFindFirst, updateMany: mocks.toolRunUpdateMany, update: mocks.toolRunUpdate },
  agentSession: { updateMany: mocks.agentSessionUpdateMany },
  $transaction: mocks.transaction,
} }));
vi.mock('@/lib/smart-lesson-plan', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/smart-lesson-plan')>(),
  createSmartLessonTask: mocks.createTask,
  updateSmartLessonTask: mocks.updateTask,
  deriveDraftFromRevision: mocks.deriveDraft,
  getSmartLessonDraftForEditing: mocks.getDraftForEditing,
  getPausedGenerationOutlineForEditing: mocks.getOutlineForEditing,
  updatePausedGenerationOutline: mocks.updateOutline,
  listSmartLessonTasks: mocks.listTasks,
  listSmartLessonTaskSummaries: mocks.listTaskSummaries,
  getSmartLessonTask: mocks.getTask,
  updateSmartLessonDraft: mocks.updateDraft,
  startGenerationJob: mocks.start,
  resumeGenerationJob: mocks.resume,
  retryGenerationJob: mocks.retry,
  cancelGenerationJob: mocks.cancel,
  enqueueSmartLessonGenerationJob: mocks.enqueue,
  recordAdvisoryReview: mocks.review,
  approveSmartLessonDraft: mocks.approve,
  archiveSmartLessonTask: mocks.archiveTask,
  deleteSmartLessonTask: mocks.deleteTask,
}));

const teacher = { user: { id: 'teacher-1', role: 'TEACHER' } };
const admin = { user: { id: 'admin-1', role: 'ADMIN' } };
const taskParams = (taskId: string) => ({ params: Promise.resolve({ taskId }) });
const draftParams = (draftId: string) => ({ params: Promise.resolve({ draftId }) });
const jobParams = (jobId: string) => ({ params: Promise.resolve({ jobId }) });
const revisionParams = (revisionId: string) => ({ params: Promise.resolve({ revisionId }) });

describe('smart lesson task routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue(teacher);
    mocks.toolRunUpdateMany.mockResolvedValue({ count: 1 });
    mocks.agentSessionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (run) => run({
      agentToolRun: { findFirst: mocks.toolRunFindFirst, updateMany: mocks.toolRunUpdateMany, update: mocks.toolRunUpdate },
      agentSession: { updateMany: mocks.agentSessionUpdateMany },
    }));
    mocks.enqueue.mockImplementation(async (_db, jobId) => ({ queued: true, job: { id: jobId, draftId: 'draft-1', state: 'QUEUED' }, errorCode: null }));
  });

  it('requires teacher or admin authentication', async () => {
    mocks.session.mockResolvedValue(null);
    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/api/teacher/smart-lesson-tasks'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: 'unauthorized' } });
  });

  it('lists only the teacher owner scope and returns bounded pagination', async () => {
    mocks.listTasks.mockResolvedValue([{ id: 'task-1' }]);
    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/api/teacher/smart-lesson-tasks'));
    expect(mocks.listTasks).toHaveBeenCalledWith(expect.anything(), { id: 'teacher-1', role: 'TEACHER' }, { archived: false });
    expect(await response.json()).toMatchObject({
      tasks: [{ id: 'task-1', workspace: { currentStage: 'course-basis' } }],
    });
  });

  it('allows admin list scope without owner filtering', async () => {
    mocks.session.mockResolvedValue(admin);
    mocks.listTasks.mockResolvedValue([]);
    const { GET } = await import('../route');
    await GET(new Request('http://localhost/api/teacher/smart-lesson-tasks'));
    expect(mocks.listTasks).toHaveBeenCalledWith(expect.anything(), { id: 'admin-1', role: 'ADMIN' }, { archived: false });
  });

  it('returns searchable archived summaries with the persisted five-stage next action', async () => {
    mocks.listTaskSummaries.mockResolvedValue([{
      id: 'task-1',
      topic: '闭环稳定性',
      audience: '本科生',
      durationMinutes: 45,
      scopeConfirmedAt: new Date(),
      goalsConfirmedAt: new Date(),
      archivedAt: new Date(),
      sources: [{ state: 'SELECTED' }],
      knowledgePoints: [{ state: 'CONFIRMED' }],
      goals: [{ state: 'CONFIRMED' }],
      drafts: [{ state: 'EDITABLE', jobs: [{ state: 'FAILED', supersededAt: null }] }],
      revisions: [],
    }]);
    const { GET } = await import('../route');
    const response = await GET(new Request('http://localhost/api/teacher/smart-lesson-tasks?view=summary&archived=true&query=%E9%97%AD%E7%8E%AF'));
    expect(mocks.listTaskSummaries).toHaveBeenCalledWith(expect.anything(), { id: 'teacher-1', role: 'TEACHER' }, {
      archived: true,
      query: '闭环',
    });
    expect(await response.json()).toMatchObject({
      tasks: [{
        id: 'task-1',
        currentStage: 'lesson-generation',
        statusLabel: '已归档',
        nextAction: '从首个未完成阶段恢复',
        complete: false,
      }],
    });
  });

  it('redacts provider and aggregate learner internals from task reads', async () => {
    mocks.getTask.mockResolvedValue({
      id: 'task-1',
      aggregateClassContext: { learnerTrace: 'private' },
      goals: [{ id: 'goal-1', sourceState: 'AI_GENERATED_SOURCE_PENDING' }],
      revisions: [{ id: 'revision-1', taskRevision: 3, revisionNumber: 1, displayName: '教案第1版' }],
      drafts: [{ reviews: [{ id: 'review-1', providerAudit: { model: 'private-model' } }], jobs: [{
        id: 'job-1', state: 'RUNNING', activeIdentity: 'private', stages: [{
          id: 'stage-1', kind: 'OUTLINE', state: 'COMPLETED', output: { sourceState: 'VERIFIED' }, claimToken: 'private', attemptGeneration: 3,
        }],
      }] }],
    });
    const { GET } = await import('../[taskId]/route');
    const response = await GET(new Request('http://localhost'), taskParams('task-1'));
    expect(await response.json()).toMatchObject({ task: {
      id: 'task-1',
      goals: [{ id: 'goal-1', sourceState: 'ai_generated_source_pending' }],
      revisions: [{ id: 'revision-1', taskRevision: 3, revisionNumber: 1, displayName: '教案第1版' }],
      drafts: [{ reviews: [{ id: 'review-1' }], jobs: [{ id: 'job-1', state: 'RUNNING', stages: [{ id: 'stage-1', kind: 'OUTLINE', state: 'COMPLETED', output: { sourceState: 'verified' }, outputTruncated: false }] }] }],
      workspace: {
        currentStage: 'course-basis',
        statusLabel: '正在生成',
        unsupportedPayload: false,
      },
    } });
  });

  it('archives and restores an owner-scoped task', async () => {
    mocks.archiveTask.mockResolvedValue({ id: 'task-1', archivedAt: new Date('2026-07-25T00:00:00Z') });
    mocks.getTask.mockResolvedValue({ id: 'task-1', archivedAt: new Date('2026-07-25T00:00:00Z') });
    const { PUT } = await import('../[taskId]/route');
    const response = await PUT(new Request('http://localhost', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'archive' }),
    }), taskParams('task-1'));
    expect(response.status).toBe(200);
    expect(mocks.archiveTask).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      taskId: 'task-1',
      archived: true,
    });
  });

  it('returns reference categories when permanent deletion is blocked', async () => {
    mocks.deleteTask.mockResolvedValue({
      deleted: false,
      blockers: [{ category: 'publication', count: 1, managementPath: '/teacher/preset-lessons' }],
    });
    const { DELETE } = await import('../[taskId]/route');
    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), taskParams('task-1'));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: 'smart-lesson-task-referenced',
        blockers: [{ category: 'publication', count: 1 }],
        nextAction: 'archive',
      },
    });
  });

  it('atomically revises the owner-scoped task and carries the confirming turn', async () => {
    mocks.updateTask.mockResolvedValue({ id: 'task-1', revision: 4 });
    const { PATCH } = await import('../[taskId]/route');
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: 3, confirmingTurnId: 'turn-9', topic: '新主题', audience: '本科生', prerequisites: '',
        durationMinutes: 45, outlineConfirmationRequired: true, sourceVersionIds: ['version-1'],
        knowledgePoints: [{ id: 'kp-1', content: '稳定性', title: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'verified', sourceBindings: [{ sourceVersionId: 'version-1', anchor: 'a', contentHash: 'a'.repeat(64), citationId: 'citation-1' }] }],
        goals: [{ id: 'goal-1', content: '判断稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [] }],
        confirmScope: true, confirmGoals: true,
      }),
    }), taskParams('task-1'));
    expect(response.status).toBe(200);
    expect(mocks.updateTask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actor: { id: 'teacher-1', role: 'TEACHER' }, taskId: 'task-1', expectedRevision: 3, confirmingTurnId: 'turn-9',
      knowledgePoints: [expect.objectContaining({ sourceState: 'AI_GENERATED_SOURCE_PENDING' })],
    }));
  });

  it('lists owner-scoped Konling task suggestions and preserves clarification alternatives', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'task-1', ownerId: 'teacher-1' });
    mocks.toolRunFindMany.mockResolvedValue([{
      id: 'suggestion-1', agentSessionId: 'agent-session-1', createdAt: new Date('2026-07-19T00:00:00Z'),
      inputSummary: { taskId: 'task-1', expectedRevision: 3, turnId: 'turn-9', clarification: { question: '选择哪个班级？', alternatives: ['一班', '二班'] } },
    }]);
    const { GET } = await import('../[taskId]/konling-suggestions/route');
    const response = await GET(new Request('http://localhost'), taskParams('task-1'));
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions[0]).toMatchObject({
      id: 'suggestion-1', agentSessionId: 'agent-session-1', expectedRevision: 3, turnId: 'turn-9',
      clarification: { question: '选择哪个班级？', alternatives: ['一班', '二班'] },
    });
  });

  it('confirms a Konling suggestion only when owner, session, turn, and revision bindings match', async () => {
    const proposedTask = {
      topic: '新主题', audience: '本科生', prerequisites: '', durationMinutes: 45, outlineConfirmationRequired: false,
      sourceVersionIds: ['version-1'], aggregateClassContextRef: { classId: 'class-1', diagnosisRef: 'diagnosis-1' },
      knowledgePoints: [{ content: '稳定性', title: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'teacher_created_source_pending', sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [], standardsMappings: [] }],
      confirmScope: false, confirmGoals: false,
    };
    mocks.toolRunFindFirst.mockResolvedValue({
      id: 'suggestion-1', agentSessionId: 'agent-session-1',
      inputSummary: { taskId: 'task-1', expectedRevision: 3, turnId: 'turn-9', proposedTask },
      agentSession: { ownerUserId: 'teacher-1', actorUserId: 'teacher-1', stateJson: { currentTurnId: 'turn-10', ownedTurnIds: ['turn-9', 'turn-10'], smartPrepBinding: { taskId: 'task-1', taskRevision: '3', ownerUserId: 'teacher-1' } } },
    });
    mocks.updateTask.mockResolvedValue({ id: 'task-1', revision: 4 });
    mocks.toolRunUpdateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import('../[taskId]/konling-suggestions/[suggestionId]/confirm/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentSessionId: 'agent-session-1', turnId: 'turn-9' }),
    }), { params: Promise.resolve({ taskId: 'task-1', suggestionId: 'suggestion-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.updateTask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      taskId: 'task-1', expectedRevision: 3, agentSessionId: 'agent-session-1', confirmingTurnId: 'turn-9',
      aggregateClassContextRef: { classId: 'class-1', diagnosisRef: 'diagnosis-1' },
      confirmScope: true, confirmGoals: true,
    }));
    expect(mocks.updateTask.mock.calls[0]?.[0]).toMatchObject({
      agentToolRun: { findFirst: mocks.toolRunFindFirst, updateMany: mocks.toolRunUpdateMany },
      agentSession: { updateMany: mocks.agentSessionUpdateMany },
    });
    expect(mocks.toolRunUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ approvalState: { notIn: ['approved', 'confirmation_in_progress'] } }),
      data: { approvalState: 'confirmation_in_progress' },
    }));
    expect(mocks.toolRunUpdateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: 'suggestion-1', approvalState: 'confirmation_in_progress' },
      data: { approvalState: 'approved' },
    }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('does not revise a task when the Konling approval claim loses a race', async () => {
    const proposedTask = {
      topic: '新主题', audience: '本科生', prerequisites: '', durationMinutes: 45, outlineConfirmationRequired: false,
      sourceVersionIds: ['version-1'],
      knowledgePoints: [{ content: '稳定性', title: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'teacher_created_source_pending', sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [], standardsMappings: [] }],
      confirmScope: false, confirmGoals: false,
    };
    mocks.toolRunFindFirst.mockResolvedValue({
      id: 'suggestion-1', agentSessionId: 'agent-session-1',
      inputSummary: { taskId: 'task-1', expectedRevision: 3, turnId: 'turn-9', proposedTask },
      agentSession: {
        ownerUserId: 'teacher-1', actorUserId: 'teacher-1',
        stateJson: { ownedTurnIds: ['turn-9'], smartPrepBinding: { taskId: 'task-1', taskRevision: '3', ownerUserId: 'teacher-1' } },
      },
    });
    mocks.toolRunUpdateMany.mockResolvedValueOnce({ count: 0 });
    const { POST } = await import('../[taskId]/konling-suggestions/[suggestionId]/confirm/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentSessionId: 'agent-session-1', turnId: 'turn-9' }),
    }), { params: Promise.resolve({ taskId: 'task-1', suggestionId: 'suggestion-1' }) });
    expect(response.status).toBe(409);
    expect(mocks.updateTask).not.toHaveBeenCalled();
    expect(mocks.agentSessionUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects a Konling suggestion from a different conversation turn', async () => {
    mocks.toolRunFindFirst.mockResolvedValue({
      id: 'suggestion-1', agentSessionId: 'agent-session-1',
      inputSummary: { taskId: 'task-1', expectedRevision: 3, turnId: 'turn-old', proposedTask: { topic: 'ignored' } },
      agentSession: { ownerUserId: 'teacher-1', actorUserId: 'teacher-1', stateJson: { currentTurnId: 'turn-new', ownedTurnIds: ['turn-new'], smartPrepBinding: { taskId: 'task-1', taskRevision: '3', ownerUserId: 'teacher-1' } } },
    });
    const { POST } = await import('../[taskId]/konling-suggestions/[suggestionId]/confirm/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentSessionId: 'agent-session-1', turnId: 'turn-old' }),
    }), { params: Promise.resolve({ taskId: 'task-1', suggestionId: 'suggestion-1' }) });
    expect(response.status).toBe(409);
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it('rejects a Konling suggestion whose session is bound to another task revision', async () => {
    mocks.toolRunFindFirst.mockResolvedValue({
      id: 'suggestion-1', agentSessionId: 'agent-session-1',
      inputSummary: { taskId: 'task-1', expectedRevision: 3, turnId: 'turn-9', proposedTask: { topic: 'ignored' } },
      agentSession: {
        ownerUserId: 'teacher-1', actorUserId: 'teacher-1',
        stateJson: { ownedTurnIds: ['turn-9'], smartPrepBinding: { taskId: 'task-1', taskRevision: '4', ownerUserId: 'teacher-1' } },
      },
    });
    const { POST } = await import('../[taskId]/konling-suggestions/[suggestionId]/confirm/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentSessionId: 'agent-session-1', turnId: 'turn-9' }),
    }), { params: Promise.resolve({ taskId: 'task-1', suggestionId: 'suggestion-1' }) });
    expect(response.status).toBe(409);
    expect(mocks.toolRunUpdateMany).not.toHaveBeenCalled();
    expect(mocks.updateTask).not.toHaveBeenCalled();
  });

  it('confirms a two-turn bootstrap suggestion once and binds the created task to the same session', async () => {
    const proposedTask = {
      courseBasisId: 'basis-1', topic: '稳定性', audience: '本科生', prerequisites: '', durationMinutes: 45,
      outlineConfirmationRequired: false, sourceVersionIds: ['version-1'],
      knowledgePoints: [{ content: '稳定性', title: '稳定性', origin: 'TEACHER_CREATED', sourceState: 'teacher_created_source_pending', sourceBindings: [] }],
      goals: [{ content: '判断稳定性', sourceState: 'teacher_created_source_pending', sourceBindings: [], standardsMappings: [] }],
      confirmScope: false, confirmGoals: false,
    };
    const sessionState = { currentTurnId: 'turn-2', ownedTurnIds: ['turn-1', 'turn-2'], teachingAssistantMode: 'prep-coauthor' };
    mocks.toolRunFindFirst.mockResolvedValue({
      id: 'bootstrap-1', agentSessionId: 'agent-session-1', approvalState: 'not_required', outputSummary: null,
      inputSummary: { operation: 'bootstrap', turnId: 'turn-2', proposedTask },
      agentSession: { ownerUserId: 'teacher-1', actorUserId: 'teacher-1', stateJson: sessionState },
    });
    mocks.toolRunUpdateMany.mockResolvedValue({ count: 1 });
    mocks.createTask.mockResolvedValue({ id: 'task-created', revision: 1, topic: '稳定性' });
    const { POST } = await import('../konling-suggestions/[suggestionId]/confirm/route');
    const request = () => new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentSessionId: 'agent-session-1', turnId: 'turn-2' }),
    });
    const params = { params: Promise.resolve({ suggestionId: 'bootstrap-1' }) };
    const response = await POST(request(), params);
    expect(response.status).toBe(201);
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
    expect(mocks.createTask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      confirmScope: true,
      confirmGoals: true,
    }));
    expect(mocks.agentSessionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { stateJson: expect.objectContaining({ smartPrepBinding: { taskId: 'task-created', taskRevision: '1', ownerUserId: 'teacher-1' } }) },
    }));

    mocks.toolRunFindFirst.mockResolvedValueOnce({
      id: 'bootstrap-1', agentSessionId: 'agent-session-1', approvalState: 'approved',
      outputSummary: { confirmedTaskId: 'task-created' },
      agentSession: { ownerUserId: 'teacher-1', actorUserId: 'teacher-1', stateJson: sessionState },
    });
    mocks.findFirst.mockResolvedValue({ id: 'task-created', ownerId: 'teacher-1', revision: 1, topic: '稳定性' });
    const replay = await POST(request(), params);
    expect(replay.status).toBe(200);
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
  });

  it('derives an editable draft from an owned approved revision', async () => {
    mocks.deriveDraft.mockResolvedValue({ id: 'draft-2', taskId: 'task-1', state: 'READY', basedOnRevisionId: 'revision-1' });
    const { POST } = await import('../revisions/[revisionId]/drafts/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), revisionParams('revision-1'));
    expect(response.status).toBe(201);
    expect(mocks.deriveDraft).toHaveBeenCalledWith(expect.anything(), { actor: { id: 'teacher-1', role: 'TEACHER' }, revisionId: 'revision-1' });
  });

  it('accepts shared lowercase source states on draft updates and maps them to persistence enums', async () => {
    const { validPlanFixture } = await import('@/lib/smart-lesson-plan/__tests__/fixtures');
    const plan = validPlanFixture();
    plan.goals[0].sourceState = 'ai_generated_source_pending' as never;
    plan.knowledgePoints[0].sourceState = 'verified' as never;
    mocks.updateDraft.mockResolvedValue({ id: 'draft-1', taskId: 'task-1', state: 'READY', version: 2, content: validPlanFixture() });
    const { PATCH } = await import('../drafts/[draftId]/route');
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1, content: plan }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(200);
    expect(mocks.updateDraft).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      content: expect.objectContaining({
        goals: [expect.objectContaining({ sourceState: 'AI_GENERATED_SOURCE_PENDING' })],
        knowledgePoints: [expect.objectContaining({ sourceState: 'VERIFIED' })],
      }),
    }));
    expect((await response.json()).draft.content.goals[0].sourceState).toBe('ai_generated_source_pending');
  });

  it('rejects internal uppercase source states at the public boundary', async () => {
    const { validPlanFixture } = await import('@/lib/smart-lesson-plan/__tests__/fixtures');
    const { PATCH } = await import('../drafts/[draftId]/route');
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1, content: validPlanFixture() }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(400);
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    expect((await response.json()).error.code).toBe('invalid-public-source-state');
  });

  it('rejects unknown create fields before calling the service', async () => {
    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/teacher/smart-lesson-tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unexpected: true }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.createTask).not.toHaveBeenCalled();
    expect((await response.json()).error.code).toBe('invalid-input');
  });

  it('gets a task with owner scope and returns indistinguishable not-found', async () => {
    const { SmartLessonPlanError } = await import('@/lib/smart-lesson-plan');
    mocks.getTask.mockRejectedValue(new SmartLessonPlanError('smart-lesson-task-not-found', 404));
    const { GET } = await import('../[taskId]/route');
    const response = await GET(new Request('http://localhost'), taskParams('task-1'));
    expect(mocks.getTask).toHaveBeenCalledWith(expect.anything(), { actor: { id: 'teacher-1', role: 'TEACHER' }, taskId: 'task-1' });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'smart-lesson-task-not-found' } });
  });

  it('dispatches generation commands without exposing service internals', async () => {
    mocks.retry.mockResolvedValue({ id: 'job-1', draftId: 'draft-1', state: 'QUEUED', secret: 'hidden' });
    const { POST } = await import('../jobs/[jobId]/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'retry', idempotencyKey: 'retry-key-123', stage: 'SUMMARY' }),
    }), jobParams('job-1'));
    expect(mocks.retry).toHaveBeenCalledWith(expect.anything(), { actor: { id: 'teacher-1', role: 'TEACHER' }, jobId: 'job-1', idempotencyKey: 'retry-key-123', stage: 'SUMMARY' });
    expect(await response.json()).toEqual({ job: { id: 'job-1', draftId: 'draft-1', state: 'QUEUED' } });
  });

  it('updates only a persisted paused outline', async () => {
    const expectedOutputHash = 'a'.repeat(64);
    mocks.updateOutline.mockResolvedValue({
      id: 'stage-1',
      kind: 'OUTLINE',
      state: 'COMPLETED',
      output: { title: '提纲' },
      outputHash: 'b'.repeat(64),
      updatedAt: new Date('2026-07-25T00:00:00Z'),
    });
    const { validPlanFixture } = await import('@/lib/smart-lesson-plan/__tests__/fixtures');
    const plan = validPlanFixture();
    const output = {
      keyContent: plan.keyContent,
      difficultContent: plan.difficultContent,
      limitations: plan.limitations,
      classAdaptation: plan.classAdaptation,
      coursewareStepOutline: plan.coursewareStepOutline,
    };
    const { PATCH } = await import('../jobs/[jobId]/outline/route');
    const response = await PATCH(new Request('http://localhost', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedOutputHash, output }),
    }), jobParams('job-1'));
    expect(response.status).toBe(200);
    expect(mocks.updateOutline).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      jobId: 'job-1',
      expectedOutputHash,
      output,
    });
    expect(await response.json()).toMatchObject({ stage: { outputHash: 'b'.repeat(64) } });
  });

  it('returns owner-scoped draft and paused-outline editor documents', async () => {
    mocks.getDraftForEditing.mockResolvedValue({
      id: 'draft-1',
      taskId: 'task-1',
      version: 3,
      state: 'EDITABLE',
      content: { keyContent: [] },
      task: { id: 'task-1', topic: '稳定性' },
    });
    mocks.getOutlineForEditing.mockResolvedValue({
      job: { id: 'job-1', state: 'PAUSED', draft: { task: { id: 'task-1', topic: '稳定性' } } },
      outline: {
        output: { keyContent: [] },
        outputHash: 'c'.repeat(64),
        updatedAt: new Date('2026-07-25T00:00:00Z'),
      },
    });
    const [{ GET: getDraft }, { GET: getOutline }] = await Promise.all([
      import('../drafts/[draftId]/route'),
      import('../jobs/[jobId]/outline/route'),
    ]);

    const draftResponse = await getDraft(new Request('http://localhost'), draftParams('draft-1'));
    const outlineResponse = await getOutline(new Request('http://localhost'), jobParams('job-1'));

    expect(draftResponse.status).toBe(200);
    expect(mocks.getDraftForEditing).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      draftId: 'draft-1',
    });
    expect(await draftResponse.json()).toMatchObject({ draft: { id: 'draft-1', version: 3 }, task: { id: 'task-1' } });
    expect(outlineResponse.status).toBe(200);
    expect(mocks.getOutlineForEditing).toHaveBeenCalledWith(expect.anything(), {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      jobId: 'job-1',
    });
    expect(await outlineResponse.json()).toMatchObject({ outline: { outputHash: 'c'.repeat(64) } });
  });

  it('returns a recoverable 503 instead of leaving a Redis delivery failure queued', async () => {
    mocks.start.mockResolvedValue({ id: 'job-1', draftId: 'draft-1', state: 'QUEUED' });
    mocks.enqueue.mockResolvedValue({
      queued: false,
      job: { id: 'job-1', draftId: 'draft-1', state: 'RETRYABLE', failureCode: 'queue-unavailable' },
      errorCode: 'queue-unavailable',
    });
    const { POST } = await import('../drafts/[draftId]/generation/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'start-key-123' }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      job: { id: 'job-1', state: 'RETRYABLE', failureCode: 'queue-unavailable' },
      error: { code: 'queue-unavailable', retryable: true },
    });
  });

  it('redacts provider audit from advisory review responses', async () => {
    mocks.review.mockResolvedValue({ id: 'review-1', draftId: 'draft-1', contentHash: 'hash', report: { findings: [] }, providerAudit: { model: 'secret-model' }, advisoryOnly: true });
    const { POST } = await import('../drafts/[draftId]/advisory-reviews/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'review-key-123' }),
    }), draftParams('draft-1'));
    const body = await response.json();
    expect(body.review.providerAudit).toBeUndefined();
    expect(body.review.report).toEqual({ findings: [] });
  });

  it('rejects client-authored advisory reports and provider audit', async () => {
    const { POST } = await import('../drafts/[draftId]/advisory-reviews/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: 'review-key-123',
        report: { goalCoverage: '伪造' },
        providerAudit: { model: 'client-selected-model' },
      }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(400);
    expect(mocks.review).not.toHaveBeenCalled();
  });

  it('returns a stable service error DTO', async () => {
    const { SmartLessonPlanError } = await import('@/lib/smart-lesson-plan');
    mocks.approve.mockRejectedValue(new SmartLessonPlanError('draft-version-conflict', 409));
    const { POST } = await import('../drafts/[draftId]/approve/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'approve-key-123' }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: 'draft-version-conflict' } });
  });

  it('maps approval content source states back to the lowercase public contract', async () => {
    const { validPlanFixture } = await import('@/lib/smart-lesson-plan/__tests__/fixtures');
    mocks.approve.mockResolvedValue({
      id: 'revision-1', taskId: 'task-1', draftId: 'draft-1', revisionNumber: 1, displayName: '教案第1版',
      content: validPlanFixture(), contentHash: 'hash', approvedById: 'teacher-1', approvedAt: new Date('2026-07-19T00:00:00Z'),
    });
    const { POST } = await import('../drafts/[draftId]/approve/route');
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: 'approve-key-456' }),
    }), draftParams('draft-1'));
    expect(response.status).toBe(201);
    expect((await response.json()).revision.content.knowledgePoints[0].sourceState).toBe('verified');
  });
});

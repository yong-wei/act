import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readMicroIntervention,
  readMicroInterventionValidationQuestion,
  recordMicroInterventionEvent,
  startMicroIntervention,
  submitMicroInterventionValidation,
  type MicroInterventionDb,
} from '../micro-intervention-outcomes';

const mocks = vi.hoisted(() => ({
  readAvailableRemediationInterventionSource: vi.fn(),
  getAdaptiveQuestionById: vi.fn(),
}));

vi.mock('../remediation-orchestration', () => ({
  REMEDIATION_MANUAL_PRACTICE_PATH: '/assessment/adaptive-practice',
  readAvailableRemediationInterventionSource: mocks.readAvailableRemediationInterventionSource,
}));
vi.mock('../adaptive-engine', () => ({ getAdaptiveQuestionById: mocks.getAdaptiveQuestionById }));

const SOURCE = {
  remediationResultId: 'result-1',
  orchestratorVersion: 'remediation-orchestrator.v1',
  learnerSessionId: 'session-1',
  task: {
    version: 'remediation-task-snapshot.v1' as const,
    goal: 'Frequency response',
    estimatedMinutes: 5,
    sourceQuestionId: 'source-question-private',
    knowledgeNodeId: 'node-1',
    misconceptionTag: 'misconception-private',
    resources: [{
      id: 'resource-1',
      title: 'Governed resource',
      version: 'resource.v1',
      estimatedMinutes: 3,
      actionPath: '/interactive-learning/resources/resource-1',
      registryId: 'resource-1',
      actionId: 'micro-tutoring-action:resource-1',
      actionVersion: 'micro-tutoring-learning-action.v1',
    }],
    validationQuestion: {
      itemRefId: 'item-1',
      questionId: 'validation-question',
      contentHash: 'a'.repeat(64),
      version: 'validation.v1',
      estimatedMinutes: 2,
      actionPath: '/assessment/adaptive-practice',
    },
  },
};

function createDb() {
  let serial = 0;
  const interventions: any[] = [];
  const events: any[] = [];
  const validations: any[] = [];
  const db = {
    microInterventionOutcome: {
      upsert: vi.fn(async (input: any) => {
        const key = input.where.remediationOrchestrationResultId_userId_learnerSessionId_startEventKey;
        const existing = interventions.find((row) => (
          row.remediationOrchestrationResultId === key.remediationOrchestrationResultId &&
          row.userId === key.userId && row.learnerSessionId === key.learnerSessionId &&
          row.startEventKey === key.startEventKey
        ));
        if (existing) return existing;
        const created = {
          id: `intervention-${++serial}`,
          ...input.create,
          startedAt: new Date('2026-08-05T00:00:00.000Z'),
          createdAt: new Date('2026-08-05T00:00:00.000Z'),
        };
        interventions.push(created);
        return created;
      }),
      findFirst: vi.fn(async (input: any) => {
        const where = input.where;
        const row = interventions.find((candidate) => (
          (!where.id || candidate.id === where.id) &&
          (!where.userId || candidate.userId === where.userId)
        ));
        if (!row) return null;
        return {
          ...row,
          events: events.filter((event) => event.interventionId === row.id),
          validation: validations.find((validation) => validation.interventionId === row.id) ?? null,
        };
      }),
    },
    microInterventionEvent: {
      findFirst: vi.fn(async (input: any) => events.find((row) => (
        row.interventionId === input.where.interventionId && row.eventKey === input.where.eventKey
      )) ?? null),
      upsert: vi.fn(async (input: any) => {
        const key = input.where.interventionId_eventKey;
        const existing = events.find((row) => row.interventionId === key.interventionId && row.eventKey === key.eventKey);
        if (existing) return existing;
        const created = { id: `event-${events.length + 1}`, ...input.create, createdAt: input.create.occurredAt };
        events.push(created);
        return created;
      }),
    },
    microInterventionValidation: {
      findFirst: vi.fn(async (input: any) => validations.find((row) => row.interventionId === input.where.interventionId) ?? null),
      upsert: vi.fn(async (input: any) => {
        const existing = validations.find((row) => row.interventionId === input.where.interventionId);
        if (existing) return existing;
        const created = {
          id: `validation-${validations.length + 1}`,
          ...input.create,
          submittedAt: new Date('2026-08-05T00:02:00.000Z'),
          createdAt: new Date('2026-08-05T00:02:00.000Z'),
        };
        validations.push(created);
        return created;
      }),
    },
    knowledgeLink: {
      findMany: vi.fn(async () => []),
    },
    teachingResource: {
      findMany: vi.fn(async () => []),
    },
  };
  return { db: db as unknown as MicroInterventionDb, mocks: db, interventions, events, validations };
}

function governedTransferResource(transferAbility = 0.2) {
  return {
    id: 'transfer-resource',
    title: 'Transfer practice',
    displayName: null,
    description: null,
    type: 'STATIC_TEXT',
    registryId: null,
    content: 'Transfer practice content',
    category: null,
    teacherOnly: false,
    knowledgeNodes: [{ id: '状态空间_9_98b2feda', name: 'State-space transfer', resources: [], tags: [] }],
    config: {
      resourceNodePlanning: {
        estimatedTimeMinutes: 6,
        abilityImpact: transferAbility > 0 ? { crossDomainTransfer: transferAbility } : { controlModeling: 0.2 },
        availability: 'available',
        teacherPolicy: 'allowed',
        privacyLevel: 'student-visible',
        evidenceInstrumentation: ['TeachingResource.interactionLogs'],
        pathDisposition: {
          kind: 'path-plannable',
          reviewStatus: 'human-confirmed',
          rationale: 'Reviewed transfer practice.',
          sourceFamily: 'teaching-resource',
          stableSourceRef: 'transfer-resource',
          sourceVersionRef: 'transfer.v1',
          parentResourceNodeId: null,
          reviewedAt: '2026-08-05T00:00:00.000Z',
          reviewerId: 'reviewer',
          reviewBatchId: 'batch-1',
        },
        readiness: {
          minimumCompetency: {},
          minimumEvidenceCount: 1,
          requiredCompletedNodeIds: [],
          requiredOutcomeRefs: [],
          unlockMessage: 'Ready',
          fallbackNodeIds: [],
        },
      },
    },
  };
}

async function start(db: MicroInterventionDb, startEventKey = 'start-1') {
  return startMicroIntervention({
    db,
    authenticatedUserId: 'learner-1',
    remediationResultId: SOURCE.remediationResultId,
    startEventKey,
  });
}

describe('micro intervention outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue(SOURCE);
    mocks.getAdaptiveQuestionById.mockReturnValue({
      id: 'validation-question',
      options: [
        { label: 'A', text: 'incorrect choice', isCorrect: false },
        { label: 'B', text: 'private correct choice', isCorrect: true },
      ],
    });
  });

  it('creates independent server identities while converging repeated starts', async () => {
    const { db, interventions } = createDb();

    const first = await start(db);
    const retry = await start(db);
    const independent = await start(db, 'start-2');

    expect(first).toMatchObject({ id: 'intervention-1', status: 'STARTED' });
    expect(retry).toMatchObject({ id: 'intervention-1', status: 'STARTED' });
    expect(independent).toMatchObject({ id: 'intervention-2', status: 'STARTED' });
    expect(interventions).toHaveLength(2);
    expect(interventions[0].sourceSnapshot).toEqual(expect.objectContaining({
      remediationResultId: 'result-1',
      orchestratorVersion: 'remediation-orchestrator.v1',
      validationRuntimeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });

  it('accepts an unchanged resource snapshot after JSON storage reorders object keys', async () => {
    const { db, interventions } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const currentSource = structuredClone(SOURCE);
    const stored = interventions[0].sourceSnapshot;
    const resource = stored.task.resources[0];
    stored.task.resources[0] = {
      id: resource.id,
      title: resource.title,
      version: resource.version,
      actionPath: resource.actionPath,
      estimatedMinutes: resource.estimatedMinutes,
      registryId: resource.registryId,
      actionId: resource.actionId,
      actionVersion: resource.actionVersion,
    };
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue(currentSource);

    await expect(readMicroIntervention({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    })).resolves.toMatchObject({ id: started.id, status: 'STARTED' });
  });

  it('normalizes a persisted retired practice path in an adjustment recommendation', async () => {
    const { db, validations } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    validations.push({
      id: 'validation-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      selectedOptionKey: 'A',
      isCorrect: false,
      durationSeconds: 45,
      questionId: 'validation-question',
      questionContentHash: 'a'.repeat(64),
      questionVersion: 'validation.v1',
      recommendationSnapshot: {
        kind: 'ADJUST_TUTORING_STRATEGY',
        basisSummary: 'test',
        manualPracticePath: '/student/practice',
      },
      submittedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(readMicroIntervention({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    })).resolves.toMatchObject({
      status: 'VALIDATED',
      recommendation: {
        kind: 'ADJUST_TUTORING_STRATEGY',
        manualPracticePath: '/assessment/adaptive-practice',
      },
    });
  });

  it('preserves the first event payload for an idempotency key', async () => {
    const { db, events, mocks: dbMocks } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const first = await recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'RESOURCE_USED',
      resourceId: 'resource-1',
    });
    const retry = await recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'RESOURCE_USED',
      resourceId: 'resource-1',
    });
    const completed = await recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'complete-1',
      eventType: 'COMPLETED',
      durationSeconds: 180,
    });

    expect(first).toMatchObject({ status: 'STARTED', progress: { resourceUseCount: 1 } });
    expect(retry).toMatchObject({ status: 'STARTED', progress: { resourceUseCount: 1 } });
    expect(completed).toMatchObject({ status: 'COMPLETED', progress: { durationSeconds: 180 } });
    expect(events).toHaveLength(2);
    expect(dbMocks.microInterventionEvent.upsert).toHaveBeenCalledTimes(2);
    await expect(recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'COMPLETED',
      durationSeconds: 180,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(events).toHaveLength(2);
  });

  it('rejects resource participation without a governed action identity', async () => {
    const { db } = createDb();
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue({
      ...SOURCE,
      task: {
        ...SOURCE.task,
        resources: [{
          id: 'resource-1',
          title: 'Governed resource',
          version: 'resource.v1',
          estimatedMinutes: 3,
          actionPath: '/interactive-learning/resources/resource-1',
        }],
      },
    });
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    await expect(recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'RESOURCE_USED',
      resourceId: 'resource-1',
    })).rejects.toMatchObject({ code: 'EVENT_INVALID' });
  });

  it('rejects a concurrent event write that resolves to a different first payload', async () => {
    const { db, mocks: dbMocks } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    dbMocks.microInterventionEvent.findFirst.mockResolvedValueOnce(null);
    dbMocks.microInterventionEvent.upsert.mockResolvedValueOnce({
      id: 'event-concurrent',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'HINT_REQUESTED',
      resourceId: null,
      durationSeconds: null,
      occurredAt: new Date(),
      createdAt: new Date(),
    });

    await expect(recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'resource-1',
      eventType: 'RESOURCE_USED',
      resourceId: 'resource-1',
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('fails closed when the current remediation snapshot no longer matches the recorded source', async () => {
    const { db } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue({
      ...SOURCE,
      task: {
        ...SOURCE.task,
        validationQuestion: { ...SOURCE.task.validationQuestion, contentHash: 'b'.repeat(64) },
      },
    });

    const result = await readMicroIntervention({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    });

    expect(result).toEqual({ id: started.id, status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' });
  });

  it('records a passing validation without adaptive persistence and reports controlled transfer unavailability', async () => {
    const { db, validations } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const result = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    });

    expect(result).toMatchObject({
      status: 'VALIDATED',
      validation: { isCorrect: true },
      recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE' },
    });
    expect(validations[0]).toEqual(expect.objectContaining({
      selectedOptionKey: 'B',
      questionContentHash: 'a'.repeat(64),
      questionVersion: 'validation.v1',
    }));
    expect(JSON.stringify(result)).not.toContain('source-question-private');
    expect(JSON.stringify(result)).not.toContain('misconception-private');
    expect(JSON.stringify(result)).not.toContain('private correct choice');
    expect(JSON.stringify(result)).not.toContain('session-1');
  });

  it('refuses validation when the runtime question changes after intervention start', async () => {
    const { db, validations } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    mocks.getAdaptiveQuestionById.mockReturnValue({
      id: 'validation-question',
      options: [
        { label: 'A', text: 'now correct', isCorrect: true },
        { label: 'B', text: 'now incorrect', isCorrect: false },
      ],
    });

    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'A',
      durationSeconds: 45,
    })).rejects.toMatchObject({ code: 'VALIDATION_UNAVAILABLE' });
    expect(validations).toHaveLength(0);
  });

  it('preserves a started intervention when its runtime question is unavailable', async () => {
    const { db, validations } = createDb();
    mocks.getAdaptiveQuestionById.mockReturnValue(null);

    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'A',
      durationSeconds: 45,
    })).rejects.toMatchObject({ code: 'VALIDATION_UNAVAILABLE' });
    expect(validations).toHaveLength(0);
  });

  it('reads a started validation question without disclosing its answer or source identifiers', async () => {
    const { db } = createDb();
    mocks.getAdaptiveQuestionById.mockReturnValue({
      id: 'validation-question',
      stem: '选择合适的校正器。',
      options: [
        { label: 'A', text: '错误选项', isCorrect: false, explanation: '不应泄露' },
        { label: 'B', text: '正确选项', isCorrect: true, explanation: '不应泄露' },
      ],
    });
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const question = await readMicroInterventionValidationQuestion({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    });

    expect(question).toEqual({
      id: 'validation-question',
      prompt: '选择合适的校正器。',
      options: [{ label: 'A', text: '错误选项' }, { label: 'B', text: '正确选项' }],
    });
    expect(JSON.stringify(question)).not.toContain('isCorrect');
    expect(JSON.stringify(question)).not.toContain('不应泄露');
    expect(JSON.stringify(question)).not.toContain('source-question-private');
  });

  it('normalizes checkpoint-authored source IDs through start, fetch, and submit', async () => {
    const authoredSourceId = 'root-locus-analysis-foundations-checkpoint-01';
    const runtimeQuestionId = `checkpoint-authored-question:${authoredSourceId}`;
    const authoredQuestion = {
      id: runtimeQuestionId,
      stem: '根轨迹的分离点由什么条件确定？',
      options: [
        { label: 'A', text: '特征方程对增益求导为零', isCorrect: true },
        { label: 'B', text: '仅看开环极点个数', isCorrect: false },
      ],
    };
    const authoredSource = {
      ...SOURCE,
      task: {
        ...SOURCE.task,
        validationQuestion: {
          ...SOURCE.task.validationQuestion,
          questionId: authoredSourceId,
        },
      },
    };
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue(authoredSource);
    mocks.getAdaptiveQuestionById.mockImplementation((questionId: string) => (
      questionId === authoredSourceId || questionId === runtimeQuestionId ? authoredQuestion : null
    ));
    const { db, interventions } = createDb();

    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    expect(interventions[0].sourceSnapshot).toEqual(expect.objectContaining({
      validationRuntimeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(interventions[0].sourceSnapshot.task.validationQuestion.questionId).toBe(runtimeQuestionId);
    expect(mocks.getAdaptiveQuestionById).toHaveBeenCalledWith(authoredSourceId);

    await recordMicroInterventionEvent({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'complete-1',
      eventType: 'COMPLETED',
      durationSeconds: 180,
    });

    const fetched = await readMicroInterventionValidationQuestion({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    });
    expect(fetched).toEqual({
      id: runtimeQuestionId,
      prompt: authoredQuestion.stem,
      options: authoredQuestion.options.map(({ label, text }) => ({ label, text })),
    });

    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: authoredSourceId,
      selectedOption: 'A',
      durationSeconds: 45,
    })).resolves.toMatchObject({
      status: 'VALIDATED',
      validation: { isCorrect: true },
    });
  });

  it('does not backfill a null runtime hash on a legacy intervention', async () => {
    const authoredSourceId = 'root-locus-analysis-foundations-checkpoint-01';
    const runtimeQuestionId = `checkpoint-authored-question:${authoredSourceId}`;
    const authoredSource = {
      ...SOURCE,
      task: {
        ...SOURCE.task,
        validationQuestion: {
          ...SOURCE.task.validationQuestion,
          questionId: authoredSourceId,
        },
      },
    };
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue(authoredSource);
    mocks.getAdaptiveQuestionById.mockReturnValue(null);
    const { db, interventions } = createDb();

    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    expect(interventions[0].sourceSnapshot.validationRuntimeHash).toBeNull();
    expect(interventions[0].sourceSnapshot.task.validationQuestion.questionId).toBe(authoredSourceId);

    mocks.getAdaptiveQuestionById.mockReturnValue({
      id: runtimeQuestionId,
      stem: '根轨迹的分离点由什么条件确定？',
      options: [
        { label: 'A', text: '特征方程对增益求导为零', isCorrect: true },
        { label: 'B', text: '仅看开环极点个数', isCorrect: false },
      ],
    });

    await expect(readMicroInterventionValidationQuestion({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
    })).resolves.toEqual({
      id: started.id,
      status: 'UNAVAILABLE',
      unavailableReason: 'REFERENCE_DRIFT',
    });
    expect(interventions[0].sourceSnapshot.validationRuntimeHash).toBeNull();
  });

  it('rejects a checkpoint-authored alias for a non-authored validation question', async () => {
    const { db } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'checkpoint-authored-question:validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    })).rejects.toMatchObject({ code: 'VALIDATION_INVALID' });
  });

  it('recommends an existing governed transfer practice after a passing validation', async () => {
    const { db, mocks: dbMocks } = createDb();
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue({
      ...SOURCE,
      task: { ...SOURCE.task, knowledgeNodeId: '跨模型验证比较_4_47006' },
    });
    dbMocks.teachingResource.findMany.mockResolvedValue([governedTransferResource()] as any);
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const result = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    });

    expect(result).toMatchObject({
      validation: { isCorrect: true },
      recommendation: {
        kind: 'TRANSFER_PRACTICE',
        actions: [{ actionPath: '/interactive-learning/resources/transfer-resource' }],
      },
    });
    expect(dbMocks.knowledgeLink.findMany).not.toHaveBeenCalled();
    expect(dbMocks.teachingResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        knowledgeNodes: { some: { id: { in: expect.arrayContaining(['状态空间_9_98b2feda']) } } },
      }),
    }));
  });

  it('ignores an ungoverned legacy transfer relation after a passing validation', async () => {
    const { db, mocks: dbMocks } = createDb();
    dbMocks.knowledgeLink.findMany.mockResolvedValue([{
      sourceId: 'node-1',
      targetId: '状态空间_9_98b2feda',
      relation: 'transfers-to',
      targetNode: { id: '状态空间_9_98b2feda', name: 'Legacy transfer', isActive: true },
    }] as any);
    dbMocks.teachingResource.findMany.mockResolvedValue([governedTransferResource()] as any);
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const result = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    });

    expect(result).toMatchObject({
      validation: { isCorrect: true },
      recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE' },
    });
    expect(dbMocks.knowledgeLink.findMany).not.toHaveBeenCalled();
    expect(dbMocks.teachingResource.findMany).not.toHaveBeenCalled();
  });

  it('does not promote a normal resource on a transfer relation into a transfer practice', async () => {
    const { db, mocks: dbMocks } = createDb();
    mocks.readAvailableRemediationInterventionSource.mockResolvedValue({
      ...SOURCE,
      task: { ...SOURCE.task, knowledgeNodeId: '跨模型验证比较_4_47006' },
    });
    dbMocks.teachingResource.findMany.mockResolvedValue([governedTransferResource(0)] as any);
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const result = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    });

    expect(result).toMatchObject({
      validation: { isCorrect: true },
      recommendation: { kind: 'TRANSFER_PRACTICE_UNAVAILABLE' },
    });
  });

  it('prioritizes governed prerequisite splitting after a failed validation', async () => {
    const { db, mocks: dbMocks } = createDb();
    dbMocks.knowledgeLink.findMany.mockResolvedValue([{
      sourceId: 'node-foundation',
      targetId: 'node-1',
      relation: 'prerequisite',
      sourceNode: { id: 'node-foundation', name: 'Foundation concept', isActive: true },
    }] as any);
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');

    const first = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'A',
      durationSeconds: 45,
    });
    const retry = await submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'A',
      durationSeconds: 45,
    });

    expect(first).toMatchObject({
      validation: { isCorrect: false },
      recommendation: {
        kind: 'PREREQUISITE_SPLIT',
        prerequisiteNodes: [{ name: 'Foundation concept' }],
      },
    });
    expect(retry).toMatchObject({ validation: { isCorrect: false }, recommendation: { kind: 'PREREQUISITE_SPLIT' } });
    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-retry',
      questionId: 'validation-question',
      selectedOption: 'A',
      durationSeconds: 45,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects concurrent validation writes when the persisted first answer differs', async () => {
    const { db, mocks: dbMocks } = createDb();
    const started = await start(db);
    if (!started || started.status === 'UNAVAILABLE') throw new Error('expected intervention');
    dbMocks.microInterventionValidation.findFirst.mockResolvedValueOnce(null);
    dbMocks.microInterventionValidation.upsert.mockResolvedValueOnce({
      id: 'validation-concurrent',
      interventionId: started.id,
      eventKey: 'validation-1',
      selectedOptionKey: 'A',
      isCorrect: false,
      durationSeconds: 45,
      questionId: 'validation-question',
      questionContentHash: 'a'.repeat(64),
      questionVersion: 'validation.v1',
      recommendationSnapshot: { kind: 'ADJUST_TUTORING_STRATEGY', basisSummary: 'test', manualPracticePath: '/assessment/adaptive-practice' },
      submittedAt: new Date(),
      createdAt: new Date(),
    });

    await expect(submitMicroInterventionValidation({
      db,
      authenticatedUserId: 'learner-1',
      interventionId: started.id,
      eventKey: 'validation-1',
      questionId: 'validation-question',
      selectedOption: 'B',
      durationSeconds: 45,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readMicroIntervention,
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
      recommendationSnapshot: { kind: 'ADJUST_TUTORING_STRATEGY', basisSummary: 'test', manualPracticePath: '/student/practice' },
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

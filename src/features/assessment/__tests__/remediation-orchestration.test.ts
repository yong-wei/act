import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  orchestrateRemediation,
  readRemediationOrchestration,
  type RemediationOrchestrationDb,
} from '../remediation-orchestration';

const HASH_A = 'a'.repeat(64);

function resource(input: {
  id: string;
  minutes: number;
  misconceptionTags?: string[];
  knowledgeNodeIds?: string[];
  prerequisiteKnowledgeNodeIds?: string[];
  version?: string;
  learnerVisible?: boolean;
  teacherOnly?: boolean;
}) {
  return {
    id: input.id,
    title: `Resource ${input.id}`,
    teacherOnly: input.teacherOnly ?? false,
    knowledgeNodes: (input.knowledgeNodeIds ?? ['node-1']).map((id) => ({ id })),
    config: {
      remediation: {
        version: input.version ?? 'resource.v1',
        estimatedMinutes: input.minutes,
        actionPath: `/resources/${input.id}`,
        learnerVisible: input.learnerVisible ?? true,
        misconceptionTags: input.misconceptionTags ?? ['misconception-1'],
        prerequisiteKnowledgeNodeIds: input.prerequisiteKnowledgeNodeIds ?? [],
      },
    },
  };
}

function validation(input: {
  id?: string;
  minutes?: number;
  questionId?: string;
  contentHash?: string;
  version?: string;
  learnerVisible?: boolean;
  misconceptionTags?: string[];
  sourceQuestionIds?: string[];
}) {
  const id = input.id ?? 'validation-1';
  return {
    id,
    questionId: input.questionId ?? 'question-variant',
    contentHash: input.contentHash ?? HASH_A,
    metadata: {
      remediationValidation: {
        version: input.version ?? 'validation.v1',
        estimatedMinutes: input.minutes ?? 2,
        actionPath: `/assessment/items/${id}`,
        learnerVisible: input.learnerVisible ?? true,
        graphNodeIds: ['node-1'],
        misconceptionTags: input.misconceptionTags ?? ['misconception-1'],
        relationship: {
          kind: 'variant',
          sourceQuestionIds: input.sourceQuestionIds ?? ['question-original'],
        },
      },
    },
  };
}

function persisted(create: Record<string, unknown>, id = 'result-1') {
  return {
    id,
    wrongAnswerAttributionId: create.wrongAnswerAttributionId as string,
    orchestratorVersion: create.orchestratorVersion as string,
    userId: create.userId as string,
    status: create.status as string,
    unavailableReason: (create.unavailableReason as string | undefined) ?? null,
    manualPracticePath: (create.manualPracticePath as string | undefined) ?? null,
    taskSnapshot: create.taskSnapshot ?? null,
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
  };
}

function createDb() {
  const resources = [resource({ id: 'exact', minutes: 3 })];
  const validations = [validation({})];
  const db = {
    wrongAnswerAttribution: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'attribution-1',
        userId: 'learner-1',
        questionId: 'question-original',
        state: 'ATTRIBUTED',
        knowledgeNodeIds: ['node-1'],
        misconceptionTags: ['misconception-1'],
      }),
    },
    knowledgeNode: {
      findFirst: vi.fn().mockResolvedValue({ id: 'node-1', name: 'Frequency response', isActive: true }),
    },
    teachingResource: {
      findMany: vi.fn().mockImplementation(async (input: any) => input.where?.id?.in
        ? resources.filter((item) => input.where.id.in.includes(item.id))
        : resources),
    },
    adaptiveAssessmentItemRef: {
      findMany: vi.fn().mockResolvedValue(validations),
      findFirst: vi.fn().mockImplementation(async (input: any) =>
        validations.find((item) => item.id === input.where.id) ?? null),
    },
    remediationOrchestrationResult: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (input: any) => persisted(input.create)),
    },
  };
  return { db: db as unknown as RemediationOrchestrationDb, mocks: db, resources, validations };
}

describe('remediation orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists a deterministic governed 5–10 minute task without answer material', async () => {
    const { db, mocks, resources } = createDb();
    resources.unshift(
      resource({ id: 'node-only', minutes: 3, misconceptionTags: [] }),
      resource({
        id: 'prerequisite',
        minutes: 3,
        knowledgeNodeIds: ['prerequisite-node'],
        misconceptionTags: [],
        prerequisiteKnowledgeNodeIds: ['node-1'],
      }),
    );

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        estimatedMinutes: 5,
        resources: [{ id: 'exact' }],
        validationQuestion: { itemRefId: 'validation-1', contentHash: HASH_A },
      },
    });
    const create = mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create;
    expect(create.taskSnapshot.resources.map((item: any) => item.id)).toEqual(['exact']);
    expect(JSON.stringify(result)).not.toContain('correctAnswer');
    expect(JSON.stringify(result)).not.toContain('explanation');
    expect(JSON.stringify(result)).not.toContain('options');
  });

  it('returns an existing immutable result without a second write', async () => {
    const { db, mocks } = createDb();
    const taskSnapshot = {
      version: 'remediation-task-snapshot.v1',
      goal: 'Governed goal',
      estimatedMinutes: 5,
      sourceQuestionId: 'question-original',
      knowledgeNodeId: 'node-1',
      misconceptionTag: 'misconception-1',
      resources: [{
        id: 'exact',
        title: 'Resource exact',
        version: 'resource.v1',
        estimatedMinutes: 3,
        actionPath: '/resources/exact',
      }],
      validationQuestion: {
        itemRefId: 'validation-1',
        questionId: 'question-variant',
        contentHash: HASH_A,
        version: 'validation.v1',
        estimatedMinutes: 2,
        actionPath: '/assessment/items/validation-1',
      },
    };
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(persisted({
      wrongAnswerAttributionId: 'attribution-1',
      orchestratorVersion: 'remediation-orchestrator.v1',
      userId: 'learner-1',
      status: 'AVAILABLE',
      taskSnapshot,
    }));

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result?.status).toBe('AVAILABLE');
    expect(mocks.remediationOrchestrationResult.upsert).not.toHaveBeenCalled();
  });

  it('fails closed for an uncertain attribution without storing candidate references', async () => {
    const { db, mocks } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue({
      id: 'attribution-1',
      userId: 'learner-1',
      questionId: 'question-original',
      state: 'UNCERTAIN',
      knowledgeNodeIds: ['node-1', 'node-2'],
      misconceptionTags: ['misconception-1'],
    });

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'ATTRIBUTION_UNCERTAIN' });
    expect(mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create).toEqual(expect.objectContaining({
      status: 'UNAVAILABLE',
      unavailableReason: 'ATTRIBUTION_UNCERTAIN',
      manualPracticePath: '/student/practice',
    }));
    expect(mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create).not.toHaveProperty('taskSnapshot');
  });

  it.each([
    ['RESOURCE_UNAVAILABLE', (mocks: ReturnType<typeof createDb>['mocks']) => {
      mocks.teachingResource.findMany.mockResolvedValue([]);
    }],
    ['VALIDATION_QUESTION_UNAVAILABLE', (mocks: ReturnType<typeof createDb>['mocks']) => {
      mocks.adaptiveAssessmentItemRef.findMany.mockResolvedValue([]);
    }],
    ['TIME_BUDGET_UNAVAILABLE', (mocks: ReturnType<typeof createDb>['mocks']) => {
      mocks.teachingResource.findMany.mockResolvedValue([resource({ id: 'too-long', minutes: 10 })]);
    }],
  ] as const)('persists %s when governed inputs cannot form a task', async (reason, arrange) => {
    const { db, mocks } = createDb();
    arrange(mocks);

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: reason });
  });

  it('does not reveal an attribution owned by another learner', async () => {
    const { db, mocks } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue(null);

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-2', attributionId: 'attribution-1' });

    expect(result).toBeNull();
    expect(mocks.remediationOrchestrationResult.upsert).not.toHaveBeenCalled();
  });

  it('fails closed when resource access is revoked during retrieval', async () => {
    const { db, mocks } = createDb();
    const created = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(await row);
    mocks.teachingResource.findMany.mockResolvedValue([resource({
      id: 'exact',
      minutes: 3,
      learnerVisible: false,
    })]);

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: created!.id,
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'ACCESS_REVOKED' });
    expect(JSON.stringify(result)).not.toContain('Resource exact');
  });

  it('fails closed when a validation reference drifts', async () => {
    const { db, mocks, validations } = createDb();
    await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = await mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(row);
    validations[0] = validation({ contentHash: 'b'.repeat(64) });

    const result = await readRemediationOrchestration({ db, authenticatedUserId: 'learner-1', resultId: 'result-1' });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' });
  });
});

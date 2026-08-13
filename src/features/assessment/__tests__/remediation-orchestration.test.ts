import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findAdaptiveAssessmentCatalogSnapshot,
  type AdaptiveAssessmentCatalogSnapshot,
} from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import type { AdaptiveAssessmentCatalogReviewState } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import { assessmentItemSemanticReviewSourceHash } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  orchestrateRemediation,
  refreshRemediationOrchestration,
  readRemediationOrchestration,
  type RemediationOrchestrationDb,
} from '../remediation-orchestration';

const HASH_A = 'a'.repeat(64);
const currentCatalogSnapshots = new Map<string, AdaptiveAssessmentCatalogSnapshot>();

vi.mock('@/features/adaptive-assessment/adaptive-assessment-catalog-selector', () => ({
  findAdaptiveAssessmentCatalogSnapshot: vi.fn((questionId: string) =>
    currentCatalogSnapshots.get(questionId) ?? null),
}));

function resource(input: {
  id: string;
  minutes: number;
  misconceptionTags?: string[];
  knowledgeNodeIds?: string[];
  prerequisiteKnowledgeNodeIds?: string[];
  version?: string;
  learnerVisible?: boolean;
  teacherOnly?: boolean;
  pathEligible?: boolean;
  brokenTarget?: boolean;
  evidenceComplete?: boolean;
}) {
  const version = input.version ?? 'resource.v1';
  return {
    id: input.id,
    title: `Resource ${input.id}`,
    displayName: null,
    description: null,
    type: 'STATIC_TEXT',
    registryId: null,
    content: input.brokenTarget ? null : `Resource content ${input.id}`,
    category: null,
    teacherOnly: input.teacherOnly ?? false,
    knowledgeNodes: (input.knowledgeNodeIds ?? ['node-1']).map((id) => ({
      id,
      name: `Knowledge ${id}`,
      resources: [],
      tags: [],
    })),
    config: {
      remediation: {
        misconceptionTags: input.misconceptionTags ?? ['misconception-1'],
        prerequisiteKnowledgeNodeIds: input.prerequisiteKnowledgeNodeIds ?? [],
      },
      resourceNodePlanning: {
        estimatedTimeMinutes: input.minutes,
        abilityImpact: { 'ability-remediation': 0.25 },
        availability: 'available',
        teacherPolicy: 'allowed',
        privacyLevel: input.learnerVisible === false ? 'teacher-scoped' : 'student-visible',
        evidenceInstrumentation: input.evidenceComplete === false ? [] : ['TeachingResource.interactionLogs'],
        pathDisposition: {
          kind: 'path-plannable',
          reviewStatus: input.pathEligible === false ? 'generated-provisional' : 'human-confirmed',
          rationale: 'Reviewed for learner remediation.',
          sourceFamily: 'teaching-resource',
          stableSourceRef: input.id,
          sourceVersionRef: version,
          parentResourceNodeId: null,
          reviewedAt: '2026-08-03T00:00:00.000Z',
          reviewerId: 'resource-governance-reviewer',
          reviewBatchId: 'review-batch-1',
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

function validation(input: {
  id?: string;
  minutes?: number;
  questionId?: string;
  contentHash?: string;
  catalogContentHash?: string;
  version?: string;
  learnerVisible?: boolean;
  knowledgeNodeId?: string;
  misconceptionTags?: string[];
  sourceQuestionIds?: string[];
  reviewState?: AdaptiveAssessmentCatalogReviewState;
  stage?: 'remediation' | 'checkpoint';
  reviewSourceHash?: string;
  omitRemediationValidation?: boolean;
}) {
  const id = input.id ?? 'validation-1';
  const questionId = input.questionId ?? 'question-variant';
  const contentHash = input.contentHash ?? HASH_A;
  const catalogContentHash = input.catalogContentHash ?? HASH_A;
  const stage = input.stage ?? 'remediation';
  const knowledgeNodeId = input.knowledgeNodeId ?? 'node-1';
  const decisionWithoutHash = {
    catalogItemId: `catalog-${id}`,
    decisionKind: 'human-review' as const,
    outcome: 'approved' as const,
    reviewerId: 'assessment-reviewer',
    reviewedAt: '2026-08-03T00:00:00.000Z',
    reviewBatchId: 'remediation-validation.v1',
    sourceContentHash: catalogContentHash,
    selectedLearningGoalIds: ['learning-goal-1'],
    selectedKaqObjectiveIds: ['kaq-1'],
    selectedGraphNodeIds: [knowledgeNodeId],
    selectedStagePurpose: stage,
    difficulty: 0.5,
    cognitiveLevel: 'apply',
    misconceptionRefs: input.misconceptionTags ?? ['misconception-1'],
    remediationRefs: ['teaching-resource:exact'],
    metadataVersionRefs: {
      catalogVersion: 'catalog.v1',
      adaptiveAssessmentSnapshotVersion: input.version ?? 'validation.v1',
    },
    notes: 'Reviewed remediation validation item.',
  };
  const reviewDecision = {
    ...decisionWithoutHash,
    reviewSourceHash: input.reviewSourceHash ?? assessmentItemSemanticReviewSourceHash(decisionWithoutHash),
  };
  const catalogSnapshot: AdaptiveAssessmentCatalogSnapshot = {
    catalogItemId: `catalog-${id}`,
    sourceFamily: 'preset-adaptive-question',
    sourceId: questionId,
    sourceAnchor: `test:${questionId}`,
    sourceLineage: {
      sourceFamily: 'preset-adaptive-question',
      sourceId: questionId,
      sourcePath: 'test/remediation.ts',
      sourceHash: catalogContentHash,
    },
    contentHash: catalogContentHash,
    contentHashAlgorithm: 'sha256',
    reviewState: input.reviewState ?? 'path-eligible',
    eligibilityState: input.reviewState ?? 'path-eligible',
    allowedStages: [stage],
    questionRefs: {
      stem: 'Private governed stem',
      answerKey: ['PRIVATE_CORRECT_ANSWER'],
      rubricRef: 'rubric:remediation',
    },
    semanticRefs: {
      learningGoalIds: ['learning-goal-1'],
      kaqObjectiveIds: ['kaq-1'],
      graphNodeIds: [knowledgeNodeId],
      knowledgeTags: ['frequency-response'],
      misconceptionTags: input.misconceptionTags ?? ['misconception-1'],
      remediationResourceNodeIds: ['teaching-resource:exact'],
      difficulty: 0.5,
      cognitiveLevel: 'apply',
      assessmentStage: stage,
    },
    limitations: [],
    reviewDecision,
    versionRefs: {
      catalogVersion: 'catalog.v1',
      adaptiveAssessmentSnapshotVersion: input.version ?? 'validation.v1',
    },
    relationship: {
      relationship: 'answer-time-snapshot',
      immutable: true,
      mayReferenceCatalogItemId: true,
      mayReferenceContentHash: true,
      catalogUpdatesRewriteHistoricalAnswers: false,
    },
  };
  currentCatalogSnapshots.set(questionId, catalogSnapshot);
  return {
    id,
    questionId,
    contentHash,
    metadata: {
      adaptiveAssessmentItemRef: {
        catalogBacked: true,
        snapshotVersion: input.version ?? 'validation.v1',
        ...catalogSnapshot,
      },
      ...(!input.omitRemediationValidation ? { remediationValidation: {
        estimatedMinutes: input.minutes ?? 2,
        actionPath: `/assessment/items/${id}`,
        learnerVisible: input.learnerVisible ?? true,
        graphNodeIds: [knowledgeNodeId],
        misconceptionTags: input.misconceptionTags ?? ['misconception-1'],
        relationship: {
          kind: 'variant',
          sourceQuestionIds: input.sourceQuestionIds ?? ['question-original'],
        },
      } } : {}),
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
  beforeEach(() => {
    vi.clearAllMocks();
    currentCatalogSnapshots.clear();
    vi.mocked(findAdaptiveAssessmentCatalogSnapshot).mockImplementation((questionId) =>
      currentCatalogSnapshots.get(questionId) ?? null);
  });

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
        validationQuestion: {
          itemRefId: 'validation-1',
          contentHash: HASH_A,
          actionPath: '/assessment/adaptive-practice',
        },
      },
    });
    if (!result || result.status !== 'AVAILABLE') throw new Error('Expected available remediation task');
    expect(Object.keys(result.task).sort()).toEqual([
      'estimatedMinutes',
      'goal',
      'resources',
      'validationQuestion',
      'version',
    ]);
    expect(result.task).not.toHaveProperty('sourceQuestionId');
    expect(result.task).not.toHaveProperty('knowledgeNodeId');
    expect(result.task).not.toHaveProperty('misconceptionTag');
    const create = mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create;
    expect(create.taskSnapshot).toEqual(expect.objectContaining({
      sourceQuestionId: 'question-original',
      knowledgeNodeId: 'node-1',
      misconceptionTag: 'misconception-1',
    }));
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
        actionPath: '/interactive-learning/resources/exact',
      }],
      validationQuestion: {
        itemRefId: 'validation-1',
        questionId: 'question-variant',
        contentHash: HASH_A,
        version: 'validation.v1',
        estimatedMinutes: 2,
        actionPath: '/assessment/adaptive-practice',
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

  it('creates an idempotent fresh result only after an owned initial result has reference drifted', async () => {
    const { db, mocks } = createDb();
    const staleTask = {
      version: 'remediation-task-snapshot.v1',
      goal: 'Governed goal',
      estimatedMinutes: 5,
      sourceQuestionId: 'question-original',
      knowledgeNodeId: 'node-1',
      misconceptionTag: 'misconception-1',
      resources: [{
        id: 'exact', title: 'Resource exact', version: 'resource.v0', estimatedMinutes: 3,
        actionPath: '/interactive-learning/resources/exact',
      }],
      validationQuestion: {
        itemRefId: 'validation-1', questionId: 'question-variant', contentHash: HASH_A,
        version: 'validation.v1', estimatedMinutes: 2, actionPath: '/assessment/items/validation-1',
      },
    };
    const stale = persisted({
      wrongAnswerAttributionId: 'attribution-1',
      orchestratorVersion: 'remediation-orchestrator.v1',
      userId: 'learner-1', status: 'AVAILABLE', taskSnapshot: staleTask,
    });
    let refreshed: ReturnType<typeof persisted> | null = null;
    mocks.remediationOrchestrationResult.findFirst.mockImplementation(async (input: any) => (
      input.where.orchestratorVersion === 'remediation-orchestrator.v1' ? stale : refreshed
    ));
    mocks.remediationOrchestrationResult.upsert.mockImplementation(async (input: any) => {
      refreshed = persisted(input.create, 'fresh-result');
      return refreshed;
    });

    const first = await refreshRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
      refreshKey: 'refresh-1',
    });
    const retry = await refreshRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
      refreshKey: 'refresh-1',
    });

    expect(first).toMatchObject({ id: 'fresh-result', status: 'AVAILABLE' });
    expect(retry).toMatchObject({ id: 'fresh-result', status: 'AVAILABLE' });
    expect(mocks.remediationOrchestrationResult.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.remediationOrchestrationResult.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        wrongAnswerAttributionId_orchestratorVersion: {
          wrongAnswerAttributionId: 'attribution-1',
          orchestratorVersion: 'remediation-orchestrator.v1:refresh:refresh-1',
        },
      },
    }));
  });

  it('discovers a production catalog item without remediationValidation metadata', async () => {
    const { db, mocks, validations } = createDb();
    validations[0] = validation({
      contentHash: 'b'.repeat(64),
      catalogContentHash: HASH_A,
      omitRemediationValidation: true,
    });

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });
    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        estimatedMinutes: 5,
        validationQuestion: {
          contentHash: 'b'.repeat(64),
          estimatedMinutes: 2,
          actionPath: '/assessment/adaptive-practice',
        },
      },
    });
    expect(mocks.adaptiveAssessmentItemRef.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        metadata: {
          path: ['adaptiveAssessmentItemRef', 'semanticRefs', 'graphNodeIds'],
          array_contains: ['node-1'],
        },
      }),
    }));
  });

  it('uses a reviewed remediation item on the attributed node as transfer validation', async () => {
    const { db, validations } = createDb();
    validations[0] = validation({
      misconceptionTags: ['transfer-misconception'],
      omitRemediationValidation: true,
    });

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        validationQuestion: {
          itemRefId: 'validation-1',
          questionId: 'question-variant',
        },
      },
    });
  });

  it('resolves a canonical KAQ graph node without requiring a legacy KnowledgeNode row', async () => {
    const canonicalNodeId = 'qual:autocontrol:safety-responsibility';
    const { db, mocks, resources, validations } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue({
      id: 'attribution-1',
      userId: 'learner-1',
      questionId: 'question-original',
      state: 'ATTRIBUTED',
      knowledgeNodeIds: [canonicalNodeId],
      misconceptionTags: ['misconception-1'],
    });
    mocks.knowledgeNode.findFirst.mockResolvedValue(null);
    resources[0] = resource({
      id: 'safety-review',
      minutes: 3,
      knowledgeNodeIds: ['legacy-safety-node'],
      prerequisiteKnowledgeNodeIds: [canonicalNodeId],
    });
    validations[0] = validation({ knowledgeNodeId: canonicalNodeId });

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        goal: '巩固“安全责任意识”的关键概念',
      },
    });
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
    expect(Object.keys(result ?? {}).sort()).toEqual([
      'createdAt',
      'id',
      'manualPracticePath',
      'orchestratorVersion',
      'status',
      'unavailableReason',
    ]);
    expect(mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create).toEqual(expect.objectContaining({
      status: 'UNAVAILABLE',
      unavailableReason: 'ATTRIBUTION_UNCERTAIN',
      manualPracticePath: '/assessment/adaptive-practice',
    }));
    expect(mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create).not.toHaveProperty('taskSnapshot');
  });

  it('normalizes persisted retired manual practice paths to the live practice route', async () => {
    const { db, mocks } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue({
      id: 'attribution-1',
      userId: 'learner-1',
      questionId: 'question-original',
      state: 'UNCERTAIN',
      knowledgeNodeIds: ['node-1'],
      misconceptionTags: ['misconception-1'],
    });
    await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = await mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    row.manualPracticePath = '/student/practice';
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(row);

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: row.id,
    });

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      manualPracticePath: '/assessment/adaptive-practice',
    });
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

  it.each([
    ['path-ineligible', { pathEligible: false }],
    ['broken-target', { brokenTarget: true }],
    ['private', { learnerVisible: false }],
    ['missing-evidence', { evidenceComplete: false }],
  ] as const)('fails closed for a %s ResourceNode authority result', async (_label, overrides) => {
    const { db, mocks } = createDb();
    mocks.teachingResource.findMany.mockResolvedValue([resource({
      id: 'blocked',
      minutes: 3,
      ...overrides,
    })]);

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'RESOURCE_UNAVAILABLE' });
  });

  it.each([
    ['generated-provisional', { reviewState: 'generated-provisional' }],
    ['imported-unreviewed', { reviewState: 'imported-unreviewed' }],
    ['deprecated', { reviewState: 'deprecated' }],
    ['stale-review', { reviewSourceHash: 'stale-review-hash' }],
    ['wrong-stage', { stage: 'checkpoint' as const }],
  ] as const)('fails closed for a %s validation catalog snapshot', async (_label, overrides) => {
    const { db, mocks } = createDb();
    mocks.adaptiveAssessmentItemRef.findMany.mockResolvedValue([validation(overrides)]);

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      unavailableReason: 'VALIDATION_QUESTION_UNAVAILABLE',
    });
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

  it('fails closed when current catalog authority is revoked after orchestration', async () => {
    const { db, mocks } = createDb();
    await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = await mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(row);
    currentCatalogSnapshots.delete('question-variant');

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: 'result-1',
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' });
  });
});

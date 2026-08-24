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
import { listMicroTutoringGovernedResources } from '../micro-tutoring-resource-registry';
import { listMicroTutoringGovernedValidationItems } from '../micro-tutoring-validation-registry';

const HASH_A = 'a'.repeat(64);
const GOVERNED_VALIDATION_SOURCE_ID = 'control-correction-practice-01';
const GOVERNED_VALIDATION_HASH = '6365aadd64489eb9f4cdb7f37f2fada5f630ab508cd57eb59f40def07cb43297';
const GOVERNED_VALIDATION_REVISION = 'sha256:782b2f2e6af619c5cfbc92048647e942b81a12a481bc2c8562ea45b2c890202b';
const currentCatalogSnapshots = new Map<string, AdaptiveAssessmentCatalogSnapshot>();

vi.mock('@/features/adaptive-assessment/adaptive-assessment-catalog-selector', () => ({
  findAdaptiveAssessmentCatalogSnapshot: vi.fn((questionId: string) =>
    currentCatalogSnapshots.get(questionId) ?? null),
}));

const GOVERNED_NODE = 'kn:autocontrol:controller-correction';
const GOVERNED_TAG = 'misconception:control-correction:confuses-overshoot-with-steady-error';
const GOVERNED_RESOURCE_ID = 'lesson15-series-precheck';

function resource(input: {
  id: string;
  minutes: number;
  misconceptionTags?: string[];
  knowledgeNodeIds?: string[];
  prerequisiteKnowledgeNodeIds?: string[];
  registryId?: string | null;
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
    registryId: input.registryId === undefined ? null : input.registryId,
    content: input.brokenTarget ? null : `Resource content ${input.id}`,
    category: null,
    teacherOnly: input.teacherOnly ?? false,
    knowledgeNodes: (input.knowledgeNodeIds ?? [GOVERNED_NODE]).map((id) => ({
      id,
      name: `Knowledge ${id}`,
      resources: [],
      tags: [],
    })),
    config: {
      remediation: {
        misconceptionTags: input.misconceptionTags ?? [GOVERNED_TAG],
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
  stage?: 'remediation' | 'checkpoint' | 'low-stakes-practice';
  reviewSourceHash?: string;
  omitRemediationValidation?: boolean;
}) {
  const id = input.id ?? 'validation-1';
  const questionId = input.questionId ?? GOVERNED_VALIDATION_SOURCE_ID;
  const contentHash = input.contentHash ?? GOVERNED_VALIDATION_HASH;
  const catalogContentHash = input.catalogContentHash ?? GOVERNED_VALIDATION_HASH;
  const stage = input.stage ?? 'remediation';
  const knowledgeNodeId = input.knowledgeNodeId ?? GOVERNED_NODE;
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
    misconceptionRefs: input.misconceptionTags ?? [GOVERNED_TAG],
    remediationRefs: [`teaching-resource:${GOVERNED_RESOURCE_ID}`],
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
      misconceptionTags: input.misconceptionTags ?? [GOVERNED_TAG],
      remediationResourceNodeIds: [`teaching-resource:${GOVERNED_RESOURCE_ID}`],
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
        misconceptionTags: input.misconceptionTags ?? [GOVERNED_TAG],
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
  const resources = [resource({ id: GOVERNED_RESOURCE_ID, minutes: 3 })];
  const validations = [validation({})];
  const db = {
    wrongAnswerAttribution: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'attribution-1',
        userId: 'learner-1',
        questionId: 'question-original',
        itemContentHash: HASH_A,
        state: 'ATTRIBUTED',
        knowledgeNodeIds: [GOVERNED_NODE],
        misconceptionTags: [GOVERNED_TAG],
      }),
    },
    knowledgeNode: {
      findFirst: vi.fn().mockResolvedValue({ id: GOVERNED_NODE, name: 'Controller correction', isActive: true }),
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
        prerequisiteKnowledgeNodeIds: [GOVERNED_NODE],
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
        resources: [{ id: GOVERNED_RESOURCE_ID }],
        validationQuestion: {
          itemRefId: 'validation-1',
          questionId: GOVERNED_VALIDATION_SOURCE_ID,
          contentHash: GOVERNED_VALIDATION_HASH,
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
      knowledgeNodeId: GOVERNED_NODE,
      misconceptionTag: GOVERNED_TAG,
    }));
    expect(create.taskSnapshot.resources.map((item: any) => item.id)).toEqual([GOVERNED_RESOURCE_ID]);
    expect(create.taskSnapshot.resources[0]).toEqual(expect.objectContaining({
      actionId: `micro-tutoring-action:${GOVERNED_RESOURCE_ID}`,
      actionVersion: 'micro-tutoring-learning-action.v1',
      registryId: GOVERNED_RESOURCE_ID,
      resourceRevision: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    }));
    expect(create.taskSnapshot.validationQuestion.itemRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('correctAnswer');
    expect(JSON.stringify(result)).not.toContain('explanation');
    expect(JSON.stringify(result)).not.toContain('options');
    expect(JSON.stringify(result)).not.toContain('independenceRationale');
    expect(JSON.stringify(result)).not.toContain('purposeRationale');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_CORRECT_ANSWER');
  });

  it('excludes the source practice item when selecting a frozen validation question', async () => {
    const { db, mocks, validations } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue({
      id: 'attribution-1',
      userId: 'learner-1',
      questionId: GOVERNED_VALIDATION_SOURCE_ID,
      itemContentHash: GOVERNED_VALIDATION_HASH,
      state: 'ATTRIBUTED',
      knowledgeNodeIds: [GOVERNED_NODE],
      misconceptionTags: [GOVERNED_TAG],
    });
    validations.push(validation({
      id: 'validation-2',
      questionId: 'control-correction-practice-02',
      contentHash: 'f184c9a8250cb7cb067558c66d55e3bbba0843f93bd9f4b1c58c8b09d8edccf7',
      catalogContentHash: 'f184c9a8250cb7cb067558c66d55e3bbba0843f93bd9f4b1c58c8b09d8edccf7',
    }));

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        validationQuestion: {
          itemRefId: 'validation-2',
          questionId: 'control-correction-practice-02',
        },
      },
    });
  });

  it('binds action identity when TeachingResource id is a cuid and registryId matches the projection', async () => {
    const { db, mocks, resources } = createDb();
    resources[0] = resource({
      id: 'cuid_teaching_resource_1',
      registryId: GOVERNED_RESOURCE_ID,
      minutes: 3,
    });

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({ status: 'AVAILABLE' });
    expect(mocks.remediationOrchestrationResult.upsert.mock.calls[0][0].create.taskSnapshot.resources[0]).toEqual(
      expect.objectContaining({
        id: 'cuid_teaching_resource_1',
        registryId: GOVERNED_RESOURCE_ID,
        actionId: `micro-tutoring-action:${GOVERNED_RESOURCE_ID}`,
        actionVersion: 'micro-tutoring-learning-action.v1',
      }),
    );
  });

  it('returns an existing immutable result without a second write', async () => {
    const { db, mocks } = createDb();
    const taskSnapshot = {
      version: 'remediation-task-snapshot.v1',
      goal: 'Governed goal',
      estimatedMinutes: 5,
      sourceQuestionId: 'question-original',
      knowledgeNodeId: GOVERNED_NODE,
      misconceptionTag: GOVERNED_TAG,
      resources: [{
        id: GOVERNED_RESOURCE_ID,
        title: `Resource ${GOVERNED_RESOURCE_ID}`,
        version: 'resource.v1',
        estimatedMinutes: 3,
        actionPath: `/interactive-learning/resources/${GOVERNED_RESOURCE_ID}`,
        registryId: GOVERNED_RESOURCE_ID,
        actionId: `micro-tutoring-action:${GOVERNED_RESOURCE_ID}`,
        actionVersion: 'micro-tutoring-learning-action.v1',
        resourceRevision: listMicroTutoringGovernedResources({
          knowledgeNodeId: GOVERNED_NODE,
          misconceptionTag: GOVERNED_TAG,
        })[0]?.version,
      }],
      validationQuestion: {
        itemRefId: 'validation-1',
        questionId: GOVERNED_VALIDATION_SOURCE_ID,
        contentHash: GOVERNED_VALIDATION_HASH,
        version: 'validation.v1',
        itemRevision: GOVERNED_VALIDATION_REVISION,
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
      knowledgeNodeId: GOVERNED_NODE,
      misconceptionTag: GOVERNED_TAG,
      resources: [{
        id: GOVERNED_RESOURCE_ID, title: `Resource ${GOVERNED_RESOURCE_ID}`, version: 'resource.v0', estimatedMinutes: 3,
        actionPath: `/interactive-learning/resources/${GOVERNED_RESOURCE_ID}`,
      }],
      validationQuestion: {
        itemRefId: 'validation-1', questionId: GOVERNED_VALIDATION_SOURCE_ID, contentHash: HASH_A,
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
          questionId: GOVERNED_VALIDATION_SOURCE_ID,
          contentHash: GOVERNED_VALIDATION_HASH,
          estimatedMinutes: 2,
          actionPath: '/assessment/adaptive-practice',
        },
      },
    });
    expect(mocks.adaptiveAssessmentItemRef.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        questionId: {
          in: expect.arrayContaining([GOVERNED_VALIDATION_SOURCE_ID]),
        },
      }),
    }));
  });

  it('uses an independent same-node practice item even when catalog misconception tags differ', async () => {
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
          questionId: GOVERNED_VALIDATION_SOURCE_ID,
        },
      },
    });
  });

  it('resolves a canonical KAQ graph node without requiring a legacy KnowledgeNode row', async () => {
    const { db, mocks } = createDb();
    mocks.knowledgeNode.findFirst.mockResolvedValue(null);

    const result = await orchestrateRemediation({
      db,
      authenticatedUserId: 'learner-1',
      attributionId: 'attribution-1',
    });

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      task: {
        goal: '巩固“控制器与校正”的关键概念',
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
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
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
      manualPracticePath: '/assessment/adaptive-practice?intent=practice',
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
      mocks.teachingResource.findMany.mockResolvedValue([resource({ id: GOVERNED_RESOURCE_ID, minutes: 10 })]);
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
    ['wrong-stage', { stage: 'checkpoint' as const, questionId: 'checkpoint-only-item' }],
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
      id: GOVERNED_RESOURCE_ID,
      minutes: 3,
      learnerVisible: false,
    })]);

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: created!.id,
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'ACCESS_REVOKED' });
    expect(JSON.stringify(result)).not.toContain(`Resource ${GOVERNED_RESOURCE_ID}`);
  });

  it('fails closed when validation access is revoked during retrieval', async () => {
    const { db, mocks, validations } = createDb();
    const created = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(await row);
    validations[0] = validation({ learnerVisible: false });

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: created!.id,
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'ACCESS_REVOKED' });
    expect(JSON.stringify(result)).not.toContain(GOVERNED_VALIDATION_SOURCE_ID);
  });

  it('keeps a legacy snapshot available when itemRevision is absent', async () => {
    const { db, mocks } = createDb();
    const taskSnapshot = {
      version: 'remediation-task-snapshot.v1',
      goal: 'Governed goal',
      estimatedMinutes: 5,
      sourceQuestionId: 'question-original',
      knowledgeNodeId: GOVERNED_NODE,
      misconceptionTag: GOVERNED_TAG,
      resources: [{
        id: GOVERNED_RESOURCE_ID,
        title: `Resource ${GOVERNED_RESOURCE_ID}`,
        version: 'resource.v1',
        estimatedMinutes: 3,
        actionPath: `/interactive-learning/resources/${GOVERNED_RESOURCE_ID}`,
        registryId: GOVERNED_RESOURCE_ID,
        actionId: `micro-tutoring-action:${GOVERNED_RESOURCE_ID}`,
        actionVersion: 'micro-tutoring-learning-action.v1',
        resourceRevision: listMicroTutoringGovernedResources({
          knowledgeNodeId: GOVERNED_NODE,
          misconceptionTag: GOVERNED_TAG,
        })[0]?.version,
      }],
      validationQuestion: {
        itemRefId: 'validation-1',
        questionId: GOVERNED_VALIDATION_SOURCE_ID,
        contentHash: GOVERNED_VALIDATION_HASH,
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

  it('fails closed when the validation registry revision drifts', async () => {
    const { db, mocks } = createDb();
    const created = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });
    const row = await mocks.remediationOrchestrationResult.upsert.mock.results[0].value;
    row.taskSnapshot = {
      ...row.taskSnapshot,
      validationQuestion: {
        ...row.taskSnapshot.validationQuestion,
        itemRevision: `sha256:${'0'.repeat(64)}`,
      },
    };
    mocks.remediationOrchestrationResult.findFirst.mockResolvedValue(row);

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: created!.id,
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' });
  });

  it('fails closed when the source item content hash is missing', async () => {
    const { db, mocks } = createDb();
    mocks.wrongAnswerAttribution.findFirst.mockResolvedValue({
      id: 'attribution-1',
      userId: 'learner-1',
      questionId: 'question-original',
      state: 'ATTRIBUTED',
      knowledgeNodeIds: [GOVERNED_NODE],
      misconceptionTags: [GOVERNED_TAG],
    });

    const result = await orchestrateRemediation({ db, authenticatedUserId: 'learner-1', attributionId: 'attribution-1' });

    expect(result).toMatchObject({
      status: 'UNAVAILABLE',
      unavailableReason: 'VALIDATION_QUESTION_UNAVAILABLE',
    });
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
    currentCatalogSnapshots.delete(GOVERNED_VALIDATION_SOURCE_ID);

    const result = await readRemediationOrchestration({
      db,
      authenticatedUserId: 'learner-1',
      resultId: 'result-1',
    });

    expect(result).toMatchObject({ status: 'UNAVAILABLE', unavailableReason: 'REFERENCE_DRIFT' });
  });
});

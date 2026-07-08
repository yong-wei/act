import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAdaptiveLearnerState: vi.fn(),
  getLearningGoalAssessmentCoverageForPlanner: vi.fn(),
  getLearningGoalResourceBaselineForPlanner: vi.fn(),
  loadAllTextbookRuntimeResourceCatalogEntries: vi.fn(),
  loadAllTextbookRuntimeSearchDocuments: vi.fn(),
}));

vi.mock('@/lib/data-governance/adaptive-learner-state-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data-governance/adaptive-learner-state-service')>(
    '@/lib/data-governance/adaptive-learner-state-service',
  );
  return {
    ...actual,
    readAdaptiveLearnerState: mocks.readAdaptiveLearnerState,
  };
});

vi.mock('@/lib/learning-goal-assessment-coverage-runtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/learning-goal-assessment-coverage-runtime')>(
    '@/lib/learning-goal-assessment-coverage-runtime',
  );
  mocks.getLearningGoalAssessmentCoverageForPlanner
    .mockImplementation(actual.getLearningGoalAssessmentCoverageForPlanner);
  return {
    ...actual,
    getLearningGoalAssessmentCoverageForPlanner: mocks.getLearningGoalAssessmentCoverageForPlanner,
  };
});

vi.mock('@/lib/learning-goal-resource-baseline-runtime', async () => {
  const actual = await vi.importActual<typeof import('@/lib/learning-goal-resource-baseline-runtime')>(
    '@/lib/learning-goal-resource-baseline-runtime',
  );
  mocks.getLearningGoalResourceBaselineForPlanner
    .mockImplementation(actual.getLearningGoalResourceBaselineForPlanner);
  return {
    ...actual,
    getLearningGoalResourceBaselineForPlanner: mocks.getLearningGoalResourceBaselineForPlanner,
  };
});

vi.mock('@/lib/textbook-runtime-resources', () => ({
  loadAllTextbookRuntimeResourceCatalogEntries: mocks.loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments: mocks.loadAllTextbookRuntimeSearchDocuments,
}));

import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
} from '@/lib/data-governance/adaptive-learner-state-service';
import { buildKonlingKaqGraphContext } from '@/lib/konling-kaq-graph-context';
import { getRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';
import {
  applyKonlingCitationFallback,
  buildKonlingCitationGuard,
  buildResourceNodeSourcePackCandidate,
  buildKonlingSarAssociatedGroundingMetadataPayload,
  buildKonlingStreamingCitationGuard,
  buildScopedKonlingAiTools,
  buildStudentSafePathOptions,
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  createKonlingAgentSession,
  createGovernedKonlingIntervention,
  createScopedKonlingMemory,
  completeKonlingToolRun,
  failKonlingToolRun,
  getOrCreateKonlingAgentSession,
  buildKonlingTeachingAssistantRuntimeContract,
  getKonlingTeachingAssistantMountContracts,
  KONLING_TOOL_REGISTRY,
  KONLING_TEACHING_ASSISTANT_MODE_REGISTRY,
  persistKonlingSessionMemories,
  recordKonlingInterventionFeedback,
  resolveKonlingTeachingAssistantMode,
  resumeKonlingAgentSession,
  startKonlingToolRun,
  verifyKonlingRuntimeScope,
  type KonlingCitationContext,
  type KonlingRuntimeScope,
  type KonlingRuntimeContext,
} from '@/lib/konling-agent-runtime';
import { clearPendingChanges, getPendingChanges, updateSimulationState } from '@/lib/ai-tools';
import { buildResourceNodeRegistry } from '@/lib/resource-node-registry';

function expectRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  expect(typeof value, `${label} should be an object`).toBe('object');
  expect(value, `${label} should not be null`).not.toBeNull();
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
}

function expectStringArray(value: unknown, label: string): asserts value is string[] {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  if (Array.isArray(value)) {
    expect(value.every((item) => typeof item === 'string'), `${label} should contain only strings`).toBe(true);
  }
}

function createScope(overrides: Partial<KonlingRuntimeScope> = {}): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'student-1',
    targetUserId: 'student-1',
    role: 'student',
    classId: 'class-1',
    courseId: 'unit-4-5',
    pageId: 'step-03',
    resourceId: 'resource-1',
    pathNodeId: 'node-1',
    privacyScopes: ['student-visible'],
    ...overrides,
  };
}

function createStudentState() {
  return {
    currentTask: 'PID 参数调整',
    currentAttempt: 3,
    attemptHistory: [
      {
        attemptNumber: 1,
        params: { kp: 1 },
        result: { overshoot: 42, settlingTime: 80 },
        isSuccessful: false,
      },
      {
        attemptNumber: 2,
        params: { kp: 1.2 },
        result: { overshoot: 44, settlingTime: 78 },
        isSuccessful: false,
      },
    ],
  };
}

function createRuntimeContext(overrides: Partial<KonlingRuntimeContext> = {}): KonlingRuntimeContext {
  return {
    pageContext: {
      courseId: 'simulation',
      courseTitle: '仿真',
      pageType: 'practice',
      stepId: 'pid-default',
      topic: 'PID 参数整定',
      learningObjectives: [],
      knowledgeType: 'X',
    },
    userProfile: {
      id: 'student-1',
      name: '张三',
      learningStyle: 'INTERACTIVE',
      cognitiveLevel: 3,
      abilityVector: {
        computational: 0.5,
        crossDomain: 0.5,
        design: 0.5,
        analysis: 0.5,
        evaluation: 0.5,
      },
    },
    learnerState: null,
    planContext: {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    },
    memory: [],
    citationContext: {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      missingCitationClasses: ['content', 'evidence'],
      lowConfidenceReasons: ['missing-content', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
        minimum: {
          content: 1,
          evidenceWhenAvailable: 1,
        },
        fallbackWhenMissing: 'low-confidence',
      },
    },
    permittedTools: [
      'get_simulation_context',
      'run_virtual_simulation',
      'analyze_simulation_trace',
      'compare_simulation_runs',
      'propose_controller_patch',
      'apply_controller_patch',
    ],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
    },
    ...overrides,
  };
}

function createCompleteGraphContext(
  overrides: Partial<NonNullable<KonlingRuntimeContext['graphContext']>> = {},
): NonNullable<KonlingRuntimeContext['graphContext']> {
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal('control-correction');
  if (!registeredGoal?.learningGoal) {
    throw new Error('control-correction learning goal fixture is not registered');
  }
  const { learningGoal } = registeredGoal;
  return {
    source: 'server-owned',
    status: 'complete',
    advisoryOnly: true,
    learningGoal: {
      id: learningGoal.id,
      title: learningGoal.title,
      version: learningGoal.version,
      objectiveBoundary: {
        knowledgeObjectiveIds: learningGoal.knowledgeObjectiveIds,
        capabilityObjectiveIds: learningGoal.capabilityObjectiveIds,
        qualityObjectiveIds: learningGoal.qualityObjectiveIds,
      },
      pathPolicyFamily: learningGoal.pathPolicyFamily,
      terminalValidationPolicy: learningGoal.terminalValidationPolicy,
    },
    selectedGraphNodeIds: ['cap:autocontrol:synthesize-controller-correction'],
    expandedSubgraph: null,
    learnerOverlay: null,
    classOverlay: null,
    resourceCoverage: {},
    pathArtifact: null,
    citationRefs: ['content:1'],
    evidenceRefs: [],
    versionRefs: null,
    confidence: 'high',
    missingGrounding: [],
    clientHintsAccepted: [],
    clientHintsRejected: [],
    ...overrides,
  };
}

function createGraphLearnerState(
  userId: string,
  score = 0.72,
): NonNullable<KonlingRuntimeContext['learnerState']> {
  const evidenceRef = {
    sourceType: 'StudentEvidenceFeatureCache' as const,
    sourceId: `exec-${userId}`,
    evidenceAt: '2026-06-21T00:00:00.000Z',
    confidence: 'medium' as const,
    privacyLevel: 'student-visible' as const,
  };
  const competencyScore = {
    score: Math.round(score * 100),
    trend: 'stable' as const,
    confidence: 0.8,
    evidenceCount: 1,
    lastUpdated: '2026-06-21T00:00:00.000Z',
  };
  const secondaryDimension = {
    value: Math.round(score * 100),
    confidence: 0.8,
    evidenceCount: 1,
    source: 'primary-competency-derived',
  };

  return {
    userId,
    payloadVersion: ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
    authority: 'server-owned',
    generatedAt: '2026-06-21T00:00:00.000Z',
    roleScope: {
      role: 'student',
      classId: 'class-1',
      privacyScopes: ['student-visible'],
    },
    featureFlag: {
      name: ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
      enabled: true,
      fallback: 'test-fixture',
    },
    clientHints: {
      received: false,
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryCompetencies: {
      source: 'feature-cache',
      vector: {
        controlModeling: competencyScore,
        parameterDesign: competencyScore,
        crossDomainTransfer: competencyScore,
        engineeringDecision: competencyScore,
        inquiryReflection: competencyScore,
        selfDirectedLearning: competencyScore,
      },
    },
    secondaryDimensions: {
      conceptMastery: { ...secondaryDimension, primaryDimension: 'controlModeling' },
      timeFrequencyTransfer: { ...secondaryDimension, primaryDimension: 'crossDomainTransfer' },
      modelingReliability: { ...secondaryDimension, primaryDimension: 'controlModeling' },
      tuningEfficiency: { ...secondaryDimension, primaryDimension: 'parameterDesign' },
      constrainedOptimization: { ...secondaryDimension, primaryDimension: 'parameterDesign' },
      solutionStability: { ...secondaryDimension, primaryDimension: 'engineeringDecision' },
      crossModalTransfer: { ...secondaryDimension, primaryDimension: 'crossDomainTransfer' },
      scenarioGeneralization: { ...secondaryDimension, primaryDimension: 'crossDomainTransfer' },
      riskRecognition: { ...secondaryDimension, primaryDimension: 'engineeringDecision' },
      constraintCompliance: { ...secondaryDimension, primaryDimension: 'engineeringDecision' },
      explanationQuality: { ...secondaryDimension, primaryDimension: 'inquiryReflection' },
      aiUseStrategy: { ...secondaryDimension, primaryDimension: 'inquiryReflection' },
      reflectionDepth: { ...secondaryDimension, primaryDimension: 'inquiryReflection' },
      pathExecution: { ...secondaryDimension, primaryDimension: 'selfDirectedLearning' },
      persistence: { ...secondaryDimension, primaryDimension: 'selfDirectedLearning' },
      remedialInitiative: { ...secondaryDimension, primaryDimension: 'selfDirectedLearning' },
    },
    risks: {
      riskLevel: 'low',
      activeFlags: [],
    },
    knowledgeMastery: {
      coverage: 'available',
      tags: {
        'kn:autocontrol:controller-correction': {
          posteriorMastery: score,
          confidence: 0.8,
          evidenceCount: 1,
          source: 'adaptive-assessment',
          algorithmVersion: 'test-fixture',
          lastUpdatedAt: '2026-06-21T00:00:00.000Z',
          supportingEvidenceRefs: [evidenceRef],
          sourceCoverage: {
            AdaptiveMasteryUpdate: 'missing',
            LearningFact: 'missing',
            ArenaSubmission: 'missing',
            AgentToolRun: 'missing',
            StudentEvidenceFeatureCache: 'available',
          },
          limitations: [],
        },
      },
    },
    masteryTraceability: {
      capabilityTargets: {
        'cap:autocontrol:synthesize-controller-correction': {
          targetId: 'cap:autocontrol:synthesize-controller-correction',
          targetKind: 'capability',
          masteryLevel: score,
          confidence: 0.84,
          supportingEvidenceRefs: [evidenceRef],
          freshness: 'current',
          sourceCoverage: {
            AdaptiveMasteryUpdate: 'missing',
            LearningFact: 'missing',
            ArenaSubmission: 'missing',
            AgentToolRun: 'missing',
            StudentEvidenceFeatureCache: 'available',
          },
          limitations: [],
        },
      },
      knowledgeTargets: {},
    },
    resourcePreference: {
      preferredModalities: [],
      sourceCounts: {},
      confidence: 'none',
    },
    mediaAbsorption: {
      mediaFactCount: 0,
      averageCompletion: null,
      confidence: 'none',
    },
    pathContext: {
      activePathCount: 0,
      bookmarkedPathCount: 0,
      recentPathIds: [],
      activeControlCorrectionPath: {
        state: 'none',
        pathId: null,
        status: null,
        currentNodeId: null,
        terminalValidationState: null,
        lowConfidenceMarkers: [],
      },
      statusMarkers: ['available'],
    },
    assessmentState: {
      latestAbilityEstimate: null,
    },
    evidence: {
      readState: 'ready',
      evidenceWindow: {
        firstStartedAt: '2026-06-21T00:00:00.000Z',
        lastStartedAt: '2026-06-21T00:00:00.000Z',
        daysCovered: 1,
      },
      sourceCounts: {},
      sourceCoverage: {},
      confidence: {
        level: 'medium',
        score,
        evidenceCount: 1,
        sourceCompleteness: 1,
      },
      statusMarkers: [],
    },
    prerequisiteFeatureGroups: {
      simulationArena: null,
      pathExecution: null,
    },
    fieldContracts: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
    missingEvidence: [],
  };
}

function textbookRuntimeCatalogFixture() {
  return [{
    textbook: {
      bookId: 'dorf-modern-control-systems',
      title: 'Modern Control Systems',
    },
    sections: [
      {
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch08-example-0801',
        title: 'Bode 图频域响应示例',
        citationHref: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md',
        knowledgeNodeIds: ['Bode图_1_1', '频域响应_1_1', '正弦稳态响应_5_b6dc1100'],
        capabilityTargetIds: ['controlModeling', 'parameterDesign'],
        estimatedTimeMinutes: 8,
        planningOverride: {
          readiness: {
            minimumCompetency: { controlModeling: 0.1, parameterDesign: 0.1 },
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: 'Reviewed textbook section fixture is ready for path planning.',
            fallbackNodeIds: [],
          },
          pathDisposition: {
            kind: 'path-plannable',
            reviewStatus: 'human-confirmed',
            rationale: 'Reviewed textbook section fixture for Konling path generation tests.',
            sourceFamily: 'textbook_section',
            stableSourceRef: 'dorf-modern-control-systems:ch08-example-0801',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'konling-runtime-test-review',
          },
        },
      },
    ],
  }];
}

function textbookRuntimeSearchDocumentFixture() {
  return [
    {
      id: 'ch08-example-0801__chunk-001',
      kind: 'chunk',
      title: 'Bode 图频域响应示例',
      href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md#chunk-001',
      text: 'Bode 图用于观察频域响应。',
      contentHash: 'sha-textbook-chunk',
      resourceProjection: {
        resourceId: 'textbook-section:dorf-modern-control-systems:ch08-example-0801',
        segmentRef: 'ch08-example-0801',
        citationTargetRef: 'ch08-example-0801',
        knowledgeNodeRefs: ['Bode图_1_1', '频域响应_1_1'],
        capabilityTargetRefs: ['controlModeling'],
      },
      citationAddress: {
        kind: 'text',
        sourceRefId: 'ch08-example-0801__chunk-001',
        href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md#chunk-001',
        locator: 'chunk-001',
        contentHash: 'sha-textbook-chunk',
      },
      metadata: {
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch08-example-0801',
        chapterId: 'ch08',
        chapterNumber: 8,
      },
    },
    {
      id: 'fig-08-01__figure',
      kind: 'figure',
      title: 'Bode 图示意图',
      href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md#fig-08-01',
      text: '图像描述：幅频与相频曲线。',
      contentHash: 'sha-textbook-figure',
      resourceProjection: {
        resourceId: 'textbook-section:dorf-modern-control-systems:ch08-example-0801',
        segmentRef: 'ch08-example-0801',
        citationTargetRef: 'fig-08-01',
        knowledgeNodeRefs: ['Bode图_1_1'],
        capabilityTargetRefs: ['controlModeling'],
      },
      citationAddress: {
        kind: 'image',
        sourceRefId: 'fig-08-01',
        href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch08-example-0801.md#fig-08-01',
        locator: 'fig-08-01',
        contentHash: 'sha-textbook-figure',
      },
      metadata: {
        bookId: 'dorf-modern-control-systems',
        sectionId: 'ch08-example-0801',
        chapterId: 'ch08',
        chapterNumber: 8,
      },
    },
  ];
}

describe('konling agent runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAllTextbookRuntimeResourceCatalogEntries.mockResolvedValue(textbookRuntimeCatalogFixture());
    mocks.loadAllTextbookRuntimeSearchDocuments.mockResolvedValue(textbookRuntimeSearchDocumentFixture());
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    delete process.env.KONLING_SEMANTIC_MEMORY_ENABLED;
    delete process.env.KONLING_STRATEGY_MEMORY_ENABLED;
    clearPendingChanges();
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
      primaryCompetencies: {
        vector: {
          controlModeling: { score: 88 },
          parameterDesign: { score: 72 },
          crossDomainTransfer: { score: 64 },
          engineeringDecision: { score: 50 },
          inquiryReflection: { score: 40 },
          selfDirectedLearning: { score: 66 },
        },
      },
      risks: {
        activeFlags: [],
      },
    });
  });

  it('enforces student and teacher runtime scope before tools can run', async () => {
    await expect(verifyKonlingRuntimeScope({}, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      targetUserId: 'student-2',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 403,
    });

    const db = {
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' }),
      },
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(verifyKonlingRuntimeScope(db, {
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 404,
    });

    const foreignClassDb = {
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-2', teacherId: 'teacher-2' }),
      },
      studentProfile: {
        findFirst: vi.fn(),
      },
    };
    await expect(verifyKonlingRuntimeScope(foreignClassDb, {
      authenticatedUserId: 'teacher-1',
      role: 'TEACHER',
      targetUserId: 'teacher-1',
      classId: 'class-2',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    })).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    expect(foreignClassDb.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it('registers teaching-assistant modes with scoped tools, citations, privacy, and mounts', () => {
    expect(Object.keys(KONLING_TEACHING_ASSISTANT_MODE_REGISTRY)).toEqual([
      'generic-chat',
      'diagnosis-explainer',
      'path-advisor',
      'resource-coach',
      'grading-assistant',
      'feedback-explainer',
      'class-summarizer',
      'prep-coauthor',
    ]);

    const diagnosis = resolveKonlingTeachingAssistantMode('diagnosis-explainer');
    expect(diagnosis).toMatchObject({
      id: 'diagnosis-explainer',
      supportedRoles: ['student', 'teacher'],
      mountingSurfaces: expect.arrayContaining(['student-learning-overview']),
      requiredContext: expect.arrayContaining(['diagnosis-view', 'learner-state-summary', 'evidence-citations']),
      citationClasses: expect.arrayContaining(['learner-state', 'path-execution']),
      privacyPolicy: expect.objectContaining({ payload: 'aggregate-and-redacted-only' }),
    });
    expect(diagnosis.permittedTools).toEqual(expect.arrayContaining(['get_learner_state', 'search_knowledge_graph']));
    expect(diagnosis.permittedTools).not.toContain('apply_controller_patch');

    const grading = resolveKonlingTeachingAssistantMode('grading-assistant');
    expect(grading.permittedTools).not.toContain('record_intervention_result');
    expect(grading.outputContract.forbiddenActions).toEqual(expect.arrayContaining([
      'approve-grading',
      'write-back-profile',
    ]));

    const prepCoauthor = resolveKonlingTeachingAssistantMode('prep-coauthor');
    expect(prepCoauthor.outputContract.status).toBe('draft-only');
    expect(prepCoauthor.outputContract.forbiddenActions).toEqual(expect.arrayContaining([
      'publish-prep-item',
      'insert-lesson-item',
    ]));

    const mounts = getKonlingTeachingAssistantMountContracts();
    expect(mounts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: 'teacher-prep-pack',
        modeId: 'prep-coauthor',
        requiredContext: expect.arrayContaining(['prep-pack']),
      }),
      expect.objectContaining({
        surface: 'resource-node-launch',
        modeId: 'resource-coach',
        requiredContext: expect.arrayContaining(['resource-node', 'path-execution-context']),
      }),
    ]));
  });

  it('builds explicit mode runtime contracts without allowing client hints to expand scope', () => {
    const runtime = createRuntimeContext({
      learnerState: null,
      planContext: {
        currentPathId: null,
        activeNodeId: null,
        nextNodeIds: [],
        recentPathIds: [],
        completedNodeIds: [],
        status: 'missing',
      },
      citationContext: {
        required: true,
        contentCitations: [],
        evidenceCitations: [],
        missingCitationClasses: ['learner-state', 'path-execution'],
        lowConfidenceReasons: ['missing-learner-state', 'missing-path-execution'],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      missingContext: ['learner-state', 'plan-context'],
      permittedTools: ['get_page_context', 'get_learner_state', 'search_knowledge_graph'],
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', targetUserId: 'student-1', authenticatedUserId: 'student-1' }),
      clientContextHints: {
        targetUserId: 'student-2',
        classId: 'class-2',
        resourceId: 'foreign-resource',
        gradingRunId: 'grading-1',
        prepPackId: 'prep-1',
      },
    });

    expect(contract.mode.id).toBe('path-advisor');
    expect(contract.status).toBe('unavailable');
    expect(contract.permittedTools).toEqual([]);
    expect(contract.unavailableReasons).toEqual(expect.arrayContaining([
      'missing-context:learner-state-summary',
      'missing-citation:learner-state',
      'missing-citation:content',
    ]));
    expect(contract.scope).toEqual(expect.objectContaining({
      targetUserId: 'student-1',
      classId: 'class-1',
      resourceId: 'resource-1',
    }));
    expect(contract.clientHintsAccepted).toEqual([]);
    expect(contract.clientHintsRejected).toEqual(expect.arrayContaining([
      'targetUserId',
      'classId',
      'resourceId',
      'gradingRunId',
      'prepPackId',
    ]));
    expect(contract.permittedTools).not.toContain('record_intervention_result');
  });

  it('exposes adaptive path tools in ready path-advisor mode', async () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: [
        'get_page_context',
        'get_learner_state',
        'get_plan_context',
        'search_knowledge_graph',
        'recommend_next_action',
        'generate_learning_path',
        'revise_learning_path_options',
        'select_learning_path',
        'reject_learning_path_option',
        'explain_learning_path_tradeoff',
        'record_path_adjustment_outcome',
      ],
      planContext: {
        currentPathId: 'path-1',
        activeNodeId: 'node-1',
        nextNodeIds: ['node-2'],
        recentPathIds: ['path-1'],
        completedNodeIds: [],
        pathOptions: [{
          styleId: 'recommended',
          policyFamily: 'rules-plus-graph-search',
          label: '推荐路径',
          nodeIds: ['node-1', 'node-2'],
          targetDeficits: ['capability:root-locus-design'],
          evidenceBasis: ['AdaptiveLearnerState'],
          lockedNodeIds: [],
          readinessSummary: [],
          resourceMix: { lesson_step: 1 },
          effort: {
            estimatedMinutes: 45,
            relative: 'medium',
          },
          terminalValidationNodeIds: [],
          limitations: [],
        }],
        status: 'available',
      },
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:path',
          sourceType: 'content',
          displayTitle: '学习路径内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '当前学习路径',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }, {
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }, {
          id: 'intervention:path-1',
          sourceType: 'intervention',
          displayTitle: '路径调整记录',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPathIntervention',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', pageId: 'adaptive-path-center' }),
      serverModeContext: { 'student-path-center': true },
    });

    expect(contract.status).toBe('degraded');
    expect(contract.answerIntent).toBe('path-advice');
    expect(contract.groundingContext.capabilityTargetRefs).toContain('capability:root-locus-design');
    expect(contract.groundingContext.missingContext).not.toContain('capability-target-context-missing');
    expect(contract.permittedTools).toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'explain_learning_path_tradeoff',
      'record_path_adjustment_outcome',
    ]));

    const modeRuntimeContext = {
      ...runtime,
      knowledgeCapabilityContext: contract.groundingContext,
      teachingAssistantMode: contract,
    };
    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: modeRuntimeContext,
    });
    expect(prompt).toContain('回答意图: path-advice');
    expect(prompt).toContain('capability:root-locus-design');
    expect(prompt).toContain('引用锚点: content:1, path-execution:1, learner-state:1, intervention:1');
    expect(prompt).not.toContain('path:path-1');
    expect(prompt).not.toContain('learner:student-1');

    const toolRuntime = buildKonlingToolRuntime({
      db: {},
      scope: createScope({ role: 'student', pageId: 'adaptive-path-center' }),
      context: { ...modeRuntimeContext, permittedTools: contract.permittedTools },
    });
    const pageContextOutput = await toolRuntime.getPageContext();
    expectRecord(pageContextOutput, 'page context output');
    expectRecord(pageContextOutput.knowledgeCapabilityContext, 'knowledge capability context');
    expectRecord(pageContextOutput.knowledgeCapabilityContext.scope, 'knowledge capability scope');
    expectStringArray(pageContextOutput.knowledgeCapabilityContext.citationRefs, 'knowledge capability citations');
    expect(pageContextOutput).toMatchObject({
      knowledgeCapabilityContext: {
        answerIntent: 'path-advice',
        capabilityTargetRefs: ['capability:root-locus-design'],
        citationRefs: ['content:1', 'path-execution:1', 'learner-state:1', 'intervention:1'],
        scope: {
          role: 'student',
          courseId: 'unit-4-5',
          pageId: 'adaptive-path-center',
          resourceId: 'resource-1',
          pathNodeId: 'node-1',
          classScoped: true,
          privacyLabel: 'student-visible',
        },
      },
    });
    expect(pageContextOutput.knowledgeCapabilityContext.scope).not.toHaveProperty('targetUserId');
    expect(pageContextOutput.knowledgeCapabilityContext.scope).not.toHaveProperty('authenticatedUserId');
    expect(pageContextOutput.knowledgeCapabilityContext.scope).not.toHaveProperty('classId');
    expect(pageContextOutput.knowledgeCapabilityContext.scope).not.toHaveProperty('privacyScopes');
    expect(pageContextOutput.knowledgeCapabilityContext.citationRefs).not.toContain('path:path-1');
    expect(pageContextOutput.knowledgeCapabilityContext.citationRefs).not.toContain('learner:student-1');
  });

  it('exposes Konling graph context to contracts, prompts, and page-context tools', async () => {
    const scope = createScope({
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
      classId: null,
    });
    const planContext: KonlingRuntimeContext['planContext'] = {
      currentPathId: 'path-1',
      activeNodeId: 'node-1',
      nextNodeIds: ['node-2'],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'available',
    };
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:control-correction',
        sourceType: 'content',
        displayTitle: '校正设计说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }],
      evidenceCitations: [{
        id: 'learner:student-1',
        sourceType: 'learner-state',
        displayTitle: '学习者状态',
        href: null,
        confidence: 'medium',
        evidenceBasis: 'AdaptiveLearnerState',
        owner: 'recommendation',
      }],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const graphContext = buildKonlingKaqGraphContext({
      scope,
      selectedGraphNodeIds: ['cap:autocontrol:synthesize-controller-correction'],
      planContext,
      citationContext,
    });
    const runtime = createRuntimeContext({
      pageContext: {
        ...createRuntimeContext().pageContext,
        courseId: 'control-correction',
        stepId: 'adaptive-path-center',
      },
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      planContext,
      citationContext,
      graphContext,
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope,
      serverModeContext: { 'student-path-center': true },
      clientContextHints: { selectedGraphNodeIds: ['kn:autocontrol:forged-node'] },
    });

    expect(contract.status).toBe('degraded');
    expect(contract.graphContext?.learningGoal?.id).toBe('control-correction');
    expect(contract.graphContext?.selectedGraphNodeIds).toEqual(['cap:autocontrol:synthesize-controller-correction']);
    expect(contract.graphContext?.clientHintsAccepted).toEqual([]);
    expect(contract.degradedReasons).toContain('missing-graph-grounding:overlay');

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: {
        ...runtime,
        teachingAssistantMode: contract,
      },
    });
    expect(prompt).toContain('K/A/Q 图谱 grounding');
    expect(prompt).toContain('LearningGoal: control-correction');
    expect(prompt).toContain('引用锚点: content:1, learner-state:1');
    expect(prompt).toContain('证据锚点: learner-state:1');
    expect(prompt).not.toContain('content:control-correction');
    expect(prompt).not.toContain('learner:student-1');
    expect(prompt).toContain('graph grounding 限制: overlay:learner-or-class-overlay-missing');

    const pageContextOutput = await buildKonlingToolRuntime({
      db: {},
      scope,
      context: { ...runtime, permittedTools: contract.permittedTools },
    }).getPageContext();
    expectRecord(pageContextOutput, 'page context output');
    expectRecord(pageContextOutput.graphContext, 'graph context');
    expectStringArray(pageContextOutput.graphContext.selectedGraphNodeIds, 'graph context selected nodes');

    expect(pageContextOutput.graphContext).toMatchObject({
      source: 'server-owned',
      learningGoal: { id: 'control-correction' },
      selectedGraphNodeIds: ['cap:autocontrol:synthesize-controller-correction'],
      clientHintsAccepted: [],
    });
    expect(pageContextOutput.graphContext?.selectedGraphNodeIds).not.toContain('kn:autocontrol:forged-node');
    expect(pageContextOutput.graphContext?.classOverlay).toMatchObject({
      status: 'unauthorized',
      classId: null,
      items: {},
    });
  });

  it('degrades graph-aware contracts when runtime graph context is absent', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:path',
          sourceType: 'content',
          displayTitle: '路径内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', courseId: 'unknown-course', pageId: 'adaptive-path-center' }),
      serverModeContext: { 'student-path-center': true },
    });

    expect(contract.status).toBe('degraded');
    expect(contract.graphContext?.status).toBe('missing');
    expect(contract.degradedReasons).toEqual(expect.arrayContaining([
      'missing-graph-grounding:learning-goal',
      'missing-graph-grounding:graph',
    ]));
  });

  it('degrades resource-coach when graph resource grounding is missing', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:resource',
          sourceType: 'content',
          displayTitle: '资源说明',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '路径记录',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }, {
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', courseId: 'unknown-course', pageId: 'resource-node-launch', resourceId: 'resource-1' }),
      serverModeContext: {
        'resource-node': true,
        'path-execution-context': true,
        'evidence-citations': true,
      },
    });

    expect(contract.status).toBe('degraded');
    expect(contract.answerIntent).toBe('fact-explanation');
    expect(contract.degradedReasons).toEqual(expect.arrayContaining([
      'missing-graph-grounding:learning-goal',
      'missing-graph-grounding:graph',
      'missing-graph-grounding:resource',
    ]));
  });

  it('keeps path-advisor generation available when a student has no existing path yet', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context'],
      planContext: {
        currentPathId: null,
        activeNodeId: null,
        nextNodeIds: [],
        recentPathIds: [],
        completedNodeIds: [],
        status: 'missing',
      },
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:starter',
          sourceType: 'content',
          displayTitle: '路径目标内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', pageId: 'adaptive-path-center', pathNodeId: null }),
      serverModeContext: { 'student-path-center': true },
    });

    expect(contract.status).toBe('degraded');
    expect(contract.unavailableReasons).toEqual([]);
    expect(contract.permittedTools).toContain('generate_learning_path');
  });

  it('keeps path-advisor generation available for cold-start students with signed path-center context', async () => {
    mocks.readAdaptiveLearnerState.mockResolvedValueOnce(null);
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
      pageContextHint: {
        pageType: 'practice',
        courseId: 'control-correction',
        courseTitle: '控制系统校正设计',
        stepId: 'adaptive-path-center',
        topic: '控制系统校正学习路径',
        learningObjectives: ['生成、比较和调整学习路径'],
        knowledgeType: 'C',
      },
      trustedContentContext: true,
    });

    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: 'control-correction',
    }));
    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({
        role: 'student',
        authenticatedUserId: 'student-1',
        targetUserId: 'student-1',
        classId: 'class-1',
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        pathNodeId: null,
      }),
      serverModeContext: {
        'student-path-center': true,
        'learner-state-summary': true,
        'evidence-citations': true,
      },
    });

    expect(contract.status).not.toBe('unavailable');
    expect(contract.unavailableReasons).toEqual([]);
    expect(contract.degradedReasons).toEqual(expect.arrayContaining(['low-confidence-learner-state']));
    expect(contract.citationRequirements.missingClasses).not.toEqual(expect.arrayContaining(['learner-state', 'content']));
    expect(contract.permittedTools).toContain('generate_learning_path');
  });

  it('records disabled learner-state service as operational missing context while preserving content citations', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'false';

    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'step-03',
      pageContextHint: {
        pageType: 'practice',
        courseId: 'control-correction',
        courseTitle: '控制系统校正设计',
        stepId: 'step-03',
        topic: '根轨迹校正',
        learningObjectives: ['解释根轨迹校正'],
        knowledgeType: 'C',
      },
      trustedContentContext: true,
    });

    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
    expect(runtime.featureFlags.learnerState).toBe(false);
    expect(runtime.missingContext).toEqual(expect.arrayContaining([
      'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED',
      'citation-learner-state-missing',
    ]));
    expect(runtime.citationContext?.contentCitations.length).toBeGreaterThan(0);
    const guard = buildKonlingCitationGuard(runtime, '根据 citation(content:step-03, content, 根轨迹校正, high, page-context) 解释根轨迹校正。');
    expect(guard.missingCitationClasses).not.toContain('content');
  });

  it('keeps citation context available when the feature-cache delegate is absent', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'step-03',
      pageContextHint: {
        pageType: 'practice',
        courseId: 'control-correction',
        courseTitle: '控制系统校正设计',
        stepId: 'step-03',
        topic: '根轨迹校正',
        learningObjectives: ['解释根轨迹校正'],
        knowledgeType: 'C',
      },
      trustedContentContext: true,
    });

    expect(runtime.citationContext?.contentCitations.length).toBeGreaterThan(0);
    expect(runtime.citationContext?.missingCitationClasses).not.toContain('content');
  });

  it('adds learner-state citation metadata when learner-state is available', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'step-03',
      pageContextHint: {
        pageType: 'practice',
        courseId: 'control-correction',
        courseTitle: '控制系统校正设计',
        stepId: 'step-03',
        topic: '根轨迹校正',
        learningObjectives: ['解释根轨迹校正'],
        knowledgeType: 'C',
      },
      trustedContentContext: true,
    });

    expect(runtime.learnerState).toBeTruthy();
    expect(runtime.userProfile.abilityVector).toMatchObject({
      computational: 0.88,
      design: 0.72,
    });
    expect(runtime.citationContext?.evidenceCitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'learner-state:student-1',
        sourceType: 'learner-state',
        evidenceBasis: 'AdaptiveLearnerState',
        owner: 'recommendation',
      }),
    ]));
  });

  it('keeps content citations available when learner-state feature-cache reads fail', async () => {
    mocks.readAdaptiveLearnerState.mockRejectedValueOnce(new Error('feature cache read failed'));
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockRejectedValue(new Error('feature cache read failed')),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'step-03',
      pageContextHint: {
        pageType: 'practice',
        courseId: 'control-correction',
        courseTitle: '控制系统校正设计',
        stepId: 'step-03',
        topic: '根轨迹校正',
        learningObjectives: ['解释根轨迹校正'],
        knowledgeType: 'C',
      },
      trustedContentContext: true,
    });

    expect(runtime.learnerState).toBeNull();
    expect(runtime.missingContext).toContain('learner-state-read-failed');
    expect(runtime.citationContext?.contentCitations.length).toBeGreaterThan(0);
    const guard = buildKonlingCitationGuard(runtime, '根据 citation(content:step-03, content, 根轨迹校正, high, page-context) 解释根轨迹校正。');
    expect(guard.missingCitationClasses).not.toContain('content');
    expect(guard.personalizationAvailability).toMatchObject({
      status: 'limited',
      missingCitationClasses: expect.arrayContaining(['learner-state', 'path-execution', 'evidence']),
    });
  });

  it('resolves control-correction course aliases before reading learner goal slices', async () => {
    await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      targetUserId: 'student-1',
      classId: 'class-1',
      courseId: 'unit-3-6-zero-design-workshop-v1',
      pageId: 'adaptive-path-center',
      pageContextHint: {
        courseId: 'unit-3-6-zero-design-workshop-v1',
        stepId: 'adaptive-path-center',
        pageType: 'practice',
      },
      trustedContentContext: true,
    });

    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'student-1',
      role: 'student',
      classId: 'class-1',
      goal: 'control-correction',
    }));
  });

  it('assembles class overlay for teacher graph-aware class contexts', async () => {
    const classLearnerIds = ['student-1', 'student-2', 'student-3', 'student-4', 'student-5'];
    mocks.readAdaptiveLearnerState.mockImplementation((_db, args) => {
      if (classLearnerIds.includes(args.userId)) {
        return Promise.resolve(createGraphLearnerState(args.userId, 0.62 + classLearnerIds.indexOf(args.userId) * 0.05));
      }
      return Promise.resolve(null);
    });

    const runtime = await buildKonlingRuntimeContext({
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' }),
      },
      studentProfile: {
        findMany: vi.fn().mockResolvedValue(classLearnerIds.map((userId) => ({ userId }))),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'teacher-1',
      authenticatedUserName: '王老师',
      role: 'TEACHER',
      targetUserId: 'teacher-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'teacher-class-report',
      pageContextHint: {
        courseId: 'control-correction',
        stepId: 'teacher-class-report',
        pageType: 'workspace',
        topic: '班级控制系统校正诊断',
      },
      trustedContentContext: true,
    });
    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'class-summarizer',
      runtimeContext: runtime,
      scope: createScope({
        authenticatedUserId: 'teacher-1',
        targetUserId: 'teacher-1',
        role: 'teacher',
        classId: 'class-1',
        courseId: 'control-correction',
        pageId: 'teacher-class-report',
        privacyScopes: ['teacher-scoped'],
      }),
      serverModeContext: {
        'class-report': true,
        'diagnosis-view': true,
        'evidence-citations': true,
      },
    });

    expect(runtime.graphContext?.classOverlay?.status).toBe('available');
    expect(runtime.graphContext?.classOverlay?.classId).toBe('class-1');
    expect(runtime.graphContext?.classOverlay?.items['cap:autocontrol:synthesize-controller-correction']).toMatchObject({
      denominator: 5,
      suppressionReason: 'none',
    });
    expect(contract.graphContext?.classOverlay?.status).toBe('available');
    expect(contract.degradedReasons).not.toContain('missing-graph-grounding:overlay');
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      goal: 'control-correction',
    }));
  });

  it('does not build class overlay outside teacher graph-aware class surfaces', async () => {
    const findMany = vi.fn().mockResolvedValue([{ userId: 'student-1' }]);
    await buildKonlingRuntimeContext({
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' }),
      },
      studentProfile: {
        findMany,
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'teacher-1',
      authenticatedUserName: '王老师',
      role: 'TEACHER',
      targetUserId: 'teacher-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'teacher-dashboard',
      pageContextHint: {
        courseId: 'control-correction',
        stepId: 'teacher-dashboard',
        pageType: 'workspace',
      },
    });

    expect(findMany).not.toHaveBeenCalled();
  });

  it('caps teacher class overlay learner state reads for large classes', async () => {
    const classLearnerIds = Array.from({ length: 35 }, (_, index) => `student-${index + 1}`);
    mocks.readAdaptiveLearnerState.mockImplementation((_db, args) => {
      if (classLearnerIds.includes(args.userId)) {
        return Promise.resolve(createGraphLearnerState(args.userId, 0.62));
      }
      return Promise.resolve(null);
    });

    const runtime = await buildKonlingRuntimeContext({
      class: {
        findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1' }),
      },
      studentProfile: {
        findMany: vi.fn().mockResolvedValue(classLearnerIds.map((userId) => ({ userId }))),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'teacher-1',
      authenticatedUserName: '王老师',
      role: 'TEACHER',
      targetUserId: 'teacher-1',
      classId: 'class-1',
      courseId: 'control-correction',
      pageId: 'teacher-prep-pack',
      pageContextHint: {
        courseId: 'control-correction',
        stepId: 'teacher-prep-pack',
        pageType: 'workspace',
      },
    });

    const studentStateReadCalls = mocks.readAdaptiveLearnerState.mock.calls
      .map(([, args]) => args.userId)
      .filter((userId) => classLearnerIds.includes(userId));
    expect(studentStateReadCalls).toHaveLength(30);
    expect(studentStateReadCalls).not.toContain('student-31');
    expect(runtime.graphContext?.classOverlay?.items['cap:autocontrol:synthesize-controller-correction']).toMatchObject({
      denominator: 30,
      excludedPopulation: 5,
      suppressionReason: 'none',
    });
  });

  it('does not expose path-advisor write tools from forged page ids without server context', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
      planContext: {
        currentPathId: null,
        activeNodeId: null,
        nextNodeIds: [],
        recentPathIds: [],
        completedNodeIds: [],
        status: 'missing',
      },
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:generic',
          sourceType: 'content',
          displayTitle: '当前页面内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', pageId: '/assessment/adaptive-practice', pathNodeId: null }),
    });

    expect(contract.status).toBe('degraded');
    expect(contract.permittedTools).not.toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'record_path_adjustment_outcome',
    ]));
    expect(contract.permittedTools).toEqual(expect.arrayContaining([
      'get_page_context',
      'get_learner_state',
      'get_plan_context',
      'search_knowledge_graph',
    ]));
  });

  it('does not expose path-advisor write tools from runtime permissions without server context', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: [
        'get_page_context',
        'get_learner_state',
        'get_plan_context',
        'generate_learning_path',
        'revise_learning_path_options',
        'select_learning_path',
        'reject_learning_path_option',
        'record_path_adjustment_outcome',
      ],
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:generic',
          sourceType: 'content',
          displayTitle: '当前页面内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ role: 'student', pageId: 'adaptive-path-center', pathNodeId: null }),
    });

    expect(contract.status).toBe('degraded');
    expect(contract.permittedTools).not.toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'record_path_adjustment_outcome',
    ]));
  });

  it('does not expose student path write tools to teacher scope even with path-center context', () => {
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:generic',
          sourceType: 'content',
          displayTitle: '当前页面内容',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner:student-1',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({
        role: 'teacher',
        authenticatedUserId: 'teacher-1',
        targetUserId: 'student-1',
        pageId: 'adaptive-path-center',
        pathNodeId: null,
      }),
      serverModeContext: { 'student-path-center': true },
    });

    expect(contract.permittedTools).not.toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'record_path_adjustment_outcome',
    ]));
  });

  it('does not make grading mode unavailable for unrelated citation gaps', () => {
    const runtime = createRuntimeContext({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:rubric',
          sourceType: 'content',
          displayTitle: '评分量规',
          href: null,
          confidence: 'high',
          evidenceBasis: 'server-rubric',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner-state:student-1',
          sourceType: 'learner-state',
          displayTitle: '学生学习状态',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'server-learner-state',
          owner: 'report-explanation',
        }],
        missingCitationClasses: ['path-execution'],
        lowConfidenceReasons: ['missing-path-execution'],
        responseProtocol: {
          requiredOwners: ['answer', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', targetUserId: 'student-1' }),
      serverModeContext: {
        rubric: true,
        'converted-document': true,
        'draft-grading-state': true,
        'teacher-review-state': true,
      },
    });

    expect(contract.status).not.toBe('unavailable');
    expect(contract.unavailableReasons).not.toContain('missing-context:evidence-citations');
    expect(contract.citationRequirements.missingClasses).toEqual([]);
    expect(contract.permittedTools).toEqual(['get_page_context', 'search_knowledge_graph']);
  });

  it('does not silently widen explicit unknown modes and preserves grading aliases', () => {
    const runtime = createRuntimeContext({
      permittedTools: ['get_page_context', 'search_knowledge_graph', 'record_intervention_result'],
    });

    const invalid = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'unknown-mode',
      runtimeContext: runtime,
      scope: createScope(),
    });
    expect(invalid.mode.id).toBe('generic-chat');
    expect(invalid.status).toBe('unavailable');
    expect(invalid.unavailableReasons).toContain('unknown-mode:unknown-mode');
    expect(invalid.permittedTools).toEqual([]);

    const teacherGrading = resolveKonlingTeachingAssistantMode('teacher-grading-assistant');
    expect(teacherGrading.id).toBe('grading-assistant');
    expect(teacherGrading.outputContract.forbiddenActions).toContain('approve-grading');

    const studentFeedback = resolveKonlingTeachingAssistantMode('student-feedback-explainer');
    expect(studentFeedback.id).toBe('feedback-explainer');
    expect(studentFeedback.supportedRoles).toEqual(['student']);
  });

  it('accepts server-owned mode context without allowing client hints to unlock modes', () => {
    const runtime = createRuntimeContext({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'rubric-citation',
          sourceType: 'content',
          displayTitle: '评分量规',
          href: null,
          confidence: 'high',
          owner: 'answer',
          evidenceBasis: 'server-rubric',
        }],
        evidenceCitations: [{
          id: 'learner-state-citation',
          sourceType: 'learner-state',
          displayTitle: '学习状态摘要',
          href: null,
          confidence: 'medium',
          owner: 'report-explanation',
          evidenceBasis: 'server-learner-state',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      permittedTools: ['get_page_context', 'search_knowledge_graph', 'record_intervention_result'],
    });

    const withoutServerContext = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      clientContextHints: {
        rubric: true,
        convertedDocument: true,
      },
    });
    expect(withoutServerContext.status).toBe('unavailable');
    expect(withoutServerContext.unavailableReasons).toContain('missing-context:rubric');
    expect(withoutServerContext.clientHintsAccepted).toEqual([]);

    const withServerContext = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        rubric: true,
        'converted-document': true,
        'draft-grading-state': true,
        'teacher-review-state': true,
      },
      clientContextHints: {
        targetUserId: 'student-2',
      },
    });

    expect(withServerContext.status).toBe('ready');
    expect(withServerContext.permittedTools).toEqual(['get_page_context', 'search_knowledge_graph']);
    expect(withServerContext.clientHintsRejected).toEqual(['targetUserId']);
    expect(withServerContext.outputContract.status).toBe('draft-only');
    expect(withServerContext.outputContract.forbiddenActions).toEqual(expect.arrayContaining([
      'approve-grading',
      'write-back-profile',
    ]));
  });

  it('requires server-owned resource context before enabling resource coach', () => {
    const runtime = createRuntimeContext({
      planContext: {
        currentPathId: 'path-1',
        activeNodeId: 'node-1',
        nextNodeIds: [],
        recentPathIds: ['path-1'],
        completedNodeIds: [],
        status: 'available',
      },
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:resource',
          sourceType: 'content',
          displayTitle: '资源节点',
          href: null,
          confidence: 'high',
          evidenceBasis: 'server-resource',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '学习路径',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }, {
          id: 'learner-state:student-1',
          sourceType: 'learner-state',
          displayTitle: '学生学习状态',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action', 'analyze_attempt'],
    });

    const withoutServerContext = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: runtime,
      scope: createScope({ resourceId: 'resource-1' }),
      clientContextHints: { resourceId: 'resource-1' },
    });
    expect(withoutServerContext.status).toBe('unavailable');
    expect(withoutServerContext.unavailableReasons).toContain('missing-context:resource-node');

    const withServerContext = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: runtime,
      scope: createScope({ resourceId: 'resource-1' }),
      serverModeContext: { 'resource-node': true },
    });
    expect(withServerContext.status).toBe('degraded');
    expect(withServerContext.answerIntent).toBe('fact-explanation');
    expect(withServerContext.degradedReasons).toEqual(expect.arrayContaining([
      'missing-graph-grounding:learning-goal',
      'missing-graph-grounding:graph',
    ]));
    expect(withServerContext.permittedTools).toContain('analyze_attempt');

    const withMediaServerContext = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: runtime,
      scope: createScope({ resourceId: 'opaque-resource-id' }),
      serverModeContext: { 'resource-node': true, 'media-resource': true },
      clientContextHints: { resourceId: 'plain-client-id' },
    });
    expect(withMediaServerContext.status).toBe('degraded');
    expect(withMediaServerContext.answerIntent).toBe('media-guidance');
    expect(withMediaServerContext.groundingContext.resourceRefs).toEqual(['resource:opaque-resource-id']);
    expect(withMediaServerContext.groundingContext.missingContext).not.toContain('resource-context-missing');

    const nonMediaResourceWithMediaPageType = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: {
        ...runtime,
        pageContext: {
          ...runtime.pageContext,
          pageType: 'video' as KonlingRuntimeContext['pageContext']['pageType'],
        },
      },
      scope: createScope({ resourceId: 'ordinary-resource' }),
      serverModeContext: { 'resource-node': true },
    });
    expect(nonMediaResourceWithMediaPageType.status).toBe('degraded');
    expect(nonMediaResourceWithMediaPageType.answerIntent).toBe('fact-explanation');

    const withSelectedKnowledgeNode = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: {
        ...runtime,
        knowledgeWorkspace: {
          source: 'server-owned',
          route: '/knowledge',
          status: 'selected-node',
          selected_node: {
            id: 'node-second-order',
            name: '二阶系统标准型',
            node_type: 'THEORY',
            chapter: '时域分析',
            knowledge_dim: 'CONCEPTUAL',
            description: '二阶系统传递函数标准形式',
            tags: ['二阶系统'],
          },
          relation_summary: {
            density_mode: 'focused',
            view_mode: '2D',
            active_filters: ['关系 2/6'],
            visible_relation_count: 7,
            selected_node_relation_count: 3,
          },
          available_learning_actions: ['open-knowledge-card'],
          hover_policy: 'preview-only-not-durable-context',
          missing_context: [],
        },
      },
      scope: createScope({ pageId: '/knowledge', resourceId: null }),
      clientContextHints: { targetUserId: 'other-student' },
    });
    expect(withSelectedKnowledgeNode.status).toBe('degraded');
    expect(withSelectedKnowledgeNode.answerIntent).toBe('fact-explanation');
    expect(withSelectedKnowledgeNode.groundingContext).toMatchObject({
      source: 'server-owned',
      knowledgeNodeRefs: ['knowledge-node:node-second-order'],
      resourceRefs: [],
      scope: expect.objectContaining({
        targetUserId: 'student-1',
        role: 'student',
        pageId: '/knowledge',
      }),
    });
    expect(withSelectedKnowledgeNode.groundingContext.missingContext).toContain('capability-target-context-missing');
    expect(withSelectedKnowledgeNode.clientHintsAccepted).toEqual([]);
    expect(withSelectedKnowledgeNode.clientHintsRejected).toEqual(['targetUserId']);
  });

  it('builds answer intent and grounding metadata from server-owned knowledge capability context', async () => {
    const db = {
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'node-root-locus',
          name: '根轨迹设计',
          nodeType: 'THEORY',
          description: '根轨迹设计用于分析闭环极点随增益变化的轨迹。',
          knowledgeDim: 'CONCEPTUAL',
          metadata: {
            chapterName: '根轨迹法',
            capabilityTargetRefs: ['capability:root-locus-design'],
          },
          tags: ['根轨迹'],
        }]),
      },
    };

    const runtime = await buildKonlingRuntimeContext(db, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5',
      pageId: '/knowledge',
      knowledgeWorkspaceHint: {
        status: 'selected-node',
        selectedNodeId: 'node-root-locus',
      },
      trustedContentContext: true,
    });
    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'generic-chat',
      runtimeContext: runtime,
      scope: createScope({ pageId: '/knowledge', resourceId: null, pathNodeId: null }),
    });

    expect(contract.status).toBe('ready');
    expect(contract.answerIntent).toBe('fact-explanation');
    expect(contract.groundingContext).toMatchObject({
      source: 'server-owned',
      knowledgeNodeRefs: ['knowledge-node:node-root-locus'],
      capabilityTargetRefs: ['capability:root-locus-design'],
      resourceRefs: [],
      pathNodeRefs: [],
      sarAssociatedGrounding: null,
    });
    expect(contract.groundingContext.missingContext).toEqual([]);
    expect(runtime.citationContext?.contentCitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'content:knowledge-node:node-root-locus',
        sourceType: 'content',
        owner: 'answer',
        evidenceBasis: 'knowledge-workspace-selected-node',
      }),
    ]));

    const toolRuntime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: '/knowledge', resourceId: null, pathNodeId: null }),
      context: runtime,
    });
    await expect(toolRuntime.getPageContext()).resolves.toMatchObject({
      knowledgeCapabilityContext: {
        knowledgeNodeRefs: ['knowledge-node:node-root-locus'],
        capabilityTargetRefs: ['capability:root-locus-design'],
      },
    });
  });

  it('exposes selected knowledge workspace context to prompts and page-context tools', async () => {
    const runtime = createRuntimeContext({
      knowledgeWorkspace: {
        source: 'server-owned',
        route: '/knowledge',
        status: 'selected-node',
        selected_node: {
          id: 'node-second-order',
          name: '二阶系统标准型',
          node_type: 'THEORY',
          chapter: '时域分析',
          knowledge_dim: 'CONCEPTUAL',
          description: '二阶系统传递函数标准形式',
          tags: ['二阶系统'],
        },
        relation_summary: {
          density_mode: 'focused',
          view_mode: '2D',
          active_filters: ['关系 2/6'],
          visible_relation_count: 7,
          selected_node_relation_count: 3,
        },
        available_learning_actions: ['open-knowledge-card'],
        hover_policy: 'preview-only-not-durable-context',
        missing_context: [],
      },
      knowledgeCapabilityContext: {
        source: 'server-owned',
        answerIntent: 'fact-explanation',
        knowledgeNodeRefs: ['knowledge-node:node-second-order'],
        capabilityTargetRefs: ['capability:second-order-modeling'],
        resourceRefs: [],
        pathNodeRefs: [],
        citationRefs: ['content:1'],
        scope: createScope({ pageId: '/knowledge', resourceId: null, pathNodeId: null }),
        missingContext: [],
      },
      permittedTools: ['get_page_context'],
    });

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: runtime,
    });
    expect(prompt).toContain('知识工作区上下文');
    expect(prompt).toContain('二阶系统标准型');
    expect(prompt).toContain('selected-node');
    expect(prompt).toContain('preview-only-not-durable-context');
    expect(prompt).toContain('知识与能力 grounding');
    expect(prompt).toContain('capability:second-order-modeling');

    const toolRuntime = buildKonlingToolRuntime({
      db: {},
      scope: createScope({ pageId: '/knowledge' }),
      context: runtime,
    });
    await expect(toolRuntime.getPageContext()).resolves.toMatchObject({
      pageContext: runtime.pageContext,
      knowledgeWorkspace: {
        selected_node: {
          id: 'node-second-order',
        },
      },
      knowledgeCapabilityContext: {
        knowledgeNodeRefs: ['knowledge-node:node-second-order'],
        capabilityTargetRefs: ['capability:second-order-modeling'],
      },
    });
  });

  it('preserves generic chat behavior when no teaching-assistant mode is requested', () => {
    const runtime = createRuntimeContext({
      permittedTools: ['get_page_context', 'get_learner_state', 'recommend_next_action'],
      citationContext: {
        required: true,
        contentCitations: [],
        evidenceCitations: [],
        missingCitationClasses: ['content', 'evidence'],
        lowConfidenceReasons: ['missing-content', 'missing-evidence'],
        responseProtocol: {
          requiredOwners: ['answer'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    const contract = buildKonlingTeachingAssistantRuntimeContract({
      runtimeContext: runtime,
      scope: createScope(),
    });

    expect(contract.mode.id).toBe('generic-chat');
    expect(contract.status).toBe('ready');
    expect(contract.permittedTools).toEqual(runtime.permittedTools);
    expect(contract.unavailableReasons).toEqual([]);
  });

  it('does not expose adaptive path write tools through generic chat defaults', () => {
    const runtime = createRuntimeContext();
    const contract = buildKonlingTeachingAssistantRuntimeContract({
      runtimeContext: runtime,
      scope: createScope(),
    });

    expect(contract.mode.id).toBe('generic-chat');
    expect(contract.permittedTools).not.toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'record_path_adjustment_outcome',
    ]));
  });

  it('does not include adaptive path write tools in server-owned default runtime tools', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'adaptive-path-center',
      trustedContentContext: true,
    });

    expect(runtime.permittedTools).not.toEqual(expect.arrayContaining([
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'record_path_adjustment_outcome',
    ]));
  });

  it('adds teaching-assistant mode privacy and output constraints to the system prompt', () => {
    const runtime = createRuntimeContext();
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'teacher-grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', targetUserId: 'student-1', privacyScopes: ['teacher-scoped'] }),
    });
    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: {
        ...runtime,
        teachingAssistantMode: modeContract,
      },
    });

    expect(prompt).toContain('控灵教学助理模式');
    expect(prompt).toContain('文档批改助手');
    expect(prompt).toContain('teacher-scoped-summary');
    expect(prompt).toContain('raw-answer-body');
    expect(prompt).toContain('approve-grading');
    expect(prompt).toContain('write-back-profile');
  });

  it('builds prompt context from server learner state and not client profile defaults', async () => {
    const db = {
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'path-1', nodeIds: ['node-1', 'node-2'] },
        ]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            memoryType: 'working-summary',
            privacyScope: 'student-visible',
            summary: '学生在频域裕度迁移上需要脚手架。',
            evidenceRefs: [],
            createdAt: new Date('2026-05-28T00:00:00Z'),
          },
        ]),
      },
    };

    const runtime = await buildKonlingRuntimeContext(db, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      trustedContentContext: true,
      pageContextHint: {
        courseId: 'unit-4-5',
        courseTitle: '客户端标题',
        stepId: 'step-03',
        pageType: 'practice',
        topic: '客户端主题',
        learningObjectives: ['客户端目标'],
        knowledgeType: 'X',
      },
    });

    expect(runtime.learnerState).toMatchObject({ authority: 'server-owned' });
    expect(runtime.userProfile.abilityVector.computational).toBeCloseTo(0.88);
    expect(runtime.planContext.nextNodeIds).toEqual(['node-1', 'node-2']);

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: runtime,
    });

    expect(prompt).toContain('服务端自适应上下文');
    expect(prompt).toContain('server-owned');
    expect(prompt).toContain('不得采用客户端传入的学生画像覆盖服务端学习状态');
    expect(prompt).toContain('学生在频域裕度迁移上需要脚手架');
  });

  it('keeps degraded knowledge workspace requests from becoming selected nodes', async () => {
    const db = {
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'node-filtered-out',
            name: '被过滤节点',
            nodeType: 'THEORY',
            description: '当前图谱状态没有解析该节点。',
            metadata: { chapterName: '时域分析' },
            knowledgeDim: 'CONCEPTUAL',
            tags: ['二阶系统'],
          },
        ]),
      },
    };

    const runtime = await buildKonlingRuntimeContext(db, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      pageId: '/knowledge',
      knowledgeWorkspaceHint: {
        requestedNodeId: 'node-filtered-out',
        selectedNodeId: null,
        status: 'degraded',
        activeFilters: ['当前筛选'],
      },
    });

    expect(db.knowledgeNode.findMany).not.toHaveBeenCalled();
    expect(runtime.knowledgeWorkspace).toMatchObject({
      source: 'server-owned',
      route: '/knowledge',
      status: 'degraded',
      selected_node: null,
      relation_summary: {
        active_filters: ['当前筛选'],
      },
      missing_context: ['knowledge-workspace-selected-node-unresolved'],
    });
  });

  it('builds citation requirements from server path context and evidence cache', async () => {
    const db = {
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'path-1', nodeIds: ['node-1', 'node-2'], goalId: 'control-correction', pathStatus: 'active' },
        ]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            memoryType: 'working-summary',
            privacyScope: 'student-visible',
            summary: '学生最近需要把根轨迹解释和仿真指标联系起来。',
            evidenceRefs: [],
            createdAt: new Date('2026-05-28T00:00:00Z'),
          },
        ]),
      },
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          features: {
            pathExecution: {
              allTime: {
                confidence: { level: 'medium' },
                sourceReferences: [
                  {
                    sourceType: 'LearningPathIntervention',
                    sourceId: 'teacher-intv',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:00:00Z',
                    privacyLevel: 'teacher-scoped',
                    studentOutcome: 'accepted',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'foreign-exec',
                    pathId: 'foreign-path',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:00:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-1',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:00:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-2',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:01:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-3',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:02:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-4',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:07:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-terminal-low-confidence',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:08:00Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    terminalValidationState: 'low-confidence',
                    lowConfidenceMarkers: ['arena-preview-only'],
                    hiddenTrace: [{ t: 0, y: 1 }],
                  },
                  {
                    sourceType: 'LearningPathIntervention',
                    sourceId: 'student-intv-latest',
                    pathId: 'path-1',
                    nodeId: 'node-1',
                    occurredAt: '2026-05-28T00:04:00Z',
                    privacyLevel: 'student-visible',
                    studentOutcome: 'rejected',
                  },
                  {
                    sourceType: 'LearningPathIntervention',
                    sourceId: 'student-intv-other-node',
                    pathId: 'path-1',
                    nodeId: 'node-2',
                    occurredAt: '2026-05-28T00:05:00Z',
                    privacyLevel: 'student-visible',
                    studentOutcome: 'accepted',
                  },
                  {
                    sourceType: 'LearningPathIntervention',
                    sourceId: 'legacy-intv-missing-node',
                    pathId: 'path-1',
                    occurredAt: '2026-05-28T00:06:00Z',
                    privacyLevel: 'student-visible',
                    studentOutcome: 'accepted',
                  },
                ],
              },
            },
            simulationArena: {
              allTime: {
                replayConfidence: { lowConfidenceCount: 1 },
                traceReferences: [
                  {
                    source: 'simulation',
                    traceReference: 'trace:run-1',
                    factId: 'fact-1',
                    startedAt: '2026-05-28T00:00:00Z',
                  },
                ],
              },
            },
          },
        }),
      },
    };

    const runtime = await buildKonlingRuntimeContext(db, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      trustedContentContext: true,
    });

    expect(runtime.citationContext?.required).toBe(true);
    expect(runtime.citationContext?.contentCitations[0]).toMatchObject({
      sourceType: 'content',
      evidenceBasis: 'course-ai-context',
      citationChip: expect.objectContaining({
        sourceType: 'course-content',
        authorityLevel: 'canonical',
        privacyVisibility: 'public',
      }),
    });
    expect(runtime.citationContext?.evidenceCitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: 'path-execution',
        evidenceBasis: 'LearningPathExecution',
        citationChip: expect.objectContaining({
          sourceType: 'path-summary',
          authorityLevel: 'learner-evidence',
          privacyVisibility: 'redacted',
        }),
      }),
      expect.objectContaining({
        id: 'LearningPathExecution:exec-terminal-low-confidence',
        sourceType: 'path-execution',
        displayTitle: '控制校正终端验证低置信证据',
        confidence: 'low',
      }),
      expect.objectContaining({ id: 'LearningPathIntervention:student-intv-latest', sourceType: 'intervention' }),
      expect.objectContaining({ sourceType: 'simulation', confidence: 'low' }),
    ]));
    expect(JSON.stringify(runtime.citationContext?.evidenceCitations)).not.toContain('hiddenTrace');
    const latestInterventionIndex = runtime.citationContext?.evidenceCitations
      .findIndex((citation) => citation.id === 'LearningPathIntervention:student-intv-latest') ?? -1;
    const newerExecutionIndex = runtime.citationContext?.evidenceCitations
      .findIndex((citation) => citation.id === 'LearningPathExecution:exec-4') ?? -1;
    expect(latestInterventionIndex).toBeGreaterThanOrEqual(0);
    expect(newerExecutionIndex).toBeGreaterThan(latestInterventionIndex);
    expect(runtime.citationContext?.evidenceCitations).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'LearningPathIntervention:teacher-intv' }),
      expect.objectContaining({ id: 'LearningPathExecution:foreign-exec' }),
      expect.objectContaining({ id: 'LearningPathExecution:exec-1' }),
      expect.objectContaining({ id: 'LearningPathIntervention:student-intv-other-node' }),
      expect.objectContaining({ id: 'LearningPathIntervention:legacy-intv-missing-node' }),
    ]));
    expect(db.learningPath.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'active',
        classId: 'class-1',
      }),
    }));

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: runtime,
    });
    expect(prompt).toContain('引用协议');
    expect(prompt).toContain('sourceType、displayTitle、href、confidence、evidenceBasis');

    const toolRuntime = buildKonlingToolRuntime({
      db,
      scope: createScope(),
      context: runtime,
    });
    const recommendation = await toolRuntime.recommendNextAction() as Record<string, any>;
    expect(recommendation.citationSupport.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: 'content' }),
      expect.objectContaining({ sourceType: 'path-execution' }),
    ]));
    expect(recommendation.citationSupport.readiness).toBe('low-confidence');
  });

  it('does not turn client-only page hints into high-confidence content citations', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unknown-client-course',
      pageId: 'unknown-client-page',
      pageContextHint: {
        courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
        stepId: 'step-03',
        courseTitle: '客户端伪造标题',
        topic: '客户端伪造主题',
      },
    });

    expect(runtime.pageContext.courseId).toBe('unknown-client-course');
    expect(runtime.citationContext?.contentCitations).toEqual([]);
    expect(runtime.citationContext?.missingCitationClasses).toContain('content');
  });

  it('derives simulation runtime page context from server-owned scope', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'destroyer',
      pageContextHint: {
        simulationId: 'client-forged',
        routeProvenance: 'simulation-route',
        runSummaryAvailability: 'available',
      },
    });

    expect(runtime.pageContext).toMatchObject({
      courseId: 'simulation',
      stepId: 'destroyer',
      simulationId: 'destroyer',
      routeProvenance: 'simulation-route',
      runSummaryAvailability: 'unavailable-until-runtime-run',
    });
    expect(runtime.missingContext).toContain('simulation-run-summary-unavailable');

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: runtime,
    });
    expect(prompt).toContain('simulation-run-summary-unavailable');
    expect(prompt).toContain('不得给出权威仿真诊断');
  });

  it('does not treat unmatched pathNodeId as an active path node', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
      pathNodeId: 'client-node',
      trustedContentContext: true,
    });

    expect(runtime.planContext).toMatchObject({
      currentPathId: null,
      activeNodeId: null,
      status: 'missing',
    });
    const recommendation = await buildKonlingToolRuntime({
      db: {},
      scope: createScope({ pathNodeId: 'client-node' }),
      context: runtime,
    }).recommendNextAction() as Record<string, any>;
    expect(recommendation.action).not.toBe('continue_path_node');
  });

  it('uses the server currentNodeId ahead of a client pathNodeId inside active paths', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'path-1',
            userId: 'student-1',
            goalId: 'control-correction',
            classId: 'class-1',
            pathStatus: 'active',
            currentNodeId: 'server-node',
            nodeIds: ['client-node', 'server-node', 'next-node'],
          },
        ]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
      pathNodeId: 'client-node',
      trustedContentContext: true,
    });

    expect(runtime.planContext).toMatchObject({
      currentPathId: 'path-1',
      activeNodeId: 'server-node',
      status: 'available',
    });
  });

  it('reads three-style path options and selection history for the path advisor context', async () => {
    const runtime = await buildKonlingRuntimeContext({
      studentProfile: {
        findFirst: vi.fn().mockResolvedValue({ userId: 'student-1', classId: 'class-1' }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'path-1',
            userId: 'student-1',
            goalId: 'control-correction',
            classId: 'class-1',
            pathStatus: 'active',
            currentNodeId: 'node-1',
            nodeIds: ['node-1', 'arena-task:terminal'],
            pathPayload: {
              policyBundle: {
                status: 'ready',
                paths: [
                  {
                    styleId: 'foundation-remediation',
                    policyFamily: 'foundation-remediation',
                    label: '基础补救',
                    nodeIds: ['node-1', 'arena-task:terminal'],
                    evidenceBasis: ['adaptive-learner-state', 'LearningFact'],
                    resourceMix: { knowledge_card: 1, arena_task: 1 },
                    effort: { estimatedMinutes: 38, relative: 'medium' },
                    terminalValidationNodeIds: ['arena-task:terminal'],
                    limitations: ['some-targets-have-no-direct-evidence'],
                  },
                ],
              },
              selectionHistory: [
                {
                  type: 'selection',
                  selectedStyleId: 'foundation-remediation',
                  rejectedStyleIds: ['arena-simulation-sprint'],
                  createdAt: '2026-05-28T06:05:00.000Z',
                },
              ],
            },
          },
        ]),
      },
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      classId: 'class-1',
      courseId: 'unit-4-5-constraint-aware-parameter-optimization-v1',
      pageId: 'step-03',
      pathNodeId: 'node-1',
      trustedContentContext: true,
    });

    expect(runtime.planContext.pathOptions).toEqual([
      expect.objectContaining({
        styleId: 'foundation-remediation',
        evidenceBasis: ['adaptive-learner-state', 'LearningFact'],
        terminalValidationNodeIds: ['arena-task:terminal'],
      }),
    ]);
    expect(runtime.planContext.pathOptionFallback).toBeNull();
    expect(runtime.planContext.selectionHistory).toEqual([
      expect.objectContaining({
        type: 'selection',
        selectedStyleId: 'foundation-remediation',
        rejectedStyleIds: ['arena-simulation-sprint'],
      }),
    ]);
  });

  it('downgrades assistant text when required citation metadata is absent', () => {
    const guard = buildKonlingCitationGuard({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:unit:step',
          sourceType: 'content',
          displayTitle: '根轨迹设计',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '当前控制校正学习路径',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    }, '下一步建议先回到根轨迹，再做仿真。这里会写“引用”两个字但没有具体来源。');

    expect(guard).toMatchObject({
      status: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceReasons: ['assistant-citations-missing'],
    });
    expect(applyKonlingCitationFallback('下一步建议先回到根轨迹。', guard)).toContain('证据限制');
  });

  it('downgrades assistant text when it violates teaching-assistant mode contracts', () => {
    const runtime = createRuntimeContext({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:rubric',
          sourceType: 'content',
          displayTitle: '评分量规',
          href: null,
          confidence: 'high',
          evidenceBasis: 'server-rubric',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner-state:student-1',
          sourceType: 'learner-state',
          displayTitle: '学生学习状态',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'server-learner-state',
          owner: 'report-explanation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        rubric: true,
        'converted-document': true,
        'draft-grading-state': true,
        'teacher-review-state': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext: runtime.citationContext,
      teachingAssistantMode: modeContract,
    }, '依据评分量规 (content, high) 可以 approve-grading，并输出 raw-answer-body。');

    expect(guard.status).toBe('low-confidence');
    expect(guard.fallbackRequired).toBe(true);
    expect(guard.lowConfidenceReasons).toEqual(expect.arrayContaining([
      'assistant-mode-contract-violation:approve-grading',
      'assistant-mode-contract-violation:raw-answer-body',
    ]));
  });

  it('downgrades assistant text when teaching-assistant citation owners are missing', () => {
    const runtime = createRuntimeContext({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:rubric',
          sourceType: 'content',
          displayTitle: '评分量规',
          href: null,
          confidence: 'high',
          evidenceBasis: 'server-rubric',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'learner-state:student-1',
          sourceType: 'learner-state',
          displayTitle: '学生学习状态',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'server-learner-state',
          owner: 'answer',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        rubric: true,
        'converted-document': true,
        'draft-grading-state': true,
        'teacher-review-state': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext: runtime.citationContext,
      teachingAssistantMode: modeContract,
    }, '依据评分量规 (content, high) 和学生学习状态 (learner-state, medium) 生成草稿。');

    expect(guard.status).toBe('low-confidence');
    expect(guard.lowConfidenceReasons).toContain('assistant-required-citation-owner-missing:report-explanation');
  });

  it('records missing learner evidence as limited personalization for grading explanations with content citations', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:rubric',
        sourceType: 'content',
        displayTitle: '评分量规',
        href: null,
        confidence: 'high',
        evidenceBasis: 'server-rubric',
        owner: 'answer',
      }, {
        id: 'content:grading-rationale',
        sourceType: 'content',
        displayTitle: '评分说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'server-rubric',
        owner: 'report-explanation',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['learner-state'],
      lowConfidenceReasons: ['missing-learner-state'],
      responseProtocol: {
        requiredOwners: ['answer', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'grading-assistant',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        rubric: true,
        'converted-document': true,
        'draft-grading-state': true,
        'teacher-review-state': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, [
      '依据 citation(content:rubric, content, 评分量规, high, server-rubric) 判断评分边界。',
      '报告说明引用 citation(content:grading-rationale, content, 评分说明, high, server-rubric)。',
    ].join(' '));

    expect(modeContract.answerIntent).toBe('grading-explanation');
    expect(modeContract.status).toBe('degraded');
    expect(modeContract.unavailableReasons).toEqual([]);
    expect(guard).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      personalizationAvailability: {
        status: 'limited',
        missingCitationClasses: ['learner-state'],
        lowConfidenceReasons: expect.arrayContaining(['missing-learner-state']),
      },
    });
  });

  it('records missing intervention and memory evidence as limited personalization metadata', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:report',
        sourceType: 'content',
        displayTitle: '学情总结说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }, {
        id: 'content:report-explanation',
        sourceType: 'content',
        displayTitle: '报告解释说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'report-explanation',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['intervention', 'memory'],
      lowConfidenceReasons: ['missing-intervention', 'missing-memory'],
      responseProtocol: {
        requiredOwners: ['answer', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      graphContext: createCompleteGraphContext(),
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'class-summarizer',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        'class-report': true,
        'diagnosis-view': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, [
      '根据 citation(content:report, content, 学情总结说明, high, course-ai-context) 总结班级情况。',
      '报告解释引用 citation(content:report-explanation, content, 报告解释说明, high, course-ai-context)。',
    ].join(' '));

    expect(modeContract.answerIntent).toBe('personalized-diagnosis');
    expect(guard).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      personalizationAvailability: {
        status: 'limited',
        missingCitationClasses: expect.arrayContaining(['intervention', 'memory']),
        lowConfidenceReasons: expect.arrayContaining(['missing-intervention', 'missing-memory']),
      },
    });
  });

  it('does not treat privacy or mode contract violations as limited personalization', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:report',
        sourceType: 'content',
        displayTitle: '学情总结说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }, {
        id: 'content:report-explanation',
        sourceType: 'content',
        displayTitle: '报告解释说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'report-explanation',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['memory'],
      lowConfidenceReasons: ['missing-memory'],
      responseProtocol: {
        requiredOwners: ['answer', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      graphContext: createCompleteGraphContext(),
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'class-summarizer',
      runtimeContext: runtime,
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', privacyScopes: ['teacher-scoped'] }),
      serverModeContext: {
        'class-report': true,
        'diagnosis-view': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, [
      '根据 citation(content:report, content, 学情总结说明, high, course-ai-context) 总结班级情况。',
      '报告解释引用 citation(content:report-explanation, content, 报告解释说明, high, course-ai-context)。',
      '同时输出 private-konling-memory 和 hidden-arena-internals。',
    ].join(' '));

    expect(guard.status).toBe('low-confidence');
    expect(guard.fallbackRequired).toBe(true);
    expect(guard.lowConfidenceReasons).toEqual(expect.arrayContaining([
      'assistant-mode-contract-violation:private-konling-memory',
      'assistant-mode-contract-violation:hidden-arena-internals',
    ]));
    expect(guard.personalizationAvailability).toMatchObject({
      status: 'limited',
      missingCitationClasses: expect.arrayContaining(['memory']),
      lowConfidenceReasons: expect.arrayContaining(['missing-memory']),
    });
  });

  it('requires evidence citations when evidence is available even if content is cited', () => {
    const pathCitationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:unit:step',
        sourceType: 'content',
        displayTitle: '根轨迹设计',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }],
      evidenceCitations: [{
        id: 'path:path-1',
        sourceType: 'path-execution',
        displayTitle: '当前控制校正学习路径',
        href: null,
        confidence: 'medium',
        evidenceBasis: 'LearningPath',
        owner: 'recommendation',
      }],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      learnerState: { authority: 'server-owned' } as KonlingRuntimeContext['learnerState'],
      planContext: {
        currentPathId: 'path-1',
        activeNodeId: 'node-1',
        nextNodeIds: ['node-2'],
        recentPathIds: ['path-1'],
        completedNodeIds: [],
        status: 'available',
      },
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
      citationContext: pathCitationContext,
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({ pageId: 'student-path-center' }),
      serverModeContext: { 'student-path-center': true },
    });
    const guard = buildKonlingCitationGuard({
      citationContext: pathCitationContext,
      teachingAssistantMode: modeContract,
    }, '建议先根据 citation(content:unit:step, content, 根轨迹设计, high, course-ai-context) 复习闭环极点迁移，再进入下一步。');

    expect(guard).toMatchObject({
      status: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceReasons: expect.arrayContaining([
        'assistant-evidence-citations-missing',
        'answer-intent-evidence-citation-missing:path-advice',
      ]),
    });
  });

  it('records missing learner evidence as limited personalization for diagnosis answers with content citations', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:diagnosis-topic',
        sourceType: 'content',
        displayTitle: '超调量诊断依据',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }, {
        id: 'content:diagnosis-next-step',
        sourceType: 'content',
        displayTitle: '下一步练习建议',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'recommendation',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['learner-state', 'path-execution', 'evidence'],
      lowConfidenceReasons: ['missing-learner-state', 'missing-path-execution', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      graphContext: createCompleteGraphContext(),
      learnerState: null,
      missingContext: ['learner-state'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'diagnosis-explainer',
      runtimeContext: runtime,
      scope: createScope({
        authenticatedUserId: 'teacher-1',
        role: 'teacher',
        pageId: 'student-learning-overview',
        privacyScopes: ['teacher-scoped'],
      }),
      serverModeContext: { 'diagnosis-view': true },
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, [
      '根据 citation(content:diagnosis-topic, content, 超调量诊断依据, high, course-ai-context) 解释超调量诊断。',
      '建议按 citation(content:diagnosis-next-step, content, 下一步练习建议, high, course-ai-context) 先复习阻尼比。',
    ].join(' '));

    expect(modeContract.answerIntent).toBe('personalized-diagnosis');
    expect(modeContract.status).toBe('degraded');
    expect(modeContract.unavailableReasons).toEqual([]);
    expect(guard.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'content:diagnosis-topic', owner: 'answer' }),
      expect.objectContaining({ id: 'content:diagnosis-next-step', owner: 'recommendation' }),
    ]));
    expect(guard).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      personalizationAvailability: {
        status: 'limited',
        missingCitationClasses: expect.arrayContaining(['learner-state', 'path-execution']),
        lowConfidenceReasons: expect.arrayContaining(['missing-learner-state', 'missing-path-execution']),
      },
    });
  });

  it('records missing learner evidence as limited personalization for path advice with content citations', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:path-topic',
        sourceType: 'content',
        displayTitle: '根轨迹路径建议',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }, {
        id: 'content:path-next-step',
        sourceType: 'content',
        displayTitle: '路径下一步说明',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'recommendation',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['learner-state', 'path-execution', 'evidence'],
      lowConfidenceReasons: ['missing-learner-state', 'missing-path-execution', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      graphContext: createCompleteGraphContext(),
      learnerState: null,
      planContext: {
        currentPathId: 'path-1',
        activeNodeId: 'node-1',
        nextNodeIds: ['node-2'],
        recentPathIds: ['path-1'],
        completedNodeIds: [],
        pathOptions: [{
          styleId: 'recommended',
          policyFamily: 'rules-plus-graph-search',
          label: '推荐路径',
          nodeIds: ['node-1', 'node-2'],
          targetDeficits: ['capability:root-locus-design'],
          evidenceBasis: ['capability:root-locus-design'],
          lockedNodeIds: [],
          readinessSummary: [],
          resourceMix: { lesson_step: 1 },
          effort: { estimatedMinutes: 45, relative: 'medium' },
          terminalValidationNodeIds: [],
          limitations: [],
        }],
        status: 'available',
      },
      missingContext: ['learner-state'],
      permittedTools: ['get_page_context', 'get_learner_state', 'get_plan_context', 'search_knowledge_graph', 'recommend_next_action'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'path-advisor',
      runtimeContext: runtime,
      scope: createScope({
        authenticatedUserId: 'teacher-1',
        role: 'teacher',
        pageId: 'student-path-center',
        privacyScopes: ['teacher-scoped'],
      }),
      serverModeContext: { 'student-path-center': true },
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, [
      '根据 citation(content:path-topic, content, 根轨迹路径建议, high, course-ai-context) 说明路径重点。',
      '下一步按 citation(content:path-next-step, content, 路径下一步说明, high, course-ai-context) 练习校正设计。',
    ].join(' '));

    expect(modeContract.answerIntent).toBe('path-advice');
    expect(modeContract.status).toBe('degraded');
    expect(modeContract.unavailableReasons).toEqual([]);
    expect(guard.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'content:path-topic', owner: 'answer' }),
      expect.objectContaining({ id: 'content:path-next-step', owner: 'recommendation' }),
    ]));
    expect(guard).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      personalizationAvailability: {
        status: 'limited',
        missingCitationClasses: expect.arrayContaining(['learner-state', 'path-execution']),
        lowConfidenceReasons: expect.arrayContaining(['missing-learner-state', 'missing-path-execution']),
      },
    });
  });

  it('requires verified content citations for fact explanations', () => {
    const runtime = createRuntimeContext({
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
      citationContext: {
        required: true,
        contentCitations: [],
        evidenceCitations: [{
          id: 'learner-state:student-1',
          sourceType: 'learner-state',
          displayTitle: '学生学习状态',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'AdaptiveLearnerState',
          owner: 'recommendation',
        }],
        missingCitationClasses: ['content'],
        lowConfidenceReasons: ['missing-content'],
        responseProtocol: {
          requiredOwners: ['answer'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'resource-coach',
      runtimeContext: runtime,
      scope: createScope(),
      serverModeContext: {
        'resource-node': true,
        'path-execution-context': true,
        'evidence-citations': true,
      },
    });

    const guard = buildKonlingCitationGuard({
      citationContext: runtime.citationContext,
      teachingAssistantMode: modeContract,
    }, '依据学生学习状态 (learner-state, medium) 解释 PID 参数整定。');

    expect(modeContract.answerIntent).toBe('fact-explanation');
    expect(guard.lowConfidenceReasons).toEqual(expect.arrayContaining([
      'answer-intent-content-citation-missing:fact-explanation',
    ]));
    expect(guard.missingCitationClasses).toContain('content');
    expect(guard.fallbackRequired).toBe(true);
  });

  it('treats verified content citations as fact-explanation teaching knowledge support', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:unit:step',
        sourceType: 'content',
        displayTitle: 'PID 参数整定',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'generic-chat',
      runtimeContext: runtime,
      scope: createScope({ resourceId: null, pathNodeId: null }),
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, '根据 citation(content:unit:step, content, PID 参数整定, high, course-ai-context) 解释 PID 参数整定。');

    expect(modeContract.answerIntent).toBe('fact-explanation');
    expect(modeContract.groundingContext.knowledgeNodeRefs).toEqual([]);
    expect(modeContract.groundingContext.resourceRefs).toEqual([]);
    expect(modeContract.groundingContext.citationRefs).toContain('content:1');
    expect(guard.lowConfidenceReasons).not.toContain('missing-grounding:knowledge-or-resource');
    expect(guard.status).toBe('verified');
  });

  it('requires content citations when content is available even if evidence is cited', () => {
    const guard = buildKonlingCitationGuard({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:unit:step',
          sourceType: 'content',
          displayTitle: '根轨迹设计',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '当前控制校正学习路径',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    }, '建议依据 citation(path:path-1, path-execution, 当前控制校正学习路径, medium, LearningPath) 的节点进度调整下一步，但不引用课程内容。');

    expect(guard).toMatchObject({
      status: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceReasons: ['assistant-content-citations-missing'],
    });
  });

  it('does not treat ordinary citation titles or evidence basis text as verified citations', () => {
    const guard = buildKonlingCitationGuard({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:unit:step',
          sourceType: 'content',
          displayTitle: '根轨迹设计',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [{
          id: 'path:path-1',
          sourceType: 'path-execution',
          displayTitle: '当前控制校正学习路径',
          href: null,
          confidence: 'medium',
          evidenceBasis: 'LearningPath',
          owner: 'recommendation',
        }],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    }, '根轨迹设计需要结合当前控制校正学习路径判断，LearningPath 和 course-ai-context 都只是普通说明。');

    expect(guard).toMatchObject({
      status: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceReasons: ['assistant-citations-missing'],
    });
  });

  it('requires href when a citation exposes a student-visible link', () => {
    const citationContext = {
      required: true,
      contentCitations: [{
        id: 'content:unit:step',
        sourceType: 'content',
        displayTitle: '根轨迹设计',
        href: '/interactive-learning/courses/unit-3-3-root-locus-rules',
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    } satisfies KonlingCitationContext;

    const missingHref = buildKonlingCitationGuard({ citationContext }, '引用 content / 根轨迹设计 / high / course-ai-context。');
    const withHref = buildKonlingCitationGuard(
      { citationContext },
      '引用 content / 根轨迹设计 / high / course-ai-context / /interactive-learning/courses/unit-3-3-root-locus-rules。',
    );

    expect(missingHref).toMatchObject({
      status: 'low-confidence',
      lowConfidenceReasons: ['assistant-citations-missing'],
    });
    expect(withHref).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
    });
  });

  it('builds Konling content citations through verified konling-answer Source Packs', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'student-path-center',
      trustedContentContext: true,
    });

    const sourcePackCitations = runtime.citationContext?.contentCitations.filter((citation) =>
      citation.evidenceBasis.startsWith('source-pack:konling-answer:')
    ) ?? [];

    expect(sourcePackCitations.length).toBeGreaterThan(0);
    expect(sourcePackCitations[0]).toMatchObject({
      sourceType: 'content',
      href: expect.stringContaining('/course-runtime/resources/textbooks/dorf-modern-control-systems/'),
      confidence: 'high',
      owner: 'answer',
      citationChip: expect.objectContaining({
        sourceType: 'course-content',
        authorityLevel: 'canonical',
        privacyVisibility: 'public',
      }),
    });
    expect(runtime.citationContext?.sourcePacks).toEqual([
      expect.objectContaining({
        profile: 'konling-answer',
        citationTargetIds: expect.arrayContaining(['textbook-citation:ch08-example-0801']),
        retrievalChunkIds: expect.arrayContaining(['textbook-search:ch08-example-0801']),
      }),
    ]);
    expect(runtime.citationContext?.missingCitationClasses).not.toContain('content');
  });

  it('uses the current user question in konling-answer Source Pack retrieval', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'student-path-center',
      currentUserQuery: '我现在想问 Nyquist 判稳，而不是继续讨论 Bode 图。',
      trustedContentContext: true,
    });

    expect(runtime.citationContext?.sourcePacks).toEqual([
      expect.objectContaining({
        profile: 'konling-answer',
        queryText: expect.stringContaining('Nyquist 判稳'),
      }),
    ]);
  });

  it('uses path-advisor SAR candidate refs to guide verified Source Pack retrieval', async () => {
    mocks.loadAllTextbookRuntimeSearchDocuments.mockResolvedValue([
      {
        id: 'generic-context',
        kind: 'chunk',
        title: '泛化学习建议',
        href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/generic.md#chunk-001',
        text: '路径建议需要先确认学习目标。',
        contentHash: 'sha-generic',
        resourceProjection: {
          resourceId: 'resource:generic',
          segmentRef: 'generic-context',
          citationTargetRef: 'generic-context',
          knowledgeNodeRefs: ['generic-node'],
          capabilityTargetRefs: ['generic-capability'],
        },
        citationAddress: {
          kind: 'text',
          sourceRefId: 'generic-context',
          href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/generic.md#chunk-001',
          locator: 'chunk-001',
          contentHash: 'sha-generic',
        },
        metadata: {
          bookId: 'dorf-modern-control-systems',
          sectionId: 'generic',
        },
      },
      {
        id: 'sar-path-resource',
        kind: 'chunk',
        title: 'SAR 路径资源',
        href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/sar-path.md#chunk-001',
        text: '这个资源用于解释当前路径节点。',
        contentHash: 'sha-sar-path',
        resourceProjection: {
          resourceId: 'resource:path-sar',
          segmentRef: 'sar-path-resource',
          citationTargetRef: 'sar-path-resource',
          knowledgeNodeRefs: ['path-node'],
          capabilityTargetRefs: ['path-capability'],
        },
        citationAddress: {
          kind: 'text',
          sourceRefId: 'sar-path-resource',
          href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/sar-path.md#chunk-001',
          locator: 'chunk-001',
          contentHash: 'sha-sar-path',
        },
        metadata: {
          bookId: 'dorf-modern-control-systems',
          sectionId: 'sar-path',
        },
      },
    ]);

    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'student-path-center',
      resourceId: 'resource:path-sar',
      pathNodeId: 'path-node-1',
      teachingAssistantModeId: 'path-advisor',
      currentUserQuery: '我需要一个路径建议。',
      trustedContentContext: true,
    });

    expect(runtime.knowledgeCapabilityContext?.sarAssociatedGrounding).toMatchObject({
      useCase: 'path-planning',
      candidateRefs: expect.objectContaining({
        resourceNodeIds: expect.arrayContaining(['resource:path-sar']),
      }),
    });
    expect(runtime.citationContext?.sourcePacks).toEqual([
      expect.objectContaining({
        profile: 'konling-answer',
        retrievalChunkIds: expect.arrayContaining(['textbook-search:sar-path-resource']),
        citationTargetIds: expect.arrayContaining(['textbook-citation:sar-path-resource']),
      }),
    ]);
    expect(runtime.citationContext?.contentCitations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'content:textbook-citation:sar-path-resource',
        evidenceBasis: expect.stringMatching(/^source-pack:konling-answer:/),
      }),
    ]));
  });

  it('builds diagnostic SAR trace metadata for diagnosis explainer scope', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'student-learning-overview',
      pathNodeId: 'diagnosis-node-1',
      teachingAssistantModeId: 'diagnosis-explainer',
      currentUserQuery: '为什么当前诊断认为我需要补根轨迹？',
      trustedContentContext: true,
    });

    expect(runtime.knowledgeCapabilityContext?.answerIntent).toBe('personalized-diagnosis');
    expect(runtime.knowledgeCapabilityContext?.sarAssociatedGrounding).toMatchObject({
      useCase: 'diagnostic-trace',
      traceSummary: expect.objectContaining({
        hopCount: expect.any(Number),
        safeEventSummaries: expect.arrayContaining([
          expect.stringContaining('personalized-diagnosis'),
        ]),
      }),
    });
  });

  it('uses resource-coach server mode context for pre-citation SAR seeding', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'resource-node-launch',
      resourceId: 'media-resource-1',
      teachingAssistantModeId: 'resource-coach',
      teachingAssistantServerModeContext: {
        'resource-node': true,
        'media-resource': true,
      },
      currentUserQuery: '这个视频资源该怎么看？',
      trustedContentContext: true,
    });

    expect(runtime.knowledgeCapabilityContext?.answerIntent).toBe('media-guidance');
    expect(runtime.knowledgeCapabilityContext?.sarAssociatedGrounding).toMatchObject({
      useCase: 'source-pack-seeding',
      candidateRefs: expect.objectContaining({
        resourceNodeIds: expect.arrayContaining(['media-resource-1']),
      }),
    });
  });

  it('keeps Source Pack retrieval available when pre-citation SAR has no scope seed refs', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'student-path-center',
      teachingAssistantModeId: 'path-advisor',
      currentUserQuery: '我需要路径建议。',
      trustedContentContext: true,
    });

    expect(runtime.citationContext?.sourcePacks).toEqual([
      expect.objectContaining({
        profile: 'konling-answer',
        retrievalChunkIds: expect.arrayContaining(['textbook-search:ch08-example-0801']),
      }),
    ]);
    expect(runtime.knowledgeCapabilityContext?.sarAssociatedGrounding).toMatchObject({
      useCase: 'path-planning',
      candidateRefs: expect.objectContaining({
        citationTargetIds: expect.arrayContaining(['content:1']),
      }),
    });
    expect(runtime.citationContext?.missingCitationClasses).not.toContain('content');
  });

  it('serializes SAR assistant metadata without raw candidate refs', () => {
    const metadata = buildKonlingSarAssociatedGroundingMetadataPayload({
      source: 'sar-association-expansion',
      useCase: 'path-planning',
      seedRefs: ['knowledge-node:root-locus'],
      associatedEventRefs: ['sar:event:private-student-attempt'],
      associatedEntityRefs: ['sar:entity:student:private-student'],
      candidateRefs: {
        eventIds: ['sar:event:private-student-attempt'],
        entityIds: ['sar:entity:student:private-student'],
        citationTargetIds: ['citation-target:unverified'],
        retrievalChunkIds: ['retrieval-chunk:unverified'],
        resourceNodeIds: ['resource:reviewed'],
        planningUnitIds: ['planning-unit:hidden'],
      },
      sourcePackSeedRefs: ['retrieval-chunk:unverified'],
      traceSummary: {
        hopCount: 1,
        selectedRefCount: 2,
        rejectedRefCount: 4,
        safeEventSummaries: ['已脱敏的诊断摘要'],
        limitationCodes: ['source-pack-ranking-required'],
      },
      limitations: ['source-pack-ranking-required'],
    });

    expect(metadata).toEqual({
      source: 'sar-association-expansion',
      useCase: 'path-planning',
      seedRefs: ['knowledge-node:root-locus'],
      traceSummary: {
        hopCount: 1,
        selectedRefCount: 2,
        rejectedRefCount: 4,
        safeEventSummaries: ['已脱敏的诊断摘要'],
        limitationCodes: ['source-pack-ranking-required'],
      },
      limitations: ['source-pack-ranking-required'],
    });
    expect(JSON.stringify(metadata)).not.toContain('candidateRefs');
    expect(JSON.stringify(metadata)).not.toContain('retrieval-chunk:unverified');
    expect(JSON.stringify(metadata)).not.toContain('citation-target:unverified');
    expect(buildKonlingSarAssociatedGroundingMetadataPayload(null)).toBeNull();
  });

  it('redacts SAR trace identifiers from student page-context tool output', async () => {
    const runtime = createRuntimeContext({
      permittedTools: ['get_page_context'],
      knowledgeCapabilityContext: {
        source: 'server-owned',
        answerIntent: 'path-advice',
        knowledgeNodeRefs: [],
        capabilityTargetRefs: [],
        resourceRefs: ['resource:student-path'],
        pathNodeRefs: ['path-node:student-1:private'],
        citationRefs: [],
        sarAssociatedGrounding: {
          source: 'sar-association-expansion',
          useCase: 'path-planning',
          seedRefs: ['sar:entity:student:student-1'],
          associatedEventRefs: ['sar:event:diagnosis-summary:student-1:class-1'],
          associatedEntityRefs: ['sar:entity:student:student-1'],
          candidateRefs: {
            eventIds: ['sar:event:diagnosis-summary:student-1:class-1'],
            entityIds: ['sar:entity:student:student-1'],
            citationTargetIds: ['textbook-citation:safe'],
            retrievalChunkIds: ['textbook-search:safe'],
            resourceNodeIds: ['resource:student-path'],
            planningUnitIds: [],
          },
          sourcePackSeedRefs: ['sar:event:diagnosis-summary:student-1:class-1', 'textbook-search:safe'],
          traceSummary: {
            hopCount: 1,
            selectedRefCount: 3,
            rejectedRefCount: 1,
            safeEventSummaries: ['已脱敏的路径诊断摘要'],
            limitationCodes: ['source-pack-ranking-required', 'privacy-scope-withheld:teacher-scoped'],
          },
          limitations: ['source-pack-ranking-required', 'privacy-scope-withheld:teacher-scoped'],
        },
        scope: createScope({ role: 'student', pageId: 'student-path-center' }),
        missingContext: [],
      },
    });
    const toolRuntime = buildKonlingToolRuntime({
      db: {},
      scope: createScope({ role: 'student', pageId: 'student-path-center' }),
      context: runtime,
    });

    const pageContext = await toolRuntime.getPageContext() as {
      knowledgeCapabilityContext: NonNullable<KonlingRuntimeContext['knowledgeCapabilityContext']>;
    };
    const sar = pageContext.knowledgeCapabilityContext.sarAssociatedGrounding;
    expect(JSON.stringify(sar)).not.toContain('student-1');
    expect(JSON.stringify(sar)).not.toContain('class-1');
    expect(sar?.candidateRefs.retrievalChunkIds).toEqual(['retrieval-chunk:redacted-1']);
    expect(sar?.traceSummary.safeEventSummaries).toEqual(['已脱敏的路径诊断摘要']);
    expect(sar?.traceSummary.limitationCodes).toEqual(['source-pack-ranking-required']);
  });

  it('keeps SAR limitation detail for teacher page-context tool output', async () => {
    const runtime = createRuntimeContext({
      permittedTools: ['get_page_context'],
      knowledgeCapabilityContext: {
        source: 'server-owned',
        answerIntent: 'personalized-diagnosis',
        knowledgeNodeRefs: [],
        capabilityTargetRefs: [],
        resourceRefs: ['resource:teacher-report'],
        pathNodeRefs: [],
        citationRefs: [],
        sarAssociatedGrounding: {
          source: 'sar-association-expansion',
          useCase: 'diagnostic-trace',
          seedRefs: ['sar:entity:class:class-1'],
          associatedEventRefs: ['sar:event:diagnosis-summary:class-1'],
          associatedEntityRefs: ['sar:entity:class:class-1'],
          candidateRefs: {
            eventIds: ['sar:event:diagnosis-summary:class-1'],
            entityIds: ['sar:entity:class:class-1'],
            citationTargetIds: [],
            retrievalChunkIds: [],
            resourceNodeIds: ['resource:teacher-report'],
            planningUnitIds: [],
          },
          sourcePackSeedRefs: ['sar:event:diagnosis-summary:class-1'],
          traceSummary: {
            hopCount: 0,
            selectedRefCount: 2,
            rejectedRefCount: 0,
            safeEventSummaries: ['班级诊断摘要'],
            limitationCodes: ['no-expansion-hop-selected', 'event-budget:12'],
          },
          limitations: ['no-expansion-hop-selected', 'event-budget:12'],
        },
        scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', targetUserId: 'teacher-1' }),
        missingContext: [],
      },
    });
    const toolRuntime = buildKonlingToolRuntime({
      db: {},
      scope: createScope({ role: 'teacher', authenticatedUserId: 'teacher-1', targetUserId: 'teacher-1' }),
      context: runtime,
    });

    const pageContext = await toolRuntime.getPageContext() as {
      knowledgeCapabilityContext: NonNullable<KonlingRuntimeContext['knowledgeCapabilityContext']>;
    };
    const sar = pageContext.knowledgeCapabilityContext.sarAssociatedGrounding;
    expect(sar?.candidateRefs.resourceNodeIds).toEqual(['resource:teacher-report']);
    expect(sar?.traceSummary.limitationCodes).toEqual(['no-expansion-hop-selected', 'event-budget:12']);
  });

  it('keeps Source Pack content citations when learner personalization evidence is missing', async () => {
    mocks.readAdaptiveLearnerState.mockResolvedValue(null);
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      authenticatedUserName: '张三',
      role: 'STUDENT',
      courseId: 'control-correction',
      pageId: 'step-03',
      trustedContentContext: true,
    });

    expect(runtime.learnerState).toBeNull();
    expect(runtime.citationContext?.contentCitations.some((citation) =>
      citation.evidenceBasis.startsWith('source-pack:konling-answer:')
    )).toBe(true);
    expect(runtime.citationContext?.missingCitationClasses).not.toContain('content');
    expect(runtime.citationContext?.missingCitationClasses).toContain('learner-state');
  });

  it('verifies Konling answers against textbook, figure, video timestamp, and slides citations', () => {
    const citationContext = {
      required: true,
      contentCitations: [
        {
          id: 'content:textbook-section:dorf-modern-control-systems:ch10-sec01',
          sourceType: 'content',
          displayTitle: 'Modern Control Systems 第 10 章 10.1 节',
          href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#chunk-001',
          confidence: 'high',
          evidenceBasis: 'textbook-section',
          owner: 'answer',
        },
        {
          id: 'content:textbook-figure:fig-10-03',
          sourceType: 'content',
          displayTitle: '图 10-3 根轨迹校正示意',
          href: '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#fig-10-03',
          confidence: 'high',
          evidenceBasis: 'textbook-figure-description',
          owner: 'answer',
        },
        {
          id: 'content:runtime-video:unit-4-1:180',
          sourceType: 'content',
          displayTitle: '超前校正视频 03:00',
          href: '/interactive-learning/courses/unit-4-1/student/demo?media=lead-correction-video&t=180',
          confidence: 'high',
          evidenceBasis: 'video-transcript-timestamp',
          owner: 'answer',
        },
        {
          id: 'content:slides:unit-4-1:p12',
          sourceType: 'content',
          displayTitle: '控制校正课件第 12 页',
          href: '/course-runtime/lessons/unit-4-1/slides.pdf#page=12',
          confidence: 'high',
          evidenceBasis: 'slides-page-anchor',
          owner: 'answer',
        },
      ],
      evidenceCitations: [],
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 0 },
        fallbackWhenMissing: 'low-confidence',
      },
    } satisfies KonlingCitationContext;

    const verified = buildKonlingCitationGuard({ citationContext }, [
      '引用 content / Modern Control Systems 第 10 章 10.1 节 / high / textbook-section / /course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#chunk-001。',
      '引用 content / 图 10-3 根轨迹校正示意 / high / textbook-figure-description / /course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch10-sec01.md#fig-10-03。',
      '引用 content / 超前校正视频 03:00 / high / video-transcript-timestamp / /interactive-learning/courses/unit-4-1/student/demo?media=lead-correction-video&t=180。',
      '引用 content / 控制校正课件第 12 页 / high / slides-page-anchor / /course-runtime/lessons/unit-4-1/slides.pdf#page=12。',
    ].join('\n'));
    const videoOnlyCitationContext = {
      ...citationContext,
      contentCitations: [citationContext.contentCitations[2]],
    } satisfies KonlingCitationContext;
    const missingVideoHref = buildKonlingCitationGuard({ citationContext: videoOnlyCitationContext }, [
      '引用 content / 超前校正视频 03:00 / high / video-transcript-timestamp。',
    ].join('\n'));

    expect(verified).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
    });
    expect(missingVideoHref).toMatchObject({
      status: 'low-confidence',
      fallbackRequired: true,
      lowConfidenceReasons: ['assistant-citations-missing'],
    });
  });

  it('records streaming final-text uncertainty as metadata without downgrading verified content citations', () => {
    const guard = buildKonlingStreamingCitationGuard({
      citationContext: {
        required: true,
        contentCitations: [{
          id: 'content:unit:step',
          sourceType: 'content',
          displayTitle: '根轨迹设计',
          href: null,
          confidence: 'high',
          evidenceBasis: 'course-ai-context',
          owner: 'answer',
        }],
        evidenceCitations: [],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
        responseProtocol: {
          requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
          minimum: { content: 1, evidenceWhenAvailable: 1 },
          fallbackWhenMissing: 'low-confidence',
        },
      },
    });

    expect(guard).toMatchObject({
      status: 'verified',
      fallbackRequired: false,
      lowConfidenceReasons: [],
      diagnosticReasons: ['assistant-citations-unverified-stream'],
    });
  });

  it('treats missing learner path context as personalization limitation for fact explanations', () => {
    const citationContext: KonlingCitationContext = {
      required: true,
      contentCitations: [{
        id: 'content:unit:step',
        sourceType: 'content',
        displayTitle: 'PID 参数整定',
        href: null,
        confidence: 'high',
        evidenceBasis: 'course-ai-context',
        owner: 'answer',
      }],
      evidenceCitations: [],
      missingCitationClasses: ['learner-state', 'path-execution', 'evidence'],
      lowConfidenceReasons: ['missing-learner-state', 'missing-path-execution', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    };
    const runtime = createRuntimeContext({
      citationContext,
      permittedTools: ['get_page_context', 'search_knowledge_graph'],
    });
    const modeContract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'generic-chat',
      runtimeContext: runtime,
      scope: createScope({ resourceId: null, pathNodeId: null }),
    });

    const guard = buildKonlingCitationGuard({
      citationContext,
      teachingAssistantMode: modeContract,
    }, '根据 citation(content:unit:step, content, PID 参数整定, high, course-ai-context) 解释 PID 参数整定。');

    expect(modeContract.answerIntent).toBe('fact-explanation');
    expect(guard.status).toBe('verified');
    expect(guard.fallbackRequired).toBe(false);
    expect(guard.missingCitationClasses).toEqual([]);
    expect(guard.personalizationAvailability).toEqual({
      status: 'limited',
      missingCitationClasses: ['learner-state', 'path-execution', 'evidence'],
      lowConfidenceReasons: ['missing-learner-state', 'missing-path-execution', 'missing-evidence'],
    });
  });

  it('retrieves scoped memory and redacts raw dialogue or answer payload fields', async () => {
    const db = {
      konlingMemory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mem-1',
            memoryType: 'episodic',
            privacyScope: 'student-visible',
            summary: ' repeated confusion on damping ratio ',
            evidenceRefs: [{ kind: 'konling-session', ref: 's1', rawDialogue: 'secret' }],
            createdAt: '2026-05-28T00:00:00Z',
          },
        ]),
      },
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const scope = createScope();
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      scopedSimulationState: {
        isRunning: true,
        time: 12,
        position: { x: 1, z: 2 },
        heading: 8,
        rudder: 1,
        speed: 4,
        targetHeading: 10,
        pidGains: { kp: 2.4, ki: 0.1, kd: 0.5 },
        nomotoParams: { K: 0.08, T: 55 },
        seaState: { level: 2, waveHeight: 0.5, windSpeed: 6 },
        metrics: { avgError: 3, maxRudderRate: 0.2, currentError: 1 },
      },
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '约束优化',
          pageType: 'practice',
          stepId: 'step-03',
          topic: '参数优化',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['search_learning_memory'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const memory = await runtime.searchLearningMemory({ query: 'damping' }) as Array<Record<string, unknown>>;

    expect(db.konlingMemory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        privacyScope: { in: ['student-visible'] },
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(JSON.stringify(memory)).not.toContain('rawDialogue');
    expect(memory[0].summary).toBe('repeated confusion on damping ratio');

    const simulationStatus = await runtime.getSimulationStatus() as { pidGains: { Kp: number }; metrics: { avgError: string } };
    expect(simulationStatus.pidGains.Kp).toBe(2.4);
    expect(simulationStatus.metrics.avgError).toContain('米');
  });

  it('does not expose global simulation state through the scoped Konling tool', async () => {
    updateSimulationState({
      isRunning: true,
      pidGains: { kp: 9, ki: 9, kd: 9 },
    });
    const scope = createScope();
    const runtime = buildKonlingToolRuntime({
      db: {},
      scope,
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '约束优化',
          pageType: 'practice',
          stepId: 'step-03',
          topic: '参数优化',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['get_simulation_status'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const status = await runtime.getSimulationStatus() as { unavailable: boolean; pidGains: { Kp: number | null } };
    expect(status.unavailable).toBe(true);
    expect(status.pidGains.Kp).toBeNull();
  });

  it('registers persisted simulation tool schemas, tiers, and idempotency boundaries', () => {
    expect(KONLING_TOOL_REGISTRY.get_simulation_context).toMatchObject({
      permissionTier: 'read',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.run_virtual_simulation).toMatchObject({
      permissionTier: 'run',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.analyze_simulation_trace).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.compare_simulation_runs).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.propose_controller_patch).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
      idempotencyPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.apply_controller_patch).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'required',
      idempotencyPolicy: 'reuse',
    });

    const tools = buildScopedKonlingAiTools({} as ReturnType<typeof buildKonlingToolRuntime>);
    expect(tools).toHaveProperty('get_simulation_context');
    expect(tools).toHaveProperty('run_virtual_simulation');
    expect(tools).toHaveProperty('analyze_simulation_trace');
    expect(tools).toHaveProperty('compare_simulation_runs');
    expect(tools).toHaveProperty('propose_controller_patch');
    expect(tools).toHaveProperty('apply_controller_patch');
    expect((tools.run_virtual_simulation.inputSchema as any).shape).toHaveProperty('idempotencyKey');
    expect((tools.apply_controller_patch.inputSchema as any).shape).toHaveProperty('idempotencyKey');
  });

  it('resolves simulation context from persisted runs with student owner isolation and no global state dependency', async () => {
    updateSimulationState({
      isRunning: true,
      pidGains: { kp: 9, ki: 9, kd: 9 },
    });
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          resourceId: 'resource-1',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          controllerSnapshotRef: 'controller:pid:hash-1',
          status: 'completed',
          summary: {
            metrics: { settlingTime: 4.2 },
            controller: { kp: 1.6 },
            lowEvidence: false,
          },
          replayToken: 'replay-token-1',
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          sceneSpecVersion: 'scene-spec-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          startedAt: new Date('2026-05-28T00:00:01Z'),
          completedAt: new Date('2026-05-28T00:00:08Z'),
          traces: [
            {
              id: 'trace-1',
              checksum: 'sha256:trace-1',
              summaryMetrics: { settlingTime: 4.2 },
              sampleCount: 160,
              sampleCadence: 0.05,
              sampleStorageUri: 's3://traces/run-1.json',
              createdAt: new Date('2026-05-28T00:00:08Z'),
            },
          ],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'run-1' }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'run-1',
        ownerUserId: 'student-1',
        OR: expect.arrayContaining([
          expect.objectContaining({ courseId: 'simulation', resourceId: 'resource-1' }),
          expect.objectContaining({ sourceDomain: 'arena_virtual_preview', courseId: null, resourceId: null }),
        ]),
      }),
    }));
    expect(context).toMatchObject({
      simulationRunId: 'run-1',
      accessScope: 'owner',
      provenance: {
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
      traceRef: {
        traceId: 'trace-1',
        sampleCount: 160,
      },
    });
    expect(JSON.stringify(context)).not.toContain('"kp":9');
  });

  it('resolves legacy Arena preview runs without run-level course scope through task spec launch context', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const arenaRun = {
      id: 'arena-run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: null,
      resourceId: null,
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
        launchContext: {
          classId: 'class-1',
          resourceId: 'resource-1',
        },
      },
      status: 'completed',
      summary: { overshoot: 0.18, settlingTime: 4.2 },
      replayToken: 'arena-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockImplementation(async (args) => (
          args.where?.OR ? arenaRun : null
        )),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'arena-run-1' }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'arena-run-1',
        ownerUserId: 'student-1',
        OR: expect.arrayContaining([
          expect.objectContaining({ courseId: 'simulation', resourceId: 'resource-1' }),
          expect.objectContaining({ sourceDomain: 'arena_virtual_preview', courseId: null, resourceId: null }),
        ]),
      }),
    }));
    expect(context).toMatchObject({
      simulationRunId: 'arena-run-1',
      provenance: {
        runKind: 'arena_preview',
        sourceDomain: 'arena_virtual_preview',
        resourceId: null,
      },
      task: {
        launchContext: expect.objectContaining({
          resourceId: 'resource-1',
        }),
      },
    });
  });

  it('rejects legacy Arena preview fallback when task spec launch resource differs from runtime scope', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'arena-run-foreign',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: null,
          resourceId: null,
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-foreign',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              resourceId: 'resource-foreign',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'arena-run-foreign' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('rejects legacy Arena preview fallback when runtime scope lacks the declared launch resource', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: null });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'arena-run-resource-only',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: null,
          resourceId: null,
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-resource-only',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              resourceId: 'resource-1',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'arena-run-resource-only' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('rejects simulation runs when run-level and task-spec launch resources conflict', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: 'resource-1' });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-conflicting-resource',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          resourceId: 'resource-1',
          runKind: 'arena_preview',
          sourceDomain: 'arena_virtual_preview',
          sourceRefId: 'arena-preview-conflicting-resource',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            launchContext: {
              courseId: 'simulation',
              resourceId: 'resource-foreign',
            },
          },
          status: 'completed',
          summary: {},
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ simulationRunId: 'run-conflicting-resource' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationRun。',
    });
  });

  it('resolves simulation context directly from a task spec before any run exists', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-1',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: { source: 'konling_plan' },
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              courseId: 'simulation',
              classId: 'class-1',
              resourceId: 'resource-1',
              pageId: 'pid-default',
            },
            specHash: 'sha256:task-spec-1',
          },
          launchContext: {
            courseId: 'simulation',
            classId: 'class-1',
            resourceId: 'resource-1',
            pageId: 'pid-default',
          },
        }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ taskSpecId: 'task-spec-1' }) as Record<string, any>;

    expect(db.simulationTaskSpec.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-spec-1' },
    });
    expect(db.simulationRun.findFirst).not.toHaveBeenCalled();
    expect(context).toMatchObject({
      taskSpecId: 'task-spec-1',
      simulationRunId: null,
      accessScope: 'owner',
      task: {
        taskSpecHash: 'sha256:task-spec-1',
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      controllerSnapshotRef: null,
      status: 'task_spec_ready',
      replay: {
        replayToken: null,
        replayState: 'not_run',
      },
      evidenceStatus: {
        lowEvidence: true,
        traceAvailable: false,
        replayAvailable: false,
      },
      traceRef: null,
      rawTraceIncluded: false,
    });
  });

  it('rejects task spec context when declared resource scope is absent from the runtime scope', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default', resourceId: null });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-foreign-resource',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              courseId: 'simulation',
              resourceId: 'resource-foreign',
              pageId: 'pid-default',
            },
            specHash: 'sha256:task-spec-foreign-resource',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-foreign-resource' })).rejects.toMatchObject({
      status: 403,
      message: '无权访问该 SimulationTaskSpec。',
    });
  });

  it('rejects publication-only task specs until publication scope is part of the Konling runtime scope', async () => {
    const scope = createScope({
      courseId: 'simulation',
      classId: null,
      resourceId: null,
      pageId: 'pid-default',
    });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-publication-only',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              publicationId: 'publication-1',
            },
            specHash: 'sha256:task-spec-publication-only',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-publication-only' })).rejects.toMatchObject({
      status: 403,
      message: 'SimulationTaskSpec 缺少可验证的 Konling 仿真作用域。',
    });
  });

  it('rejects agent-session-only task specs because agentSessionId is not a runtime scope anchor', async () => {
    const scope = createScope({
      courseId: 'simulation',
      classId: null,
      resourceId: null,
      pageId: 'pid-default',
    });
    const db = {
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'task-spec-agent-session-only',
          payload: {
            schemaVersion: 'simulation-task-spec-v1',
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            objectives: ['settling_time'],
            constraints: ['overshoot'],
            disturbancePolicy: {},
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
            allowedControllers: ['pid'],
            launchContext: {
              agentSessionId: 'agent-session-1',
            },
            specHash: 'sha256:task-spec-agent-session-only',
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    await expect(runtime.getSimulationContext({ taskSpecId: 'task-spec-agent-session-only' })).rejects.toMatchObject({
      status: 403,
      message: 'SimulationTaskSpec 缺少可验证的 Konling 仿真作用域。',
    });
  });

  it('allows teacher class-scoped simulation reads without student impersonation or raw trace exposure', async () => {
    const scope = createScope({
      authenticatedUserId: 'teacher-1',
      targetUserId: 'teacher-1',
      role: 'teacher',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: null,
      privacyScopes: ['student-visible', 'teacher-scoped'],
    });
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          status: 'completed',
          summary: { metrics: { settlingTime: 4.2 } },
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [
            {
              id: 'trace-1',
              checksum: 'sha256:trace-1',
              summaryMetrics: { settlingTime: 4.2 },
              sampleCount: 160,
              sampleCadence: 0.05,
              sampleStorageUri: 's3://traces/run-1.json',
              createdAt: new Date('2026-05-28T00:00:08Z'),
            },
          ],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const context = await runtime.getSimulationContext({ simulationRunId: 'run-1', includeTrace: true }) as Record<string, any>;

    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'run-1',
        classId: 'class-1',
      }),
    }));
    expect(JSON.stringify(db.simulationRun.findFirst.mock.calls)).not.toContain('"ownerUserId":"teacher-1"');
    expect(context).toMatchObject({
      accessScope: 'class-summary',
      rawTraceIncluded: false,
      traceRef: {
        traceId: 'trace-1',
      },
    });
    expect(context.traceRef.sampleStorageUri).toBeNull();
  });

  it('analyzes traces, compares runs, and proposes patches from canonical simulation references', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const runRow = {
      id: 'run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { metrics: { overshoot: 0.28, settlingTime: 6.5 }, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
        findMany: vi.fn().mockResolvedValue([
          runRow,
          {
            ...runRow,
            id: 'run-2',
            sourceRefId: 'arena-preview-2',
            summary: { metrics: { overshoot: 0.12, settlingTime: 4.2 }, lowEvidence: false },
          },
        ]),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      context: createRuntimeContext(),
    });

    const analysis = await runtime.analyzeSimulationTrace({ simulationRunId: 'run-1' }) as Record<string, any>;
    expect(analysis).toMatchObject({
      simulationRunId: 'run-1',
      traceId: 'trace-1',
      analyzer: {
        summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
        sampleCount: 160,
      },
      rawTraceIncluded: false,
    });

    const comparison = await runtime.compareSimulationRuns({ simulationRunIds: ['run-1', 'run-2'] }) as Record<string, any>;
    expect(comparison).toMatchObject({
      comparedRunIds: ['run-1', 'run-2'],
      runs: [
        {
          simulationRunId: 'run-1',
          provenance: {
            runKind: 'arena_preview',
            sourceDomain: 'arena_virtual_preview',
            evaluationVisibility: 'preview',
            officialEligible: false,
          },
        },
        { simulationRunId: 'run-2' },
      ],
      rawTraceIncluded: false,
    });

    const proposal = await runtime.proposeControllerPatch({
      simulationRunId: 'run-1',
      objective: '降低超调并缩短调节时间',
      targetMetrics: { 'controller.ki': 0.05 },
      constraints: ['rudder_rate'],
    }) as Record<string, any>;

    expect(proposal).toMatchObject({
      simulationRunId: 'run-1',
      candidatePatch: expect.objectContaining({ kp: 0.9, ki: 0.05 }),
      affectedControllerFields: expect.arrayContaining(['kp', 'ki']),
      mutatesControllerDraft: false,
      evidenceReferences: expect.arrayContaining([
        { kind: 'SimulationRun', id: 'run-1' },
        { kind: 'SimulationTrace', id: 'trace-1' },
      ]),
    });
  });

  it('rejects duplicate simulation run ids before comparing runs', async () => {
    const db = {
      simulationRun: {
        findMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    await expect(runtime.compareSimulationRuns({
      simulationRunIds: ['run-1', 'run-1'],
    })).rejects.toMatchObject({ status: 400 });
    expect(db.simulationRun.findMany).not.toHaveBeenCalled();
  });

  it('rejects explicit trace ids that do not belong to the simulation run', async () => {
    const runRow = {
      id: 'run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { metrics: { overshoot: 0.28, settlingTime: 6.5 }, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
      },
      simulationTrace: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    await expect(runtime.analyzeSimulationTrace({
      simulationRunId: 'run-1',
      traceId: 'missing-trace',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.simulationTrace.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'missing-trace',
        runId: 'run-1',
      },
    });
  });

  it('proposes controller patches from top-level Arena preview summary metrics', async () => {
    const runRow = {
      id: 'arena-preview-run-1',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      pageId: 'pid-default',
      resourceId: 'resource-1',
      runKind: 'arena_preview',
      sourceDomain: 'arena_virtual_preview',
      sourceRefId: 'arena-preview-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      status: 'completed',
      summary: { overshoot: 0.28, settlingTime: 6.5, lowEvidence: false },
      replayToken: 'preview-replay-token',
      protocolVersion: '1.0',
      runtimeVersion: 'simulation-runtime-v1',
      modelVersion: 'nomoto-v1',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-1',
          checksum: 'sha256:trace-1',
          summaryMetrics: { overshoot: 0.28, settlingTime: 6.5 },
          sampleCount: 160,
          sampleCadence: 0.05,
          sampleStorageUri: 's3://traces/run-1.json',
          createdAt: new Date('2026-05-28T00:00:08Z'),
        },
      ],
    };
    const db = {
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(runRow),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ courseId: 'simulation', pageId: 'pid-default' }),
      context: createRuntimeContext(),
    });

    const proposal = await runtime.proposeControllerPatch({
      simulationRunId: 'arena-preview-run-1',
      objective: '降低超调并缩短调节时间',
    }) as Record<string, any>;

    expect(proposal).toMatchObject({
      simulationRunId: 'arena-preview-run-1',
      candidatePatch: {
        kp: 0.9,
        ki: 0.05,
      },
      mutatesControllerDraft: false,
    });
  });

  it('creates idempotent virtual simulation runs through AgentToolRun and SimulationRun records', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            agentSessionId: 'agent-session-1',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-sim-1',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'task-spec-1', ...data })),
      },
      simulationRun: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'run-agent-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
      simulationTrace: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'trace-agent-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        })),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
      controllerSnapshotRef: 'controller:pid:draft-1',
      seed: 7,
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-1',
      traceId: 'trace-agent-1',
      provenance: {
        runKind: 'agent_experiment',
        sourceDomain: 'konling_agent',
        evaluationVisibility: 'preview',
      },
    });
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'run_virtual_simulation',
        ownerUserId: 'student-1',
        idempotencyKey: 'run-key-1',
      }),
    }));
    expect(db.simulationRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ownerUserId: 'student-1',
        classId: 'class-1',
        runKind: 'agent_experiment',
        sourceDomain: 'konling_agent',
        summary: expect.objectContaining({
          agentSessionId: 'agent-session-1',
          agentToolRunId: 'tool-run-sim-1',
        }),
      }),
    }));
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-1',
          factType: 'simulation',
          sourceEventId: 'simulation-agent-evidence:simulation_run:run-agent-1:1.0',
          sourceLogId: 'SimulationRun:run-agent-1',
          contextJson: expect.objectContaining({
            simulation: expect.objectContaining({
              runId: 'run-agent-1',
              traceReference: 'SimulationTrace:trace-agent-1',
              agentAssisted: true,
              governanceContext: expect.objectContaining({
                classId: 'class-1',
              }),
            }),
          }),
        }),
      ],
    }));
    expect(db.learningEvidenceDraft.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceType: 'simulation_run',
          dedupeKey: 'simulation_run:run-agent-1:1.0',
        }),
      ],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          causationId: 'SimulationRun:run-agent-1',
          dedupeKey: 'simulation_run:run-agent-1:1.0',
        }),
      ],
    }));
  });

  it('reuses idempotent virtual simulation run output without creating duplicate runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-sim-existing',
          agentSessionId: 'agent-session-1',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          toolName: 'run_virtual_simulation',
          permissionTier: 'run',
          approvalState: 'not_required',
          status: 'succeeded',
          inputSummary: { idempotencyKey: 'run-key-1' },
          outputSummary: { simulationRunId: 'run-agent-existing', traceId: 'trace-agent-existing' },
          errorSummary: null,
          idempotencyKey: 'run-key-1',
          correlationId: 'corr-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: new Date('2026-05-28T00:00:01Z'),
          latencyMs: 1000,
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      simulationRun: {
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
    });
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.simulationTrace.create).not.toHaveBeenCalled();
  });

  it('reuses idempotent virtual simulation runs across agent sessions by stable owner key', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const existingRun = {
      id: 'run-agent-existing',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: 'resource-1',
      sessionId: 'agent-session-previous',
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      taskSpecSnapshot: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
        launchContext: {
          courseId: 'simulation',
          classId: 'class-1',
          resourceId: 'resource-1',
          pageId: 'pid-default',
        },
      },
      status: 'completed',
      summary: {
        metrics: { settlingTime: 4.2 },
        lowEvidence: false,
        agentSessionId: 'agent-session-previous',
        agentToolRunId: 'tool-run-previous',
      },
      replayToken: 'konling-replay:existing',
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: 'step-response',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-agent-existing',
          checksum: 'sha256:trace-existing',
          summaryMetrics: { settlingTime: 4.2 },
          sampleCount: 120,
          sampleCadence: 0.05,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        },
      ],
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-2',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            agentSessionId: 'agent-session-2',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-2',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-sim-2',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationTaskSpec: {
        findFirst: vi.fn().mockResolvedValue({ id: 'task-spec-1' }),
        create: vi.fn(),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-2',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
      status: 'completed',
    });
    expect(db.simulationRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sourceDomain: 'konling_agent',
        sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      }),
    }));
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.simulationTrace.create).not.toHaveBeenCalled();
    expect(db.simulationTaskSpec.create).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceEventId: 'simulation-agent-evidence:simulation_run:run-agent-existing:1.0',
        }),
      ],
    }));
    expect(db.learningEvidenceDraft.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          sourceType: 'simulation_run',
          dedupeKey: 'simulation_run:run-agent-existing:1.0',
          sourceRefs: expect.objectContaining({
            agentSessionId: 'agent-session-previous',
            agentToolRunId: 'tool-run-previous',
            simulationRunId: 'run-agent-existing',
          }),
        }),
      ],
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          eventType: 'simulation_agent_evidence.draft_created',
          dedupeKey: 'simulation_run:run-agent-existing:1.0',
          payload: expect.objectContaining({
            source: expect.objectContaining({
              agentSessionId: 'agent-session-previous',
              agentToolRunId: 'tool-run-previous',
              simulationRunId: 'run-agent-existing',
            }),
          }),
        }),
      ],
    }));
  });

  it('retries failed idempotent virtual simulation materialization by reusing the existing run', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const existingRun = {
      id: 'run-agent-existing',
      ownerUserId: 'student-1',
      classId: 'class-1',
      courseId: 'simulation',
      resourceId: 'resource-1',
      sessionId: 'agent-session-1',
      runKind: 'agent_experiment',
      sourceDomain: 'konling_agent',
      sourceRefId: 'konling:student-1:course:simulation:resource:resource-1:page:pid-default:run_virtual_simulation:run-key-1',
      status: 'completed',
      summary: { metrics: { settlingTime: 4.2 }, lowEvidence: false },
      protocolVersion: '1.0',
      runtimeVersion: 'konling-simulation-tool-v1',
      modelVersion: 'step-response',
      createdAt: new Date('2026-05-28T00:00:00Z'),
      traces: [
        {
          id: 'trace-agent-existing',
          checksum: 'sha256:trace-existing',
          summaryMetrics: { settlingTime: 4.2 },
          sampleCount: 120,
          sampleCadence: 0.05,
          createdAt: new Date('2026-05-28T00:00:01Z'),
        },
      ],
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['run_virtual_simulation'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) {
            return {
              id: 'tool-run-failed',
              agentSessionId: 'agent-session-1',
              ownerUserId: 'student-1',
              actorUserId: 'student-1',
              targetUserId: 'student-1',
              toolName: 'run_virtual_simulation',
              permissionTier: 'run',
              approvalState: 'not_required',
              status: 'failed',
              inputSummary: { idempotencyKey: 'run-key-1' },
              outputSummary: null,
              errorSummary: { message: 'materialization failed after run creation' },
              idempotencyKey: 'run-key-1',
              correlationId: 'corr-failed',
              startedAt: new Date('2026-05-28T00:00:00Z'),
              completedAt: new Date('2026-05-28T00:00:01Z'),
              latencyMs: 1000,
            };
          }
          return {
            id: where.id,
            agentSessionId: 'agent-session-1',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            toolName: 'run_virtual_simulation',
            permissionTier: 'run',
            approvalState: 'not_required',
            status: 'failed',
            inputSummary: { idempotencyKey: 'run-key-1' },
            outputSummary: null,
            errorSummary: { message: 'materialization failed after run creation' },
            idempotencyKey: 'run-key-1',
            correlationId: 'corr-failed',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: new Date('2026-05-28T00:00:01Z'),
            latencyMs: 1000,
          };
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
      },
      simulationTrace: {
        create: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningEvidenceDraft: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.runVirtualSimulation({
      idempotencyKey: 'run-key-1',
      taskSpec: {
        sceneId: 'sim/cruise',
        scenarioId: 'step-response',
        objectives: ['settling_time'],
        constraints: ['overshoot'],
        disturbancePolicy: { family: 'none' },
        evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
        allowedControllers: ['pid'],
      },
    })).resolves.toMatchObject({
      simulationRunId: 'run-agent-existing',
      traceId: 'trace-agent-existing',
    });
    expect(db.simulationRun.create).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'succeeded',
      }),
    }));
  });

  it('requires approval before applying controller patches and applies approved patches to the scoped session draft', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockImplementation(async ({ select }) => {
          if (select?.stateJson) {
            return {
              id: 'agent-session-1',
              stateJson: {
                route: 'ai-chat',
                workflow: { phase: 'drafting-controller' },
              },
            };
          }
          return {
            id: 'agent-session-1',
            ownerUserId: 'student-1',
            permittedTools: ['apply_controller_patch'],
          };
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'tool-run-apply-patch',
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            agentSessionId: 'agent-session-1',
            toolName: 'apply_controller_patch',
            permissionTier: 'write',
            approvalState: 'approved',
            status: 'running',
            inputSummary: {
              simulationRunId: 'run-1',
              patch: { kp: 1.9, ki: 0.04 },
              rationale: '降低超调并保持调节时间',
            },
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: 'patch-key-1',
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-apply-patch',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      simulationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'run-1',
          ownerUserId: 'student-1',
          classId: 'class-1',
          courseId: 'simulation',
          pageId: 'pid-default',
          resourceId: 'resource-1',
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          sourceRefId: 'scene-run-1',
          taskSpecSnapshot: {
            sceneId: 'sim/cruise',
            scenarioId: 'step-response',
            evaluationSpecRef: { id: 'preview-eval', visibility: 'preview' },
          },
          status: 'completed',
          summary: { metrics: { settlingTime: 4.2 } },
          protocolVersion: '1.0',
          runtimeVersion: 'simulation-runtime-v1',
          modelVersion: 'nomoto-v1',
          createdAt: new Date('2026-05-28T00:00:00Z'),
          traces: [],
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    const approval = await runtime.applyControllerPatch({
      idempotencyKey: 'patch-key-1',
      simulationRunId: 'run-1',
      patch: { kp: 1.9, ki: 0.04 },
      rationale: '降低超调并保持调节时间',
    }) as { approvalRequired: boolean; toolRunId: string };

    expect(approval).toMatchObject({
      approvalRequired: true,
      toolRunId: 'tool-run-apply-patch',
      pendingControllerPatch: {
        simulationRunId: 'run-1',
        patch: { kp: 1.9, ki: 0.04 },
      },
    });
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'awaiting_approval',
        pendingApproval: expect.objectContaining({
          toolName: 'apply_controller_patch',
          preview: expect.objectContaining({
            pendingControllerPatch: expect.objectContaining({
              simulationRunId: 'run-1',
            }),
          }),
        }),
      }),
    }));

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-apply-patch',
      output: { approvedBy: 'student-1' },
      now: new Date('2026-05-28T00:00:01Z'),
    })).resolves.toEqual({ success: true, status: 'succeeded' });

    const draftUpdateOrder = db.agentSession.updateMany.mock.invocationCallOrder[1];
    const toolRunSuccessOrder = db.agentToolRun.updateMany.mock.invocationCallOrder[0];
    expect(draftUpdateOrder).toBeLessThan(toolRunSuccessOrder);
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-1',
        ownerUserId: 'student-1',
      }),
      data: expect.objectContaining({
        stateJson: expect.objectContaining({
          route: 'ai-chat',
          workflow: { phase: 'drafting-controller' },
          controllerDraft: expect.objectContaining({
            simulationRunId: 'run-1',
            patch: { kp: 1.9, ki: 0.04 },
            sourceToolRunId: 'tool-run-apply-patch',
          }),
        }),
      }),
    }));
  });

  it('rejects teacher controller patch writes before creating tool-run side effects', async () => {
    const scope = createScope({
      authenticatedUserId: 'teacher-1',
      targetUserId: 'teacher-1',
      role: 'teacher',
      classId: 'class-1',
      privacyScopes: ['student-visible', 'teacher-scoped'],
    });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'teacher-1',
          permittedTools: ['apply_controller_patch'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      simulationRun: {
        findFirst: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext(),
    });

    await expect(runtime.applyControllerPatch({
      idempotencyKey: 'teacher-patch-key',
      simulationRunId: 'student-run-1',
      patch: { kp: 1.5 },
    })).rejects.toMatchObject({ status: 403 });
    expect(db.simulationRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
  });

  it('keeps scoped simulation parameter and analysis tools without writing legacy pending changes', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const runtime = buildKonlingToolRuntime({
      db: {},
      scope,
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'practice',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['get_simulation_status', 'set_simulation_params', 'analyze_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
      scopedSimulationState: {
        isRunning: true,
        pidGains: { kp: 1.4, ki: 0.02, kd: 0.7 },
      },
    });
    const scopedTools = buildScopedKonlingAiTools(runtime);

    expect(scopedTools).toHaveProperty('set_simulation_params');
    expect(scopedTools).toHaveProperty('analyze_result');

    const change = await runtime.setSimulationParams({ kp: 1.8, ki: 0.04 }) as {
      success: boolean;
      pendingRequest: { params: { kp: number; ki: number }; scope: { courseId: string; pageId: string } };
    };
    expect(change.success).toBe(true);
    expect(change.pendingRequest.params).toMatchObject({ kp: 1.8, ki: 0.04 });
    expect(change.pendingRequest.scope).toMatchObject({ courseId: 'simulation', pageId: 'pid-default' });
    expect(getPendingChanges()).toBeNull();

    const analysis = await runtime.analyzeResult({
      avgError: 42,
      maxRudderRate: 2,
      duration: 120,
      controlMode: 'pid',
      kp: 1.8,
      ki: 0.04,
      kd: 0.7,
    }) as { performance: { grade: string } };
    expect(analysis.performance.grade).toContain('优秀');
  });

  it('audits scoped runtime tool calls and gates intervention feedback behind approval', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['get_page_context', 'record_intervention_result'],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (!where?.id) return null;
          return {
            id: where.id,
            ownerUserId: 'student-1',
            actorUserId: 'student-1',
            targetUserId: 'student-1',
            agentSessionId: 'agent-session-1',
            toolName: 'get_page_context',
            permissionTier: 'read',
            approvalState: 'not_required',
            status: 'running',
            inputSummary: {},
            outputSummary: null,
            errorSummary: null,
            idempotencyKey: null,
            correlationId: 'corr-1',
            startedAt: new Date('2026-05-28T00:00:00Z'),
            completedAt: null,
            latencyMs: null,
          };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: `tool-run-${data.toolName}`,
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          userId: 'student-1',
          classId: 'class-1',
          resourceId: null,
          pathNodeId: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'practice',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['get_page_context', 'record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await runtime.getPageContext();
    const writeResult = await runtime.recordInterventionResult({
      interventionId: 'intv-1',
      feedback: 'accepted',
      studentResponse: 'ok',
    }) as { approvalRequired: boolean; toolRunId: string };

    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        agentSessionId: 'agent-session-1',
        toolName: 'get_page_context',
        approvalState: 'not_required',
      }),
    }));
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'succeeded' }),
    }));
    expect(writeResult).toMatchObject({
      approvalRequired: true,
      toolRunId: 'tool-run-record_intervention_result',
    });
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'awaiting_approval',
        pendingApproval: expect.objectContaining({
          toolRunId: 'tool-run-record_intervention_result',
          toolName: 'record_intervention_result',
          status: 'awaiting_approval',
        }),
      }),
    }));
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
  });

  it('rejects simulation write approvals outside simulation scope before creating tool runs', async () => {
    const scope = createScope({ courseId: 'unit-4-5', pageId: 'step-03' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'unit-4-5',
          courseTitle: '参数优化',
          pageType: 'practice',
          stepId: 'step-03',
          topic: '约束翻译',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['set_simulation_params'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await expect(runtime.setSimulationParams({ kp: 1.8 })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
  });

  it('returns simulation parameter request previews with approval-required tool runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-set-params',
          ...data,
          startedAt: new Date('2026-05-28T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        updateMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'practice',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['set_simulation_params'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const result = await runtime.setSimulationParams({ kp: 1.8, ki: 0.04 }) as {
      approvalRequired: boolean;
      pendingRequest: { params: { kp: number; ki: number } };
      pendingChanges: string;
    };

    expect(result).toMatchObject({
      approvalRequired: true,
      success: true,
      toolRunId: 'tool-run-set-params',
      pendingRequest: {
        params: { kp: 1.8, ki: 0.04 },
      },
    });
    expect(result.pendingChanges).toContain('Kp: 1.8');
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pendingApproval: expect.objectContaining({
          toolRunId: 'tool-run-set-params',
          preview: expect.objectContaining({
            pendingRequest: expect.objectContaining({
              params: { kp: 1.8, ki: 0.04 },
            }),
          }),
        }),
      }),
    }));
  });

  it('rejects foreign intervention approvals before creating tool runs', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['record_intervention_result'],
        }),
        updateMany: vi.fn(),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'practice',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    await expect(runtime.recordInterventionResult({
      interventionId: 'foreign-intv',
      feedback: 'accepted',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentSession.updateMany).not.toHaveBeenCalled();
  });

  it('exposes idempotency keys in approval-required write tool schemas', () => {
    const tools = buildScopedKonlingAiTools({} as ReturnType<typeof buildKonlingToolRuntime>);

    expect((tools.set_simulation_params.inputSchema as any).shape).toHaveProperty('idempotencyKey');
    expect((tools.record_intervention_result.inputSchema as any).shape).toHaveProperty('idempotencyKey');
  });

  it('exposes governed adaptive path tool schemas with idempotency keys', () => {
    const tools = buildScopedKonlingAiTools({} as ReturnType<typeof buildKonlingToolRuntime>);

    for (const toolName of [
      'generate_learning_path',
      'revise_learning_path_options',
      'select_learning_path',
      'reject_learning_path_option',
      'explain_learning_path_tradeoff',
      'record_path_adjustment_outcome',
    ]) {
      expect(tools).toHaveProperty(toolName);
      expect(((tools as any)[toolName].inputSchema as any).shape).toHaveProperty('idempotencyKey');
    }
  });

  it('filters exposed AI tool schemas to the current agent session permissions', () => {
    const tools = buildScopedKonlingAiTools({
      permittedTools: ['get_page_context'],
      getPageContext: vi.fn(),
      getLearnerState: vi.fn(),
      getPlanContext: vi.fn(),
      searchLearningMemory: vi.fn(),
      searchKnowledgeGraph: vi.fn(),
      recommendNextAction: vi.fn(),
      getSimulationStatus: vi.fn(),
      setSimulationParams: vi.fn(),
      analyzeResult: vi.fn(),
      recordInterventionResult: vi.fn(),
      analyzeAttempt: vi.fn(),
    } as unknown as ReturnType<typeof buildKonlingToolRuntime>);

    expect(tools).toHaveProperty('get_page_context');
    expect(tools).not.toHaveProperty('set_simulation_params');
    expect(tools).not.toHaveProperty('record_intervention_result');
    expect(tools).not.toHaveProperty('generate_learning_path');
  });

  it('reuses completed idempotent tool runs without repeating side effects', async () => {
    const scope = createScope({ courseId: 'simulation', pageId: 'pid-default' });
    const outputSummary = {
      success: true,
      outcome: {
        feedback: 'accepted',
        helpful: true,
      },
    };
    const completedRun = {
      id: 'tool-run-existing',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'record_intervention_result',
      permissionTier: 'write',
      approvalState: 'approved',
      status: 'succeeded',
      inputSummary: { interventionId: 'intv-1' },
      outputSummary,
      errorSummary: null,
      idempotencyKey: 'same-key',
      correlationId: 'corr-existing',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: new Date('2026-05-28T00:00:01Z'),
      latencyMs: 1000,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['record_intervention_result'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(completedRun),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          userId: 'student-1',
          classId: 'class-1',
          resourceId: 'resource-1',
          pathNodeId: 'node-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: {
        pageContext: {
          courseId: 'simulation',
          courseTitle: '仿真',
          pageType: 'practice',
          stepId: 'pid-default',
          topic: 'PID 参数整定',
          learningObjectives: [],
          knowledgeType: 'X',
        },
        userProfile: {
          id: 'student-1',
          name: '张三',
          learningStyle: 'INTERACTIVE',
          cognitiveLevel: 3,
          abilityVector: {
            computational: 0.5,
            crossDomain: 0.5,
            design: 0.5,
            analysis: 0.5,
            evaluation: 0.5,
          },
        },
        learnerState: null,
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
        memory: [],
        permittedTools: ['record_intervention_result'],
        missingContext: [],
        featureFlags: {
          learnerState: false,
          semanticMemory: false,
          strategyMemory: false,
        },
      },
    });

    const result = await runtime.recordInterventionResult({
      interventionId: 'intv-1',
      feedback: 'accepted',
      helpful: true,
      studentResponse: 'ok',
      idempotencyKey: 'same-key',
    } as Parameters<typeof runtime.recordInterventionResult>[0] & { idempotencyKey: string });

    expect(result).toMatchObject(outputSummary);
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
  });

  it('keeps graph-driven adaptive path generation usable when the LearningGoal baseline artifact is limited', async () => {
    const createdRun = {
      id: 'tool-run-path-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-gen-1',
      correlationId: 'corr-path-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };
    const scope = createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' });
    const planContext: KonlingRuntimeContext['planContext'] = {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    };
    const graphContext = buildKonlingKaqGraphContext({
      scope,
      learningGoalId: 'control-correction',
      planContext,
    });
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
        planContext,
        graphContext,
      }),
    });

    const result = await runtime.generateLearningPath({
      idempotencyKey: 'path-gen-1',
      goalId: 'control-correction',
      graphNodeId: 'kn:autocontrol:controller-correction',
      timeBudgetMinutes: 90,
      difficultyRhythm: 'steady',
      naturalLanguageIntent: '我想先补相位裕度，再做仿真验证。',
    }) as {
      generationStatus: string;
      pathId: string | null;
      pathOptions: Array<Record<string, unknown>>;
      comparison: { optionCount: number; message: string };
      limitations: string[];
    };

    expect(result).toMatchObject({
      operation: 'generated',
      generationStatus: 'persisted',
      pathId: expect.any(String),
      scope: expect.objectContaining({
        targetUserId: 'student-1',
        goalId: 'control-correction',
      }),
      comparison: expect.objectContaining({
        optionCount: expect.any(Number),
        message: '已根据你的学习证据生成可比较的路径方案。',
      }),
      limitations: expect.arrayContaining(['learning-goal-baseline-incomplete']),
    });
    expect(result.pathOptions.length).toBeGreaterThan(0);
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'generate_learning_path',
        idempotencyKey: 'path-gen-1',
        inputSummary: expect.objectContaining({
          graphNodeId: 'kn:autocontrol:controller-correction',
          naturalLanguageIntent: 'student-provided-natural-language-path-intent',
        }),
      }),
    }));
    expect(db.learningPath.upsert).toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'succeeded',
        outputSummary: expect.objectContaining({
          generationStatus: 'persisted',
          limitations: expect.arrayContaining(['learning-goal-baseline-incomplete']),
        }),
      }),
    }));
    expect(JSON.stringify(result)).not.toMatch(/stage-1-rules-graph|policyFamily/);
    expect(JSON.stringify(result)).not.toMatch(/low-confidence-learner-state|adaptive-learner-state|knowledgeMastery/);
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('我想先补相位裕度');
  });

  it('preserves an explicitly empty adaptive path resource preference', async () => {
    const createdRun = {
      id: 'tool-run-path-empty-resources',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-gen-empty-resources',
      correlationId: 'corr-path-empty-resources',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
      }),
    });

    await runtime.generateLearningPath({
      idempotencyKey: 'path-gen-empty-resources',
      goalId: 'control-correction',
      resourcePreference: [],
    });

    const createdPath = db.learningPath.upsert.mock.calls[0][0].create;
    expect(createdPath.inputSnapshot.request.resourcePreference).toEqual([]);
    expect(createdPath.inputSnapshot.request.resourcePreference).not.toEqual([
      'knowledge_card',
      'adaptive_quiz',
      'simulation',
    ]);
  });

  it('uses non-baseline blocked copy when path constraints exclude all candidates', async () => {
    const createdRun = {
      id: 'tool-run-path-excluded-resources',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-gen-excluded-resources',
      correlationId: 'corr-path-excluded-resources',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
      }),
    });

    const result = await runtime.generateLearningPath({
      idempotencyKey: 'path-gen-excluded-resources',
      goalId: 'control-correction',
      excludedNodeIds: [
        'registry:lesson09-correction-precheck',
        'knowledge-card:control-correction-time-domain-targets',
        'knowledge-card:lesson09-summary-card',
        'registry:lesson09-summary-card',
        'simulation:control-correction-step-response-lab',
        'arena-task:task-second-order-lead-pid',
        'registry:arena-challenge-workbench',
        'reflection:control-correction-design-reflection',
        'ai_intervention:control-correction-path-coach',
      ],
    }) as {
      generationStatus: string;
      pathOptions: Array<Record<string, unknown>>;
      comparison: { message: string };
      limitations: string[];
    };

    expect(result.generationStatus).toBe('blocked');
    expect(result.pathOptions).toEqual([]);
    expect(result.limitations).not.toContain('learning-goal-baseline-incomplete');
    expect(result.comparison.message).not.toContain('基线资源');
    expect(result.comparison.message).toBe('当前限制条件下暂不能生成可执行学习路径，请调整目标、时间或资源偏好后重试。');
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('uses assessment coverage blocked copy when reviewed assessment coverage is incomplete', async () => {
    const createdRun = {
      id: 'tool-run-path-assessment-coverage',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-gen-assessment-coverage',
      correlationId: 'corr-path-assessment-coverage',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    mocks.getLearningGoalResourceBaselineForPlanner.mockReturnValueOnce({
      coverageState: 'complete',
      missingBaselineCategories: [],
      reviewedBindingCount: 12,
      limitationReason: null,
      sourceWindow: null,
    });
    mocks.getLearningGoalAssessmentCoverageForPlanner.mockReturnValueOnce({
      coverageState: 'limited',
      incompleteStages: ['checkpoint'],
      reviewedPathEligibleItemCount: 0,
      limitationReason: 'minimum-assessment-coverage-incomplete:checkpoint',
      matrixVersion: 'learning-goal-assessment-coverage.test',
      generatedAt: '2026-05-28T00:00:00.000Z',
      terminalValidationRequired: true,
      assessmentItemsReplaceTerminalEvidence: false,
    });
    const scope = createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' });
    const graphContext = buildKonlingKaqGraphContext({
      scope,
      learningGoalId: 'control-correction',
    });
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
        graphContext,
      }),
    });

    const result = await runtime.generateLearningPath({
      idempotencyKey: 'path-gen-assessment-coverage',
      goalId: 'control-correction',
      excludedNodeIds: [
        'registry:lesson09-correction-precheck',
        'knowledge-card:control-correction-time-domain-targets',
        'knowledge-card:lesson09-summary-card',
        'registry:lesson09-summary-card',
        'simulation:control-correction-step-response-lab',
        'arena-task:task-second-order-lead-pid',
        'registry:arena-challenge-workbench',
        'reflection:control-correction-design-reflection',
        'ai_intervention:control-correction-path-coach',
      ],
    }) as {
      generationStatus: string;
      pathOptions: Array<Record<string, unknown>>;
      comparison: { message: string };
      limitations: string[];
    };

    expect(result.generationStatus).toBe('blocked');
    expect(result.pathOptions).toEqual([]);
    expect(result.limitations).toContain('learning-goal-assessment-coverage-incomplete');
    expect(result.limitations).not.toContain('learning-goal-baseline-incomplete');
    expect(result.comparison.message).toBe('当前目标缺少已审核的评估题目覆盖，暂不能生成可执行学习路径。');
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('does not reuse runtime graph context across adaptive path goals', async () => {
    const createdRun = {
      id: 'tool-run-path-cross-graph',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-gen-cross-graph',
      correlationId: 'corr-path-cross-graph',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const scope = createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' });
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
        graphContext: buildKonlingKaqGraphContext({
          scope,
          learningGoalId: 'control-correction',
        }),
      }),
    });

    await runtime.generateLearningPath({
      idempotencyKey: 'path-gen-cross-graph',
      goalId: 'frequency-response-foundations',
    });

    const createdPath = db.learningPath.upsert.mock.calls[0][0].create;
    expect(createdPath.goalId).toBe('frequency-response-foundations');
    expect(createdPath.pathPayload.graphContext).toBeNull();
  });

  it('exposes executable policy bundle options when bundle is in fallback status', () => {
    const options = buildStudentSafePathOptions({
      status: 'ready',
      goal: {
        id: 'control-correction',
        knowledgeTargets: ['phase-margin'],
      },
      confidence: {
        level: 'medium',
      },
      mainPath: [{
        nodeId: 'node-main',
        title: '相位裕度补强',
        type: 'knowledge_card',
        estimatedTimeMinutes: 15,
        knowledgeCoverage: ['phase-margin'],
      }],
      policyBundle: {
        status: 'low-resource-fallback',
        paths: [{
          styleId: 'simulation-driven',
          label: '仿真优先路径',
          nodeIds: ['node-policy'],
          effort: { estimatedMinutes: 15, relative: 'short' },
          nodeSummaries: [{
            nodeId: 'node-policy',
            title: '候选仿真节点',
            pathNodeType: 'simulation',
            estimatedTimeMinutes: 15,
          }],
          targetDeficits: [{ targetId: 'phase-margin' }],
          evidenceBasis: ['resource overlap too high'],
          limitations: [],
          terminalValidationStrategy: { nodeIds: [] },
        }],
      },
    } as any);

    expect(options).toEqual([
      expect.objectContaining({
        optionId: 'path-option-1',
        styleId: 'simulation-driven',
        label: '仿真优先路径',
        nodeSummaries: [expect.objectContaining({
          nodeId: 'node-policy',
          resourceType: 'simulation',
        })],
      }),
    ]);
    expect(JSON.stringify(options)).toContain('候选仿真节点');
  });

  it('normalizes server-owned competency scores before adaptive path generation', async () => {
    const createdRun = {
      id: 'tool-run-path-normalized-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-normalized-1',
      correlationId: 'corr-path-normalized-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['generate_learning_path'],
        learnerState: {
          primaryCompetencies: {
            vector: {
              parameterDesign: { score: 50, confidence: 0.8, evidenceCount: 4 },
            },
          },
          knowledgeMastery: {
            tags: {},
          },
          evidence: {
            confidence: { level: 'medium', score: 0.8, evidenceCount: 4, sourceCompleteness: 0.8 },
            sourceCoverage: {},
          },
        } as unknown as KonlingRuntimeContext['learnerState'],
      }),
    });

    await runtime.generateLearningPath({
      idempotencyKey: 'path-normalized-1',
      goalId: 'control-correction',
      timeBudgetMinutes: 90,
    });

    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        explanationPayload: expect.objectContaining({
          selectedReasons: expect.arrayContaining(['matches-competency-deficit']),
        }),
      }),
    }));
  });

  it('accepts registered non-control adaptive path goals during path tool preflight', async () => {
    const createdRun = {
      id: 'tool-run-path-tradeoff-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'explain_learning_path_tradeoff',
      permissionTier: 'analyze',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-tradeoff-1',
      correlationId: 'corr-path-tradeoff-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          pathPayload: {
            pathOptions: [{
              styleId: 'guided',
              policyFamily: 'guided',
              resourceMix: {},
            }],
          },
          learnerStateRef: null,
          inputSnapshot: {},
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ resourceId: null, pathNodeId: null, pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['explain_learning_path_tradeoff'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    const result = await runtime.explainLearningPathTradeoff({
      idempotencyKey: 'path-tradeoff-1',
      goalId: 'frequency-response-foundations',
      styleId: 'guided',
    }) as { scope: { goalId: string } };

    expect(result.scope.goalId).toBe('frequency-response-foundations');
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'explain_learning_path_tradeoff',
        idempotencyKey: 'path-tradeoff-1',
        inputSummary: expect.objectContaining({
          goalId: 'frequency-response-foundations',
        }),
      }),
    }));
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'succeeded',
      }),
    }));
  });

  it('allows tradeoff explanations for scoped path ids within registered goals', async () => {
    const createdRun = {
      id: 'tool-run-path-tradeoff-2',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'explain_learning_path_tradeoff',
      permissionTier: 'analyze',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-tradeoff-2',
      correlationId: 'corr-path-tradeoff-2',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'frequency-path-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [
                { styleId: 'guided', nodeIds: ['node-1'], resourceMix: {} },
                { styleId: 'sprint', nodeIds: ['node-2'], resourceMix: {} },
              ],
            },
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['explain_learning_path_tradeoff'],
        planContext: {
          currentPathId: 'frequency-path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['frequency-path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.explainLearningPathTradeoff({
      idempotencyKey: 'path-tradeoff-2',
      goalId: 'frequency-response-foundations',
      pathId: 'frequency-path-1',
      styleId: 'guided',
    })).resolves.toMatchObject({
      operation: 'explained',
      scope: expect.objectContaining({
        goalId: 'frequency-response-foundations',
        pathId: 'frequency-path-1',
      }),
    });
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'frequency-path-1',
        userId: 'student-1',
        goalId: 'frequency-response-foundations',
        classId: 'class-1',
      }),
    }));
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'explain_learning_path_tradeoff',
        approvalState: 'not_required',
      }),
    }));
  });

  it('rejects path tradeoff explanations for options outside the scoped path', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'frequency-path-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [
                { styleId: 'guided', nodeIds: ['node-1'], resourceMix: {} },
              ],
            },
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['explain_learning_path_tradeoff'],
        planContext: {
          currentPathId: 'frequency-path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['frequency-path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.explainLearningPathTradeoff({
      idempotencyKey: 'path-tradeoff-forged',
      goalId: 'frequency-response-foundations',
      pathId: 'frequency-path-1',
      styleId: 'hallucinated-style',
    })).rejects.toThrow('路径选项不属于当前学习路径');
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('allows tradeoff explanations for fallback policy bundle options', async () => {
    const createdRun = {
      id: 'tool-run-path-tradeoff-fallback',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'explain_learning_path_tradeoff',
      permissionTier: 'analyze',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'path-tradeoff-fallback',
      correlationId: 'corr-path-tradeoff-fallback',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'frequency-path-1',
          pathPayload: {
            policyBundle: {
              status: 'low-resource-fallback',
              paths: [
                { styleId: 'guided', nodeIds: ['node-1'], resourceMix: {} },
                { styleId: 'sprint', nodeIds: ['node-2'], resourceMix: {} },
              ],
            },
          },
        }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['explain_learning_path_tradeoff'],
        planContext: {
          currentPathId: 'frequency-path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['frequency-path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.explainLearningPathTradeoff({
      idempotencyKey: 'path-tradeoff-fallback',
      goalId: 'frequency-response-foundations',
      pathId: 'frequency-path-1',
      styleId: 'guided',
      compareWithStyleId: 'sprint',
    })).resolves.toMatchObject({
      operation: 'explained',
      styleId: 'guided',
      compareWithStyleId: 'sprint',
    });
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'explain_learning_path_tradeoff',
        idempotencyKey: 'path-tradeoff-fallback',
      }),
    }));
  });

  it('records path-bound choices for registered non-control adaptive path goals', async () => {
    const createdRun = {
      id: 'tool-run-frequency-select-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'select_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'frequency-select-1',
      correlationId: 'corr-frequency-select-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'frequency-path-1',
          userId: 'student-1',
          goalId: 'frequency-response-foundations',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [{
                styleId: 'guided-frequency-route',
                nodeIds: ['frequency-node-1'],
              }],
            },
            selectionHistory: [],
            activity: [],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 'frequency-path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: 'frequency-path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['frequency-path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'frequency-select-1',
      goalId: 'frequency-response-foundations',
      pathId: 'frequency-path-1',
      selectedStyleId: 'guided-frequency-route',
    })).resolves.toMatchObject({
      outcome: 'selected',
      evidence: {
        emitted: true,
        dedupeKey: 'learning-path:choice:frequency-path-1:frequency-select-1',
      },
    });
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'frequency-path-1',
        userId: 'student-1',
        goalId: 'frequency-response-foundations',
        classId: 'class-1',
      }),
    }));
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        toolName: 'select_learning_path',
        approvalState: 'not_required',
      }),
    }));
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'frequency-path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          activity: [
            expect.objectContaining({
              goalId: 'frequency-response-foundations',
              type: 'choice:selection',
              selectedStyleId: 'guided-frequency-route',
            }),
          ],
        }),
      }),
    }));
  });

  it('accepts explicit scoped path ids from the path center when no path node is mounted', async () => {
    const createdRun = {
      id: 'tool-run-select-explicit-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'select_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'select-explicit-path-1',
      correlationId: 'corr-select-explicit-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [{ styleId: 'arena-simulation-sprint', nodeIds: ['node-1'] }],
            },
            selectionHistory: [],
            activity: [],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 'path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center', pathNodeId: null }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-explicit-path-1',
      pathId: 'path-1',
      selectedStyleId: 'arena-simulation-sprint',
    })).resolves.toMatchObject({
      outcome: 'selected',
    });
    expect(db.agentToolRun.create).toHaveBeenCalled();
    expect(db.learningPath.update).toHaveBeenCalled();
  });

  it('records adaptive path selection and rejection as governed path activity', async () => {
    const selectRun = {
      id: 'tool-run-select-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'select_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'select-path-1',
      correlationId: 'corr-select-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const rejectRun = {
      ...selectRun,
      id: 'tool-run-reject-1',
      toolName: 'reject_learning_path',
      idempotencyKey: 'reject-path-1',
      correlationId: 'corr-reject-1',
    };
    const outcomeRun = {
      ...selectRun,
      id: 'tool-run-outcome-1',
      toolName: 'record_path_adjustment_outcome',
      idempotencyKey: 'outcome-path-1',
      correlationId: 'corr-outcome-1',
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path', 'reject_learning_path_option', 'record_path_adjustment_outcome'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(selectRun)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(rejectRun)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(outcomeRun),
        create: vi.fn()
          .mockResolvedValueOnce(selectRun)
          .mockResolvedValueOnce(rejectRun)
          .mockResolvedValueOnce(outcomeRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [
                {
                  styleId: 'arena-simulation-sprint',
                  policyFamily: 'simulation-driven',
                  nodeIds: ['node-1'],
                  resourceMix: { simulation: 2, arena_task: 1 },
                  evidenceBasis: ['recent-simulation-attempt'],
                  limitations: ['requires-lab-time'],
                  terminalValidationNodeIds: ['arena-checkpoint-1'],
                  terminalValidationStrategy: { strategy: 'arena-validation' },
                },
                { styleId: 'foundation-remediation', nodeIds: ['node-2'] },
                { styleId: 'preference-matched-route', nodeIds: ['node-3'] },
              ],
            },
            selectionHistory: [],
            activity: [],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 'path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path', 'reject_learning_path_option', 'record_path_adjustment_outcome'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-path-1',
      selectedStyleId: 'arena-simulation-sprint',
      helpful: true,
    })).resolves.toMatchObject({
      outcome: 'selected',
      evidence: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:select-path-1',
      },
    });
    await expect(runtime.rejectLearningPathOption({
      idempotencyKey: 'reject-path-1',
      rejectedStyleId: 'foundation-remediation',
      reason: '我想先做仿真。',
    })).resolves.toMatchObject({
      outcome: 'rejected',
      evidence: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:reject-path-1',
      },
    });
    await expect(runtime.recordPathAdjustmentOutcome({
      idempotencyKey: 'outcome-path-1',
      outcome: 'not-helpful',
      rejectedStyleIds: ['preference-matched-route'],
    })).resolves.toMatchObject({
      outcome: 'not-helpful',
      evidence: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:outcome-path-1',
      },
    });

    expect(db.agentToolRun.create.mock.invocationCallOrder[0]).toBeLessThan(
      db.learningFact.createMany.mock.invocationCallOrder[0],
    );
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: [
            expect.objectContaining({
              id: 'control-correction-path:choice:path-1:select-path-1',
              type: 'selection',
              selectedStyleId: 'arena-simulation-sprint',
              helpful: true,
            }),
          ],
        }),
      }),
    }));
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: [
            expect.objectContaining({
              id: 'control-correction-path:choice:path-1:reject-path-1',
              type: 'rejection',
              rejectedStyleIds: ['foundation-remediation'],
            }),
          ],
        }),
      }),
    }));
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: [
            expect.objectContaining({
              id: 'control-correction-path:choice:path-1:outcome-path-1',
              type: 'helpfulness',
              helpful: false,
              rejectedStyleIds: ['preference-matched-route'],
            }),
          ],
        }),
      }),
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: 'control-correction-path:choice:path-1:select-path-1',
          payload: expect.objectContaining({
            relatedRefs: expect.objectContaining({
              selectedPolicyFamily: 'simulation-driven',
            }),
            preferenceEvidence: expect.objectContaining({
              resourceMix: { simulation: 2, arena_task: 1 },
              rationaleMetadata: expect.objectContaining({
                evidenceBasis: '[redacted-object]',
                limitations: '[redacted-object]',
                terminalValidationNodeIds: '[redacted-object]',
                terminalValidationStrategy: '[redacted-object]',
              }),
            }),
          }),
        }),
      ]),
    }));
    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: 'control-correction-path:choice:path-1:outcome-path-1',
          payload: expect.objectContaining({
            preferenceEvidence: expect.objectContaining({
              helpful: false,
            }),
          }),
        }),
      ]),
    }));
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('我想先做仿真');
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('我想先做仿真');
  });

  it('records selected option metadata for adjustment outcomes from pathOptions fallback', async () => {
    const outcomeRun = {
      id: 'tool-run-outcome-fallback-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'record_path_adjustment_outcome',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'outcome-fallback-1',
      correlationId: 'corr-outcome-fallback-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['record_path_adjustment_outcome'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(outcomeRun),
        create: vi.fn().mockResolvedValue(outcomeRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            pathOptions: [{
              styleId: 'legacy-foundation-route',
              policyFamily: 'foundation-remediation',
              nodeIds: ['node-1'],
              resourceMix: { knowledge_card: 2, quiz: 1 },
              evidenceBasis: ['fallback-option-evidence'],
            }],
            selectionHistory: [],
            activity: [],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 'path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['record_path_adjustment_outcome'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.recordPathAdjustmentOutcome({
      idempotencyKey: 'outcome-fallback-1',
      outcome: 'helpful',
      selectedStyleId: 'legacy-foundation-route',
    })).resolves.toMatchObject({
      outcome: 'helpful',
      evidence: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:outcome-fallback-1',
      },
    });

    expect(db.evidenceOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          dedupeKey: 'control-correction-path:choice:path-1:outcome-fallback-1',
          payload: expect.objectContaining({
            relatedRefs: expect.objectContaining({
              selectedPolicyFamily: 'foundation-remediation',
              selectedStyleId: 'legacy-foundation-route',
            }),
            preferenceEvidence: expect.objectContaining({
              helpful: true,
              resourceMix: { knowledge_card: 2, quiz: 1 },
              rationaleMetadata: expect.objectContaining({
                evidenceBasis: '[redacted-object]',
              }),
            }),
          }),
        }),
      ]),
    }));
  });

  it('records adaptive path revision as governed switch activity', async () => {
    const revisedRun = {
      id: 'tool-run-revise-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'revise_learning_path_options',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'revise-path-1',
      correlationId: 'corr-revise-1',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['revise_learning_path_options'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(revisedRun),
        create: vi.fn().mockResolvedValue(revisedRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'path-1',
            userId: 'student-1',
            pathPayload: {
              policyBundle: {
                status: 'ready',
                paths: [
                  { styleId: 'arena-simulation-sprint', nodeIds: ['node-1'] },
                  { styleId: 'foundation-remediation', nodeIds: ['node-2'] },
                ],
              },
              selectionHistory: [],
              activity: [],
            },
          })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'path-1',
            userId: 'student-1',
            pathPayload: { selectionHistory: [], activity: [] },
          }),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
        update: vi.fn().mockResolvedValue({ id: 'path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const scope = createScope({ pageId: 'adaptive-path-center' });
    const planContext: KonlingRuntimeContext['planContext'] = {
      currentPathId: 'path-1',
      activeNodeId: 'node-1',
      nextNodeIds: [],
      recentPathIds: ['path-1'],
      completedNodeIds: [],
      status: 'available',
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope,
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['revise_learning_path_options'],
        planContext,
        learnerState: createGraphLearnerState('student-1'),
      }),
    });

    const result = await runtime.reviseLearningPathOptions({
      idempotencyKey: 'revise-path-1',
      goalId: 'control-correction',
      pathId: 'path-1',
      timeBudgetMinutes: 90,
      difficultyRhythm: 'challenge',
      checkpointPreference: 'dense',
      naturalLanguageIntent: '我希望减少讲解，先完成仿真和 Arena。',
      rejectedStyleIds: ['foundation-remediation'],
      selectedStyleId: 'arena-simulation-sprint',
    });
    expect(result).toMatchObject({
      operation: 'revised',
      generationStatus: 'persisted',
      limitations: [],
      pathOptions: expect.any(Array),
    });
    expect((result as { pathOptions: unknown[] }).pathOptions.length).toBeGreaterThanOrEqual(3);
    const revisedCreate = db.learningPath.upsert.mock.calls[0][0].create;
    expect(revisedCreate.pathPayload.graphContext).toBeNull();
    expect(revisedCreate.pathPayload.pathOptions.length).toBeGreaterThanOrEqual(3);
    expect(revisedCreate.explanationPayload.selectedReasons).toEqual(
      expect.arrayContaining(['policy-simulation-driven']),
    );
    expect(revisedCreate.pathPayload.policyBundle.paths[0].policyFamily).toBe('simulation-driven');
    expect(revisedCreate.pathPayload.policyBundle.paths.map((path: { policyFamily: string }) => path.policyFamily))
      .not.toContain('foundation-remediation');
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        inputSummary: expect.objectContaining({
          naturalLanguageIntent: 'student-provided-natural-language-path-intent',
        }),
      }),
    }));
    expect(db.learningPath.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'path-1' },
      data: expect.objectContaining({
        pathPayload: expect.objectContaining({
          selectionHistory: [
            expect.objectContaining({
              id: 'control-correction-path:choice:path-1:revise-path-1:revision',
              type: 'switch',
              selectedStyleId: 'arena-simulation-sprint',
              rejectedStyleIds: ['foundation-remediation'],
            }),
          ],
        }),
      }),
    }));
    expect(JSON.stringify(db.evidenceOutbox.createMany.mock.calls)).not.toContain('我希望减少讲解');
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('我希望减少讲解');
  });

  it('rejects adaptive path generation when client hints try to expand the scoped goal', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'path-gen-foreign',
      goalId: 'other-goal',
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('rejects adaptive path generation when tool goal differs from the server-scoped path advisor goal', async () => {
    for (const [serverGoalId, requestedGoalId] of [
      ['control-correction', 'frequency-response-foundations'],
      ['frequency-response-foundations', 'control-correction'],
    ] as const) {
      const db = {
        agentSession: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'agent-session-1',
            permittedTools: ['generate_learning_path'],
          }),
        },
        agentToolRun: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
        learningPath: {
          upsert: vi.fn(),
        },
      };
      const runtime = buildKonlingToolRuntime({
        db,
        scope: createScope({
          courseId: serverGoalId,
          pageId: 'adaptive-path-center',
          resourceId: null,
          pathNodeId: null,
        }),
        agentSessionId: 'agent-session-1',
        context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
      });

      await expect(runtime.generateLearningPath({
        idempotencyKey: `path-gen-cross-goal:${serverGoalId}:${requestedGoalId}`,
        goalId: requestedGoalId,
      })).rejects.toMatchObject({
        status: 403,
        message: 'Konling 路径工具不能扩展到服务端授权目标之外。',
      });
      expect(db.agentToolRun.create).not.toHaveBeenCalled();
      expect(db.learningPath.upsert).not.toHaveBeenCalled();
    }
  });

  it('rejects idempotent adaptive path reuse when the stored output belongs to another server-scoped goal', async () => {
    const existingRun = {
      id: 'tool-run-cross-goal-existing',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'succeeded',
      inputSummary: {
        idempotencyKey: 'path-gen-cross-goal-replay',
        goalId: null,
      },
      outputSummary: {
        operation: 'generated',
        scope: {
          goalId: 'frequency-response-foundations',
        },
      },
      errorSummary: null,
      idempotencyKey: 'path-gen-cross-goal-replay',
      correlationId: 'corr-cross-goal-replay',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: new Date('2026-05-28T00:00:01Z'),
      latencyMs: 1000,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      learningPath: {
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        resourceId: null,
        pathNodeId: null,
      }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'path-gen-cross-goal-replay',
    })).rejects.toMatchObject({
      status: 403,
      message: '幂等 Konling 工具结果不属于当前页面目标。',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('rejects idempotent adaptive path reuse when the stored input belongs to another server-scoped goal', async () => {
    const existingRun = {
      id: 'tool-run-cross-goal-input-existing',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'succeeded',
      inputSummary: {
        idempotencyKey: 'path-gen-cross-goal-input-replay',
        goalId: 'frequency-response-foundations',
      },
      outputSummary: {
        operation: 'generated',
        scope: {
          goalId: 'control-correction',
        },
      },
      errorSummary: null,
      idempotencyKey: 'path-gen-cross-goal-input-replay',
      correlationId: 'corr-cross-goal-input-replay',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: new Date('2026-05-28T00:00:01Z'),
      latencyMs: 1000,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(existingRun),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      learningPath: {
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({
        courseId: 'control-correction',
        pageId: 'adaptive-path-center',
        resourceId: null,
        pathNodeId: null,
      }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'path-gen-cross-goal-input-replay',
    })).rejects.toMatchObject({
      status: 403,
      message: '幂等 Konling 工具请求不属于当前页面目标。',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('generates frequency response paths through a registered generation registry', async () => {
    const createdRun = {
      id: 'tool-run-frequency-gen-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'frequency-path-gen',
      correlationId: 'corr-frequency-path-gen',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const [safeTextbookDocument] = textbookRuntimeSearchDocumentFixture();
    mocks.loadAllTextbookRuntimeSearchDocuments.mockResolvedValue([
      ...textbookRuntimeSearchDocumentFixture(),
      {
        ...safeTextbookDocument,
        id: 'unsafe-path-planning-doc',
        title: 'Unsafe path planning citation fixture',
        href: 'javascript:alert(1)',
        citationAddress: {
          ...safeTextbookDocument.citationAddress,
          sourceRefId: 'unsafe-path-planning-doc',
          href: 'javascript:alert(1)',
        },
      },
    ]);
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    const result = await runtime.generateLearningPath({
      idempotencyKey: 'frequency-path-gen',
      goalId: 'frequency-response-foundations',
      resourcePreference: ['textbook_section'],
    });
    expectRecord(result, 'generated learning path result');
    expect(Array.isArray(result.pathOptions), 'generated learning path result should include path options').toBe(true);
    expect(result).toMatchObject({
      operation: 'generated',
      scope: expect.objectContaining({
        goalId: 'frequency-response-foundations',
      }),
    });
    expect((result as { pathOptions: unknown[] }).pathOptions.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(result.pathOptions)).toContain('registry:frequency-precheck');
    expect(db.agentToolRun.create).toHaveBeenCalled();
    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        goalId: 'frequency-response-foundations',
        inputSnapshot: expect.objectContaining({
          request: expect.objectContaining({
            resourcePreference: ['textbook_section'],
          }),
        }),
      }),
    }));
    const createdPath = db.learningPath.upsert.mock.calls[0][0].create;
    expect(createdPath.pathPayload.policyBundle.paths.length).toBeGreaterThanOrEqual(3);
    expect(createdPath.pathPayload.pathOptions.length).toBeGreaterThanOrEqual(3);
    expect(createdPath.pathPayload.pathOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        optionId: 'path-option-1',
        nodeIds: expect.arrayContaining(['registry:frequency-precheck']),
        planNodes: expect.any(Array),
      }),
    ]));
    expect(createdPath.pathPayload.visualization.evidence.sourcePackEvidence).toMatchObject({
      profile: 'path-planning',
      pathEligibleItemRefs: expect.arrayContaining([
        expect.stringContaining('resource-node:'),
      ]),
    });
    expect(createdPath.pathPayload.visualization.evidence.sourcePackEvidence.itemRefs.length).toBeGreaterThan(0);
    expect(createdPath.pathPayload.visualization.evidence.sourcePackEvidence.citationOnlyItemRefs).toContain('fig-08-01__figure');
    expect(createdPath.pathPayload.visualization.evidence.sourcePackEvidence.limitationCodes).toContain('upstream-limitations-redacted');
    expect(db.agentToolRun.create.mock.invocationCallOrder[0]).toBeLessThan(
      db.learningPath.upsert.mock.invocationCallOrder[0],
    );
  });

  it('defaults adaptive path generation to the server-scoped registered goal', async () => {
    const createdRun = {
      id: 'tool-run-frequency-scoped-default-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'generate_learning_path',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'frequency-scoped-default',
      correlationId: 'corr-frequency-scoped-default',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({
        courseId: 'frequency-response-foundations',
        pageId: 'adaptive-path-center',
        resourceId: null,
        pathNodeId: null,
      }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'frequency-scoped-default',
    })).resolves.toMatchObject({
      operation: 'generated',
      scope: expect.objectContaining({
        goalId: 'frequency-response-foundations',
      }),
    });
    expect(db.learningPath.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        goalId: 'frequency-response-foundations',
      }),
    }));
  });

  it('rejects adaptive path tools that request a goal outside the server-scoped goal', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({
        courseId: 'frequency-response-foundations',
        pageId: 'adaptive-path-center',
      }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'frequency-scope-mismatch',
      goalId: 'control-correction',
    })).rejects.toMatchObject({
      status: 403,
      message: 'Konling 路径工具不能扩展到服务端授权目标之外。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('revises frequency response path options after scoped path preflight', async () => {
    const createdRun = {
      id: 'tool-run-frequency-revise-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'revise_learning_path_options',
      permissionTier: 'write',
      approvalState: 'not_required',
      status: 'running',
      inputSummary: {},
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'frequency-path-revise',
      correlationId: 'corr-frequency-path-revise',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['revise_learning_path_options'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createdRun),
        create: vi.fn().mockResolvedValue(createdRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'frequency-path-1',
          userId: 'student-1',
          goalId: 'frequency-response-foundations',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [{
                styleId: 'recommended',
                nodeIds: ['frequency-precheck'],
              }],
            },
            selectionHistory: [],
            activity: [],
          },
        }),
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
        update: vi.fn().mockResolvedValue({ id: 'frequency-path-1' }),
      },
      learningFact: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      evidenceOutbox: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['revise_learning_path_options'],
        planContext: {
          currentPathId: 'frequency-path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['frequency-path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.reviseLearningPathOptions({
      idempotencyKey: 'frequency-path-revise',
      goalId: 'frequency-response-foundations',
      pathId: 'frequency-path-1',
      difficultyRhythm: 'challenge',
      selectedStyleId: 'recommended',
    })).resolves.toMatchObject({
      operation: 'revised',
      scope: expect.objectContaining({
        goalId: 'frequency-response-foundations',
        pathId: 'frequency-path-1',
      }),
      pathOptions: expect.any(Array),
    });
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'frequency-path-1',
        userId: 'student-1',
        goalId: 'frequency-response-foundations',
      }),
    }));
    expect(db.agentToolRun.create).toHaveBeenCalled();
    expect(db.learningPath.upsert).toHaveBeenCalled();
  });

  it('rejects forged adaptive path ids before creating tool runs or evidence', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-forged-path',
      pathId: 'foreign-path',
      selectedStyleId: 'arena-simulation-sprint',
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects path option ids that are not stored on the scoped learning path', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [{ styleId: 'foundation-remediation', nodeIds: ['node-1'] }],
            },
          },
        }),
        update: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-invalid-style',
      selectedStyleId: 'hallucinated-style',
    })).rejects.toMatchObject({
      status: 403,
      message: '路径选项不属于当前学习路径。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rejects hidden fallback policy bundle options before recording path activity', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            policyBundle: {
              status: 'low-resource-fallback',
              paths: [{ styleId: 'simulation-driven', nodeIds: ['node-1'] }],
            },
          },
        }),
        update: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-hidden-fallback-style',
      selectedStyleId: 'simulation-driven',
    })).rejects.toMatchObject({
      status: 403,
      message: '当前学习路径没有可记录的路径选项。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rejects path activity that selects and rejects the same style id', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['record_path_adjustment_outcome'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'path-1',
          userId: 'student-1',
          pathPayload: {
            policyBundle: {
              status: 'ready',
              paths: [{ styleId: 'simulation-driven', nodeIds: ['node-1'] }],
            },
          },
        }),
        update: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['record_path_adjustment_outcome'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.recordPathAdjustmentOutcome({
      idempotencyKey: 'path-conflicting-style',
      outcome: 'switched',
      selectedStyleId: 'simulation-driven',
      rejectedStyleIds: ['simulation-driven'],
    })).rejects.toMatchObject({
      status: 400,
      message: '路径选择不能同时选择并拒绝同一 styleId。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('rejects path-bound adaptive path tools when no current path is available', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center', pathNodeId: null }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: null,
          activeNodeId: null,
          nextNodeIds: [],
          recentPathIds: [],
          completedNodeIds: [],
          status: 'missing',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-without-current-path',
      selectedStyleId: 'arena-simulation-sprint',
    })).rejects.toMatchObject({
      status: 400,
      message: '当前没有可记录的学习路径。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.learningPath.findFirst).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
  });

  it('rejects tradeoff explanations for path ids outside the requested registered goal', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['explain_learning_path_tradeoff'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.explainLearningPathTradeoff({
      idempotencyKey: 'tradeoff-non-control-path',
      goalId: 'frequency-response-foundations',
      pathId: 'path-1',
      styleId: 'guided',
    })).rejects.toMatchObject({ status: 403 });
    expect(db.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'path-1',
        userId: 'student-1',
        goalId: 'frequency-response-foundations',
        classId: 'class-1',
      }),
    }));
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('rejects unregistered adaptive path goals for tradeoff explanations before creating tool runs', async () => {
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['explain_learning_path_tradeoff'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center', pathNodeId: null }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['explain_learning_path_tradeoff'] }),
    });

    await expect(runtime.explainLearningPathTradeoff({
      idempotencyKey: 'tradeoff-unknown-goal',
      goalId: 'unknown-goal',
      styleId: 'guided',
    })).rejects.toMatchObject({
      status: 403,
      message: 'Konling 路径工具不能扩展到未登记的学习目标。',
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('requires an agent session before executing adaptive path write tools', async () => {
    const db = {
      learningPath: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'path-without-session',
      goalId: 'control-correction',
    })).rejects.toMatchObject({ status: 403 });
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('reuses idempotent adaptive path generation across agent sessions without duplicating active path rounds', async () => {
    const outputSummary = {
      operation: 'generated',
      pathOptions: [{ styleId: 'foundation', label: '基础补强路径' }],
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['generate_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-existing',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          agentSessionId: 'agent-session-previous',
          toolName: 'generate_learning_path',
          permissionTier: 'write',
          approvalState: 'not_required',
          status: 'succeeded',
          inputSummary: {},
          outputSummary,
          errorSummary: null,
          idempotencyKey: 'same-path-key',
          correlationId: 'corr-path-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: new Date('2026-05-28T00:00:01Z'),
          latencyMs: 1000,
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      learningPath: {
        upsert: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({ permittedTools: ['generate_learning_path'] }),
    });

    await expect(runtime.generateLearningPath({
      idempotencyKey: 'same-path-key',
      goalId: 'control-correction',
    })).resolves.toMatchObject(outputSummary);
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.learningPath.upsert).not.toHaveBeenCalled();
  });

  it('reuses idempotent adaptive path choices before validating mutable path options', async () => {
    const outputSummary = {
      outcome: 'selected',
      activity: {
        selectedStyleId: 'previous-style',
      },
      evidence: {
        emitted: true,
        dedupeKey: 'control-correction-path:choice:path-1:select-retry-key',
      },
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-existing',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          agentSessionId: 'agent-session-previous',
          toolName: 'select_learning_path',
          permissionTier: 'write',
          approvalState: 'not_required',
          status: 'succeeded',
          inputSummary: {},
          outputSummary,
          errorSummary: null,
          idempotencyKey: 'select-retry-key',
          correlationId: 'corr-select-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: new Date('2026-05-28T00:00:01Z'),
          latencyMs: 1000,
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      learningPath: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      learningFact: {
        createMany: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };
    const runtime = buildKonlingToolRuntime({
      db,
      scope: createScope({ pageId: 'adaptive-path-center' }),
      agentSessionId: 'agent-session-1',
      context: createRuntimeContext({
        permittedTools: ['select_learning_path'],
        planContext: {
          currentPathId: 'path-1',
          activeNodeId: 'node-1',
          nextNodeIds: [],
          recentPathIds: ['path-1'],
          completedNodeIds: [],
          status: 'available',
        },
      }),
    });

    await expect(runtime.selectLearningPath({
      idempotencyKey: 'select-retry-key',
      selectedStyleId: 'previous-style',
    })).resolves.toMatchObject(outputSummary);
    expect(db.learningPath.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
    expect(db.learningPath.update).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
    expect(db.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('applies intervention cooldowns and persists feedback outcomes', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-1',
          interventionType: 'failure-analysis',
          cooldownUntil: new Date('2026-05-28T00:30:00Z'),
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      konlingMemory: {
        create: vi.fn().mockResolvedValue({
          id: 'mem-1',
          memoryType: 'intervention-outcome',
          privacyScope: 'teacher-scoped',
          summary: '学生对干预 intv-1 的反馈：rated，helpful=true',
          evidenceRefs: [],
          createdAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'path-1',
            userId: 'student-1',
            goalId: 'control-correction',
            pathStatus: 'active',
            currentNodeId: 'node-1',
            nodeIds: ['node-1', 'node-2'],
          },
        ]),
      },
      learningPathIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'path-intv-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };

    const intervention = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: createStudentState(),
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(intervention).toMatchObject({
      shouldIntervene: false,
      reason: 'cooldown-active',
      id: 'intv-1',
    });
    expect(db.aIIntervention.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        sessionId: 'konling:unit-4-5:step-03',
        classId: 'class-1',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(db.aIIntervention.create).not.toHaveBeenCalled();

    const feedback = await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-1',
      feedback: 'rated',
      helpful: true,
      studentResponse: '有帮助，但不要保存 rawDialogue',
    });

    expect(feedback.outcome).toMatchObject({
      feedback: 'rated',
      pathOutcome: 'partially-accepted',
    });
    expect(db.aIIntervention.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'intv-1',
        userId: 'student-1',
        classId: 'class-1',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      },
      data: expect.objectContaining({
        wasHelpful: true,
        outcome: expect.objectContaining({
          feedback: 'rated',
          helpful: true,
        }),
      }),
    }));
    expect(JSON.stringify(db.aIIntervention.updateMany.mock.calls)).not.toContain('rawDialogue');
    expect(db.konlingMemory.create).toHaveBeenCalled();
    expect(db.learningPath.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        goalId: 'control-correction',
        pathStatus: 'active',
      }),
      take: 5,
    }));
    expect(db.learningPathIntervention.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathId: 'path-1',
        userId: 'student-1',
        studentOutcome: 'partially-accepted',
        idempotencyKey: 'konling-feedback:intv-1:rated:helpful:true',
        citedEvidence: expect.arrayContaining([
          expect.objectContaining({ kind: 'ai-intervention', ref: 'intv-1' }),
          expect.objectContaining({ kind: 'learning-path-node', ref: 'node-1' }),
        ]),
      }),
    }));
    expect(JSON.stringify(db.learningPathIntervention.create.mock.calls)).not.toContain('rawDialogue');
    expect(db.evidenceOutbox.createMany).toHaveBeenCalled();
  });

  it('persists intervention feedback for a recently completed path node after the active node advances', async () => {
    const scope = createScope({ pathNodeId: 'node-1' });
    const db = {
      aIIntervention: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-advanced-node',
          interventionType: 'guidance',
          content: '请复盘 node-1 的约束判断。',
          evidence: [{ kind: 'learning-path-node', ref: 'node-1' }],
          whyNow: '节点已完成后的反馈',
        }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'path-1',
          userId: 'student-1',
          goalId: 'control-correction',
          pathStatus: 'active',
          currentNodeId: 'node-2',
          nodeIds: ['node-1', 'node-2'],
        }]),
      },
      learningPathIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'path-intv-advanced', ...data })),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };

    await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-advanced-node',
      feedback: 'accepted',
      helpful: true,
    });

    expect(db.learningPath.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({
        currentNodeId: 'node-1',
      }),
      take: 5,
    }));
    expect(db.learningPathIntervention.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pathId: 'path-1',
        studentOutcome: 'accepted',
      }),
    }));
  });

  it('does not attach intervention feedback to an active path that does not contain the intervention node', async () => {
    const scope = createScope({ pathNodeId: 'node-1' });
    const db = {
      aIIntervention: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-foreign-path',
          interventionType: 'guidance',
          content: '请复盘 node-1 的约束判断。',
          evidence: [{ kind: 'learning-path-node', ref: 'node-1' }],
        }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'path-foreign',
          userId: 'student-1',
          goalId: 'control-correction',
          pathStatus: 'active',
          currentNodeId: 'node-x',
          nodeIds: ['node-x'],
        }]),
      },
      learningPathIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };

    await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-foreign-path',
      feedback: 'accepted',
      helpful: true,
    });

    expect(db.learningPathIntervention.create).not.toHaveBeenCalled();
    expect(db.evidenceOutbox.createMany).not.toHaveBeenCalled();
  });

  it('does not map negative rated feedback to a partially accepted path outcome', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-negative-rated',
          interventionType: 'guidance',
          content: '请回看稳态误差节点。',
          evidence: [{ kind: 'learning-path-node', ref: 'node-1' }],
          whyNow: '连续两次误差判断失准',
        }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'path-1',
          userId: 'student-1',
          goalId: 'control-correction',
          pathStatus: 'active',
          currentNodeId: 'node-1',
          nodeIds: ['node-1'],
        }]),
      },
      learningPathIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'path-intv-negative', ...data })),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };

    const feedback = await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-negative-rated',
      feedback: 'rated',
      helpful: false,
    });

    expect(feedback.outcome).toMatchObject({
      feedback: 'rated',
      helpful: false,
      pathOutcome: 'rejected',
    });
    expect(db.learningPathIntervention.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentOutcome: 'rejected',
        idempotencyKey: 'konling-feedback:intv-negative-rated:rated:helpful:false',
        privacySafeSummary: expect.stringContaining('helpful=false'),
      }),
    }));
  });

  it('does not infer acceptance from rated feedback without helpful evidence', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'intv-unqualified-rated',
          interventionType: 'guidance',
          content: '请回看稳态误差节点。',
          evidence: [{ kind: 'learning-path-node', ref: 'node-1' }],
          whyNow: '缺少可判定的 rated 反馈证据',
        }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
      learningPath: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'path-1',
          userId: 'student-1',
          goalId: 'control-correction',
          pathStatus: 'active',
          currentNodeId: 'node-1',
          nodeIds: ['node-1'],
        }]),
      },
      learningPathIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'path-intv-pending', ...data })),
      },
      evidenceOutbox: {
        createMany: vi.fn(),
      },
    };

    const feedback = await recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'intv-unqualified-rated',
      feedback: 'rated',
    });

    expect(feedback.outcome).toMatchObject({
      feedback: 'rated',
      pathOutcome: 'pending',
    });
    expect(db.learningPathIntervention.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentOutcome: 'pending',
        idempotencyKey: 'konling-feedback:intv-unqualified-rated:rated:helpful:unknown',
      }),
    }));
  });

  it('does not let foreign scoped cooldown records block current interventions', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          if (
            where.classId === 'foreign-class' &&
            where.resourceId === 'foreign-resource' &&
            where.pathNodeId === 'foreign-node'
          ) {
            return {
              id: 'foreign-intv',
              interventionType: 'failure-analysis',
              cooldownUntil: new Date('2026-05-28T00:30:00Z'),
            };
          }
          return null;
        }),
        create: vi.fn().mockResolvedValue({ id: 'intv-current' }),
      },
      konlingMemory: {
        create: vi.fn().mockResolvedValue({
          id: 'mem-1',
          memoryType: 'intervention-outcome',
          privacyScope: 'teacher-scoped',
          summary: 'current intervention',
          evidenceRefs: [],
          createdAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
    };

    const intervention = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: createStudentState(),
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(intervention).toMatchObject({
      shouldIntervene: true,
      id: 'intv-current',
    });
    expect(db.aIIntervention.create).toHaveBeenCalled();
  });

  it('does not persist no-op interventions or feedback outside the current scope', async () => {
    const scope = createScope();
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      konlingMemory: {
        create: vi.fn(),
      },
    };

    const noOp = await createGovernedKonlingIntervention(db, {
      scope,
      studentState: {
        currentTask: '稳定探索',
        currentAttempt: 1,
        attemptHistory: [
          {
            attemptNumber: 1,
            params: { kp: 1 },
            result: { overshoot: 10, settlingTime: 30 },
            isSuccessful: true,
          },
        ],
      },
      now: new Date('2026-05-28T00:00:00Z'),
    });

    expect(noOp).toMatchObject({
      shouldIntervene: false,
      interventionType: 'none',
    });
    expect(db.aIIntervention.create).not.toHaveBeenCalled();

    await expect(recordKonlingInterventionFeedback(db, {
      scope,
      interventionId: 'foreign-intv',
      feedback: 'rated',
      helpful: false,
    })).rejects.toMatchObject({
      status: 404,
    });
    expect(db.konlingMemory.create).not.toHaveBeenCalled();
  });

  it('persists non-verbatim session memory summaries', async () => {
    const db = {
      konlingMemory: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: `${data.memoryType}-1`,
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    await persistKonlingSessionMemories(db, {
      userId: 'student-1',
      sessionId: 'session-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      userMessage: '我不懂，答案是 Kp=3.14159，我的 rawDialogue 和 privateLearnerEvidence 是这些原文',
      assistantMessage: '逐字回答内容 answerData hiddenEvaluation 不应进入记忆',
    });

    const stored = JSON.stringify(db.konlingMemory.create.mock.calls);
    expect(stored).toContain('困惑澄清');
    expect(stored).toContain('class-1');
    expect(stored).toContain('resource-1');
    expect(stored).toContain('node-1');
    expect(stored).not.toContain('3.14159');
    expect(stored).not.toContain('rawDialogue');
    expect(stored).not.toContain('privateLearnerEvidence');
    expect(stored).not.toContain('answerData');
    expect(stored).not.toContain('hiddenEvaluation');
  });

  it('keeps semantic and strategy memory disabled unless later flags enable them', async () => {
    const runtime = await buildKonlingRuntimeContext({}, {
      authenticatedUserId: 'student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5',
      pageId: 'step-03',
    });

    expect(runtime.featureFlags).toMatchObject({
      learnerState: true,
      semanticMemory: false,
      strategyMemory: false,
    });
  });

  it('creates and resumes user-owned task agent sessions without reusing Konling chat history', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'agent-session-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          phase: 'draft-plan',
          status: 'paused',
          stateJson: { step: 2 },
          permittedTools: ['get_page_context'],
          pendingApproval: null,
          expiresAt: new Date('2026-06-04T00:00:00Z'),
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        }),
      },
      konlingSession: {
        findFirst: vi.fn(),
      },
    };

    const created = await createKonlingAgentSession(db, {
      scope,
      phase: 'draft-plan',
      status: 'draft',
      state: { step: 1 },
      permittedTools: ['get_page_context'],
    });
    const resumed = await resumeKonlingAgentSession(db, {
      scope,
      agentSessionId: 'agent-session-1',
      phase: 'draft-plan',
    });

    expect(created).toMatchObject({
      id: 'agent-session-1',
      ownerUserId: 'student-1',
      status: 'draft',
    });
    expect(resumed).toMatchObject({
      id: 'agent-session-1',
      ownerUserId: 'student-1',
      status: 'paused',
      state: { step: 2 },
    });
    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-1',
        ownerUserId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        phase: 'draft-plan',
      }),
    }));
    expect(db.konlingSession.findFirst).not.toHaveBeenCalled();
  });

  it('scopes explicit agent session resume by phase', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(getOrCreateKonlingAgentSession(db, {
      scope,
      agentSessionId: 'agent-session-from-other-phase',
      phase: 'konling-chat-tool-runtime',
      status: 'running',
    })).rejects.toMatchObject({ status: 404 });

    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'agent-session-from-other-phase',
        ownerUserId: 'student-1',
        phase: 'konling-chat-tool-runtime',
      }),
    }));
  });

  it('reuses the latest scoped awaiting approval agent session before creating a new runtime session', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-awaiting',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          phase: 'ai-chat-tool-runtime',
          status: 'awaiting_approval',
          stateJson: { route: '/api/ai/chat' },
          permittedTools: ['set_simulation_params'],
          pendingApproval: { toolRunId: 'tool-run-pending' },
          expiresAt: null,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:05:00Z'),
        }),
        create: vi.fn(),
      },
    };

    const resolved = await getOrCreateKonlingAgentSession(db, {
      scope,
      phase: 'ai-chat-tool-runtime',
      status: 'running',
      state: { route: '/api/ai/chat' },
      permittedTools: ['get_page_context'],
    });

    expect(resolved).toMatchObject({
      id: 'agent-session-awaiting',
      status: 'awaiting_approval',
      pendingApproval: { toolRunId: 'tool-run-pending' },
    });
    expect(db.agentSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerUserId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        phase: 'ai-chat-tool-runtime',
        status: 'awaiting_approval',
      }),
      orderBy: { updatedAt: 'desc' },
    }));
    expect(db.agentSession.create).not.toHaveBeenCalled();
  });

  it('declares durable AgentSession and AgentToolRun persistence contracts in Prisma', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const scopeIdempotencyMigration = readFileSync(
      join(process.cwd(), 'prisma/migrations/20260615111000_add_agent_tool_run_scope_idempotency/migration.sql'),
      'utf8',
    );

    expect(schema).toContain('model AgentSession');
    expect(schema).toMatch(/ownerUserId\s+String/);
    expect(schema).toMatch(/stateJson\s+Json/);
    expect(schema).toMatch(/permittedTools\s+String\[\]/);
    expect(schema).toContain('model AgentToolRun');
    expect(schema).toMatch(/agentSessionId\s+String/);
    expect(schema).toMatch(/approvalState\s+String/);
    expect(schema).toMatch(/correlationId\s+String/);
    expect(schema).toContain('@@unique([agentSessionId, toolName, idempotencyKey])');
    expect(scopeIdempotencyMigration).toContain('BEGIN;');
    expect(scopeIdempotencyMigration).toContain("starts_with(\"idempotencyKey\", '__agent_tool_run_scope_idempotency__:')");
    expect(scopeIdempotencyMigration).toContain('__agent_tool_run_scope_idempotency__:legacy:');
    expect(scopeIdempotencyMigration).toContain('WITH duplicate_scope_tool_runs AS');
    expect(scopeIdempotencyMigration).toContain('ROW_NUMBER() OVER');
    expect(scopeIdempotencyMigration).toContain('__agent_tool_run_scope_idempotency__:duplicate:');
    expect(scopeIdempotencyMigration).toContain('CREATE UNIQUE INDEX "AgentToolRun_scope_idempotency_unique"');
    expect(scopeIdempotencyMigration).toContain('WHERE "idempotencyKey" IS NOT NULL');
    expect(scopeIdempotencyMigration).toContain('COMMIT;');
    for (const field of ['ownerUserId', 'toolName', 'idempotencyKey', 'courseId', 'pageId']) {
      expect(scopeIdempotencyMigration).toContain(`"${field}"`);
    }
    for (const field of ['classId', 'resourceId', 'pathNodeId']) {
      expect(scopeIdempotencyMigration).toContain(`COALESCE("${field}", '__null__')`);
    }
  });

  it('registers tool tiers and routes write tools into approval-required tool runs', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    expect(KONLING_TOOL_REGISTRY.set_simulation_params).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'required',
    });
    expect(KONLING_TOOL_REGISTRY.record_intervention_result).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'required',
    });
    expect(KONLING_TOOL_REGISTRY.generate_learning_path).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.revise_learning_path_options).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.explain_learning_path_tradeoff).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
    });
    expect(KONLING_TOOL_REGISTRY.select_learning_path).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.reject_learning_path_option).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.record_path_adjustment_outcome).toMatchObject({
      permissionTier: 'write',
      approvalPolicy: 'none',
      idempotencyPolicy: 'reuse',
    });
    expect(KONLING_TOOL_REGISTRY.analyze_result).toMatchObject({
      permissionTier: 'analyze',
      approvalPolicy: 'none',
    });

    const toolRun = await startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: {
        kp: 1.8,
        rawDialogue: 'do not store',
        hiddenEvaluation: { score: 99 },
      },
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
    });

    expect(toolRun).toMatchObject({
      id: 'tool-run-1',
      ownerUserId: 'student-1',
      toolName: 'set_simulation_params',
      permissionTier: 'write',
      approvalState: 'required',
      status: 'awaiting_approval',
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
    });
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('rawDialogue');
    expect(JSON.stringify(db.agentToolRun.create.mock.calls)).not.toContain('hiddenEvaluation');
  });

  it('requires approval for teacher-owned adaptive path write tool runs', async () => {
    const scope = createScope({
      authenticatedUserId: 'teacher-1',
      targetUserId: 'student-1',
      role: 'teacher',
      privacyScopes: ['student-visible', 'teacher-scoped'],
    });
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['select_learning_path'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'tool-run-teacher-path-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    const toolRun = await startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'select_learning_path',
      input: {
        pathId: 'path-1',
        selectedStyleId: 'arena-simulation-sprint',
      },
      idempotencyKey: 'teacher-select-path-1',
    });

    expect(toolRun).toMatchObject({
      id: 'tool-run-teacher-path-1',
      ownerUserId: 'student-1',
      actorUserId: 'teacher-1',
      targetUserId: 'student-1',
      toolName: 'select_learning_path',
      permissionTier: 'write',
      approvalState: 'required',
      status: 'awaiting_approval',
    });
    expect(db.agentToolRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        approvalState: 'required',
        status: 'awaiting_approval',
      }),
    }));
  });

  it('enforces scope-scoped idempotency before creating another state-changing tool run', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tool-run-existing',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          agentSessionId: 'agent-session-1',
          toolName: 'set_simulation_params',
          permissionTier: 'write',
          approvalState: 'required',
          status: 'awaiting_approval',
          inputSummary: { kp: 1.8 },
          outputSummary: null,
          errorSummary: null,
          idempotencyKey: 'same-key',
          correlationId: 'corr-existing',
          startedAt: new Date('2026-05-28T00:00:00Z'),
          completedAt: null,
          latencyMs: null,
          createdAt: new Date('2026-05-28T00:00:00Z'),
          updatedAt: new Date('2026-05-28T00:00:00Z'),
        }),
        create: vi.fn(),
      },
    };

    const toolRun = await startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: { kp: 2.0 },
      idempotencyKey: 'same-key',
      correlationId: 'corr-new',
    });

    expect(toolRun).toMatchObject({
      id: 'tool-run-existing',
      idempotencyKey: 'same-key',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalledWith({
      where: {
        ownerUserId: 'student-1',
        toolName: 'set_simulation_params',
        idempotencyKey: 'same-key',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      },
    });
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('reuses a scoped idempotent tool run after concurrent create conflicts', async () => {
    const scope = createScope();
    const existingRun = {
      id: 'tool-run-concurrent',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      classId: 'class-1',
      courseId: 'unit-4-5',
      pageId: 'step-03',
      resourceId: 'resource-1',
      pathNodeId: 'node-1',
      toolName: 'set_simulation_params',
      permissionTier: 'write',
      approvalState: 'required',
      status: 'awaiting_approval',
      inputSummary: { kp: 1.8 },
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'same-key',
      correlationId: 'corr-existing',
      startedAt: new Date('2026-05-28T00:00:00Z'),
      completedAt: null,
      latencyMs: null,
      createdAt: new Date('2026-05-28T00:00:00Z'),
      updatedAt: new Date('2026-05-28T00:00:00Z'),
    };
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: ['set_simulation_params'],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingRun),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      input: { kp: 2.0 },
      idempotencyKey: 'same-key',
      correlationId: 'corr-new',
    })).resolves.toMatchObject({
      id: 'tool-run-concurrent',
      idempotencyKey: 'same-key',
    });
    expect(db.agentToolRun.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rejects foreign agent sessions before creating tool-run side effects', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'foreign-agent-session',
      toolName: 'set_simulation_params',
      input: { kp: 2 },
      idempotencyKey: 'foreign-run',
    })).rejects.toMatchObject({ status: 404 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('treats an empty agent-session permittedTools list as no tool permission', async () => {
    const scope = createScope();
    const db = {
      agentSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-session-1',
          ownerUserId: 'student-1',
          permittedTools: [],
        }),
      },
      agentToolRun: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(startKonlingToolRun(db, {
      scope,
      agentSessionId: 'agent-session-1',
      toolName: 'get_page_context',
      input: {},
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.findFirst).not.toHaveBeenCalled();
    expect(db.agentToolRun.create).not.toHaveBeenCalled();
  });

  it('blocks write tool completion until approval and redacts output and error summaries', async () => {
    const scope = createScope();
    const startedAt = new Date('2026-05-28T00:00:00Z');
    const completedAt = new Date('2026-05-28T00:00:01Z');
    const approvedRun = {
      id: 'tool-run-1',
      ownerUserId: 'student-1',
      actorUserId: 'student-1',
      targetUserId: 'student-1',
      agentSessionId: 'agent-session-1',
      toolName: 'set_simulation_params',
      permissionTier: 'write',
      approvalState: 'approved',
      status: 'running',
      inputSummary: { kp: 1.8 },
      outputSummary: null,
      errorSummary: null,
      idempotencyKey: 'set-pid-1',
      correlationId: 'corr-1',
      startedAt,
      completedAt: null,
      latencyMs: null,
    };
    const db = {
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            ...approvedRun,
            approvalState: 'required',
            status: 'awaiting_approval',
          })
          .mockResolvedValueOnce(approvedRun)
          .mockResolvedValueOnce(approvedRun),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      output: { accepted: true, promptContent: 'secret' },
      now: completedAt,
    })).rejects.toMatchObject({ status: 403 });
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();

    await expect(completeKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      output: { accepted: true, promptContent: 'secret' },
      now: completedAt,
    })).resolves.toEqual({ success: true, status: 'succeeded' });
    await expect(failKonlingToolRun(db, {
      scope,
      toolRunId: 'tool-run-1',
      error: { message: 'failed', rawDialogue: 'secret' },
      now: completedAt,
    })).resolves.toEqual({ success: true, status: 'failed' });

    const updatePayloads = JSON.stringify(db.agentToolRun.updateMany.mock.calls);
    expect(updatePayloads).toContain('"latencyMs":1000');
    expect(updatePayloads).not.toContain('promptContent');
    expect(updatePayloads).not.toContain('rawDialogue');
  });

  it('requires scoped owner writes for long-term Konling memory', async () => {
    const scope = createScope();
    const db = {
      konlingMemory: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          id: 'scoped-memory-1',
          ...data,
          createdAt: new Date('2026-05-28T00:00:00Z'),
        })),
      },
    };

    await expect(createScopedKonlingMemory(db, {
      scope: createScope({ targetUserId: 'student-2' }),
      memoryType: 'episodic',
      summary: 'foreign memory',
      evidenceRefs: [{ kind: 'test', ref: 'foreign' }],
    })).rejects.toMatchObject({ status: 403 });

    const memory = await createScopedKonlingMemory(db, {
      scope,
      memoryType: 'episodic',
      summary: 'student scoped memory with promptContent removed',
      evidenceRefs: [{ kind: 'test', ref: 'owned', promptContent: 'secret' }],
    });

    expect(memory).toMatchObject({
      id: 'scoped-memory-1',
      memoryType: 'episodic',
      privacyScope: 'student-visible',
    });
    expect(db.konlingMemory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'student-1',
        classId: 'class-1',
        courseId: 'unit-4-5',
        pageId: 'step-03',
        resourceId: 'resource-1',
        pathNodeId: 'node-1',
      }),
    }));
    expect(JSON.stringify(db.konlingMemory.create.mock.calls)).not.toContain('promptContent');
  });

  it('builds citeable Source Pack candidates for reviewed path-eligible core resources', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'core-lesson',
        label: 'Core lesson',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/resources/core-lesson',
        knowledgeNodeIds: ['kn-controller'],
        planningOverride: {
          abilityImpact: { controlModeling: 0.25 },
          evidenceInstrumentation: ['lesson_step_view'],
          privacyLevel: 'student-visible',
          readiness: {
            minimumCompetency: { controlModeling: 0.1 },
            minimumEvidenceCount: 1,
            requiredCompletedNodeIds: [],
            requiredOutcomeRefs: [],
            unlockMessage: '完成必要证据后进入。',
            fallbackNodeIds: [],
          },
          pathDisposition: {
            kind: 'path-plannable',
            reviewStatus: 'human-confirmed',
            rationale: 'Reviewed core lesson path node.',
            sourceFamily: 'resource_registry',
            stableSourceRef: 'core-lesson',
            sourceVersionRef: 'resource-node-registry.v1',
            parentResourceNodeId: null,
            reviewedAt: '2026-07-03T00:00:00.000Z',
            reviewerId: 'core-resource-path-readiness-review',
          },
        },
      }],
    });
    const node = registry.nodes.find((item) => item.id === 'registry:core-lesson')!;
    const candidate = buildResourceNodeSourcePackCandidate(node);

    expect(candidate).toMatchObject({
      resourceNodeId: 'registry:core-lesson',
      planningUnitId: 'planning-unit:registry:core-lesson',
      citation: {
        href: '/resources/core-lesson',
        verified: true,
      },
      metadata: {
        pathEligible: 'true',
        resourceType: 'lesson_step',
      },
    });
  });
});

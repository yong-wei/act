import { describe, expect, it } from 'vitest';
import type { CompetencyVector } from '../competency-model';
import {
  ADAPTIVE_GOAL_SLICE_REGISTRY,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
  resolveAdaptiveGoalSliceDefinition,
  validateControlCorrectionGoalSliceContract,
} from '../adaptive-learner-state-service';
import { buildSimulationAgentEvidenceMaterialization } from '../simulation-agent-evidence-materialization';
import { buildMigratedPortraitPayload } from '../portrait-v2-migration';
import { PORTRAIT_V2_DIMENSIONS } from '../kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '../portrait-v2-model';
import { STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION } from '../student-evidence-feature-cache';
import {
  buildAdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlannerInput,
} from '../../adaptive-learning-path-planner';
import { buildControlCorrectionResourceNodeRegistry } from '../../control-correction-resource-seed';

const snapshotVector: CompetencyVector = {
  controlModeling: { score: 78, trend: 'up', confidence: 0.82, evidenceCount: 8, lastUpdated: '2026-05-20T00:00:00.000Z' },
  parameterDesign: { score: 64, trend: 'stable', confidence: 0.68, evidenceCount: 6, lastUpdated: '2026-05-20T00:00:00.000Z' },
  crossDomainTransfer: { score: 58, trend: 'down', confidence: 0.55, evidenceCount: 5, lastUpdated: '2026-05-20T00:00:00.000Z' },
  engineeringDecision: { score: 71, trend: 'stable', confidence: 0.7, evidenceCount: 6, lastUpdated: '2026-05-20T00:00:00.000Z' },
  inquiryReflection: { score: 62, trend: 'stable', confidence: 0.6, evidenceCount: 4, lastUpdated: '2026-05-20T00:00:00.000Z' },
  selfDirectedLearning: { score: 67, trend: 'up', confidence: 0.64, evidenceCount: 4, lastUpdated: '2026-05-20T00:00:00.000Z' },
};

const strongSnapshotVector: CompetencyVector = {
  controlModeling: { score: 90, trend: 'up', confidence: 0.9, evidenceCount: 12, lastUpdated: '2026-05-20T00:00:00.000Z' },
  parameterDesign: { score: 88, trend: 'up', confidence: 0.88, evidenceCount: 11, lastUpdated: '2026-05-20T00:00:00.000Z' },
  crossDomainTransfer: { score: 86, trend: 'up', confidence: 0.86, evidenceCount: 10, lastUpdated: '2026-05-20T00:00:00.000Z' },
  engineeringDecision: { score: 91, trend: 'up', confidence: 0.91, evidenceCount: 12, lastUpdated: '2026-05-20T00:00:00.000Z' },
  inquiryReflection: { score: 87, trend: 'up', confidence: 0.87, evidenceCount: 9, lastUpdated: '2026-05-20T00:00:00.000Z' },
  selfDirectedLearning: { score: 89, trend: 'up', confidence: 0.89, evidenceCount: 9, lastUpdated: '2026-05-20T00:00:00.000Z' },
};

function createDb(overrides: Record<string, unknown> = {}) {
  return {
    studentCompetencySnapshot: {
      findFirst: async () => ({
        snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
        factCount: 8,
        calculationVersion: 'competency-v2',
        competencyVector: snapshotVector,
        evidenceSummary: {},
      }),
    },
    studentProfileSummary: {
      findUnique: async () => ({
        updatedAt: new Date('2026-05-20T01:00:00.000Z'),
        overallLevel: '良好',
        overallScore: 66,
        strengthsJson: ['建模分析'],
        weaknessesJson: ['跨域迁移'],
        recentTrend: '稳步提升',
        trendDirection: 'up',
        riskFlagsJson: ['跨域迁移证据不足'],
        riskLevel: 'medium',
        recommendedScaffolding: '先补齐频域到时域迁移练习',
      }),
    },
    studentEvidenceFeatureCache: {
      findUnique: async () => ({
        userId: 'student-1',
        payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
        refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
        evidenceWindow: {
          firstStartedAt: '2026-05-01T00:00:00.000Z',
          lastStartedAt: '2026-05-19T00:00:00.000Z',
          daysCovered: 18,
        },
        sourceCounts: {
          LearningFact: 3,
          StudentCompetencySnapshot: 1,
          StudentProfileSummary: 1,
          byFactType: { question: 1, media: 1, simulation: 1 },
        },
        sourceCoverage: {
          LearningFact: 'partial',
          StudentCompetencySnapshot: 'available',
          StudentProfileSummary: 'available',
        },
        confidenceMarkers: {
          level: 'medium',
          score: 0.68,
          evidenceCount: 3,
          sourceCompleteness: 0.67,
        },
        statusMarkers: ['partial'],
        features: {
          approvedAggregates: {
            latestSnapshot: {
              snapshotAt: '2026-05-20T00:00:00.000Z',
              factCount: 8,
              calculationVersion: 'competency-v2',
              competencyVector: snapshotVector,
            },
            profileSummary: {
              updatedAt: '2026-05-20T01:00:00.000Z',
              overallScore: 66,
              riskLevel: 'medium',
              trendDirection: 'up',
            },
          },
          adaptiveLearnerState: {
            payloadVersion: 'adaptive-learner-state.v1',
            sourceCoverage: {
              primaryCompetencies: 'available',
              knowledgeMastery: 'partial',
              simulationArena: 'available',
            },
            confidence: {
              level: 'medium',
              score: 0.68,
              markers: ['partial'],
            },
          },
          simulationArena: {
            allTime: {
              evidenceCount: 1,
              weakMetrics: [{ metricId: 'settlingTime', affectedFactCount: 1, lowestValue: 0.42 }],
              qualityMarkers: ['partial'],
              replayConfidence: { average: 0.81, highConfidenceCount: 1, lowConfidenceCount: 0, missingCount: 0 },
              sourceCoverage: { simulation: 'available', arena: 'missing', traceReferences: 'available', replayConfidence: 'available' },
            },
          },
        },
      }),
    },
    learningFact: {
      findMany: async () => [
        {
          id: 'fact-question',
          factType: 'question',
          moduleId: 'adaptive-assessment',
          lessonId: null,
          startedAt: new Date('2026-05-19T00:00:00.000Z'),
          finishedAt: new Date('2026-05-19T00:03:00.000Z'),
          outcome: 'success',
          score: 86,
          timeSpent: 180,
          contextJson: governedContext({ adaptiveAssessment: { knowledgeTags: ['root-locus'] } }),
        },
        {
          id: 'fact-media',
          factType: 'media',
          moduleId: 'unit-3-4',
          lessonId: 'unit-3-4-root-locus-reading-validation',
          startedAt: new Date('2026-05-18T00:00:00.000Z'),
          finishedAt: new Date('2026-05-18T00:10:00.000Z'),
          outcome: 'partial',
          score: 55,
          timeSpent: 600,
          contextJson: governedContext({ media: { mediaType: 'video', progress: 0.58 } }),
        },
        {
          id: 'fact-sim',
          factType: 'simulation',
          moduleId: 'simulation/cruise',
          lessonId: null,
          startedAt: new Date('2026-05-17T00:00:00.000Z'),
          finishedAt: new Date('2026-05-17T00:12:00.000Z'),
          outcome: 'success',
          score: 72,
          timeSpent: 720,
          contextJson: governedContext({ simulation: { launchMode: 'course-resource' } }),
        },
      ],
    },
    arenaSubmission: {
      findMany: async () => [],
    },
    adaptiveMasteryUpdate: {
      findMany: async () => [
        {
          knowledgeTag: 'root-locus',
          posteriorMastery: 0.76,
          confidence: 0.82,
          evidenceKind: 'adaptive-assessment',
          algorithmVersion: 'adaptive-assessment-bkt-v1',
          createdAt: new Date('2026-05-19T00:03:00.000Z'),
        },
      ],
    },
    adaptiveAssessmentAbilityEstimate: {
      findFirst: async () => ({
        theta: 0.42,
        confidenceLow: -0.08,
        confidenceHigh: 0.92,
        dimensions: { computationalTheta: 0.4, crossDomainTheta: 0.2, designTheta: 0.3 },
        algorithmVersion: 'adaptive-assessment-bkt-v1',
        estimatedAt: new Date('2026-05-19T00:03:00.000Z'),
      }),
    },
    studentRiskFlag: {
      findMany: async () => [
        {
          flagType: 'cross_domain',
          severity: 'medium',
          description: '跨域迁移证据不足',
          evidenceJson: { source: 'snapshot' },
          triggeredAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ],
    },
    learningPath: {
      findMany: async () => [
        {
          id: 'path-1',
          title: '根轨迹补强路径',
          nodeIds: ['node-a', 'node-b'],
          isAiGenerated: true,
          isBookmarked: true,
          goalId: 'control-correction',
          pathStatus: 'active',
          currentNodeId: 'node-a',
          terminalValidation: { state: 'pending' },
          lastExecutionMetadata: { lowConfidenceMarkers: ['arena-preview-only'] },
          updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ],
    },
    ...overrides,
  };
}

function evidenceWindow() {
  return {
    firstStartedAt: '2026-05-01T00:00:00.000Z',
    lastStartedAt: '2026-05-19T00:00:00.000Z',
    daysCovered: 18,
  };
}

function simulationArenaWindow(overrides: Record<string, unknown> = {}) {
  return {
    window: evidenceWindow(),
    evidenceCount: 3,
    completedCount: 3,
    officialCount: 1,
    previewCount: 1,
    agentAssistedCount: 0,
    courseLaunchedCount: 2,
    standaloneCount: 1,
    traceReferenceCount: 0,
    sourceCoverage: {
      simulation: 'available',
      arena: 'available',
      traceReferences: 'available',
      replayConfidence: 'available',
    },
    replayConfidence: {
      average: 0.82,
      highConfidenceCount: 2,
      lowConfidenceCount: 0,
      missingCount: 0,
    },
    interventionOutcome: {
      reviewedCount: 0,
      improvedCount: 0,
      lowConfidenceCount: 0,
    },
    weakMetrics: [],
    qualityMarkers: [],
    traceReferences: [],
    ...overrides,
  };
}

function pathExecutionWindow(overrides: Record<string, unknown> = {}) {
  return {
    window: evidenceWindow(),
    evidenceCount: 0,
    adoptionCount: 0,
    completionCount: 0,
    deviationCount: 0,
    fallbackCount: 0,
    terminalValidationCount: 0,
    sourceCoverage: {
      adoption: 'missing',
      completion: 'missing',
      deviation: 'missing',
      fallback: 'missing',
      terminalValidation: 'missing',
      interventionOutcome: 'missing',
    },
    confidence: {
      level: 'none',
      score: 0,
      lowConfidenceCount: 0,
    },
    interventionOutcome: {
      acceptedCount: 0,
      completedCount: 0,
      dismissedCount: 0,
      lowConfidenceCount: 0,
    },
    terminalValidation: {
      latestState: null,
      completedCount: 0,
      failedCount: 0,
      lowConfidenceCount: 0,
      fallbackRequiredCount: 0,
      lowConfidenceMarkers: [],
      failureReasons: [],
    },
    sourceReferences: [],
    ...overrides,
  };
}

function pathExecutionFeature(overrides: Record<string, unknown> = {}) {
  return {
    recent30d: pathExecutionWindow(),
    allTime: pathExecutionWindow(),
    ...overrides,
  };
}

function governedContext(context: Record<string, unknown> = {}) {
  const declaredGovernance = context.evidenceGovernance;
  const evidenceGovernance = declaredGovernance && typeof declaredGovernance === 'object' && !Array.isArray(declaredGovernance)
    ? declaredGovernance
    : {};
  return {
    ...context,
    evidenceGovernance: {
      evidenceQuality: 'rich',
      profileWeight: 1,
      skipProfileContribution: false,
      policyReason: 'rich_objective_evidence',
      ...evidenceGovernance,
    },
  };
}

function controlCorrectionFact(
  factType: string,
  startedAt: string,
  score: number,
  overrides: Record<string, unknown> = {},
) {
  const { contextJson, ...rest } = overrides;
  return {
    id: `fact-${factType}-${startedAt}`,
    factType,
    startedAt: new Date(startedAt),
    score,
    contextJson: governedContext({
      goalId: 'control-correction',
      ...(contextJson && typeof contextJson === 'object' && !Array.isArray(contextJson)
        ? contextJson as Record<string, unknown>
        : {}),
    }),
    ...rest,
  };
}

function officialArenaSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'arena-submission-1',
    userId: 'student-1',
    taskId: 'task-second-order-lead-pid',
    method: 'pid',
    valid: true,
    submittedAt: new Date('2026-05-19T01:00:00.000Z'),
    controllerArtifact: {
      payload: { method: 'pid' },
    },
    evaluationRun: {
      protocolVersion: 'analysis-whitebox-v1',
    },
    ...overrides,
  };
}

function acceptedArenaWritebackOutboxRow(submissionId = 'arena-submission-1') {
  return {
    causationId: submissionId,
    status: 'processed',
    payload: {
      evidenceWriteback: {
        status: 'accepted',
        sourceRef: { kind: 'ArenaSubmission', id: submissionId },
        attemptStatus: 'effective',
        visibilityState: 'materialized',
        targetLabel: '控制校正 Arena 官方迁移验证',
        summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
        recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
        limitationCodes: [],
        overlayCount: 1,
        terminalValidationAccepted: true,
      },
    },
  };
}

function adaptiveLearnerStateFeature(overrides: Record<string, unknown> = {}) {
  return {
    payloadVersion: 'adaptive-learner-state.v1',
    sourceWindows: {
      learnerStateRecent30d: evidenceWindow(),
      learnerStateAllTime: evidenceWindow(),
    },
    sourceCounts: {
      LearningFact: 8,
      AdaptiveMasteryEvidence: 1,
    },
    sourceCoverage: {
      primaryCompetencies: 'available',
      knowledgeMastery: 'available',
      resourcePreference: 'available',
      mediaAbsorption: 'available',
      pathContext: 'available',
      simulationArena: 'available',
    },
    confidence: {
      level: 'high',
      score: 0.9,
      evidenceCount: 8,
      sourceCompleteness: 1,
      markers: [],
    },
    ...overrides,
  };
}

function fencedPortraitDb(
  currentState: Record<string, unknown> | null | undefined,
) {
  return createDb({
    cumulativePortraitCutoverFence: {
      findUnique: async () => currentState === undefined
        ? null
        : {
            fence: BigInt(1),
            calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
            learnerGeneration: BigInt(1),
            queueGeneration: BigInt(1),
            activeMigrationRunId: 'migration-1',
          },
    },
    cumulativePortraitMigrationRun: {
      findUnique: async () => currentState === undefined
        ? null
        : {
            id: 'migration-1',
            mode: 'APPLY',
            status: 'COMPLETED',
            calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
            learnerGeneration: BigInt(1),
            queueGeneration: BigInt(1),
            cutoverFence: BigInt(1),
          },
    },
    learnerPortraitCurrentState: {
      findUnique: async () => currentState === undefined
        ? null
        : currentState,
    },
  });
}

describe('adaptive learner state service', () => {
  it('exposes registered goal-slice metadata for control-correction', () => {
    const definition = resolveAdaptiveGoalSliceDefinition('control-correction');

    expect(definition).toBe(ADAPTIVE_GOAL_SLICE_REGISTRY['control-correction']);
    expect(definition).toMatchObject({
      goalId: 'control-correction',
      payloadVersion: 'control-correction-goal-slice.v1',
      eligibility: {
        path: 'declared',
        report: 'declared',
        konling: 'declared',
        grading: 'not-declared',
      },
      confidencePolicy: 'dimension confidence is capped by source coverage and fallback markers',
    });
    expect(definition?.dimensions.map((dimension) => dimension.id)).toEqual(CONTROL_CORRECTION_GOAL_DIMENSIONS);
    expect(definition?.dimensions[0]).toMatchObject({
      valueRange: '0-100',
      sourceFamilies: expect.arrayContaining(['StudentCompetencySnapshot', 'LearningFact']),
      privacy: expect.objectContaining({
        score: 'student-visible',
        rawPayloads: 'system-internal',
      }),
      fallbackReason: 'missing-control-correction-governed-evidence',
    });
    expect(definition?.fieldFamilies.pathContext).toMatchObject({
      valueRange: 'active path id/status/current node, terminal validation state, recent path references, no-active-path marker',
      privacyScope: 'student-visible',
      fallbackReason: 'path-planning-not-started',
    });
  });

  it('keeps learner state server-owned and ignores client hints as authority', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      clientHints: {
        primaryCompetencies: {
          controlModeling: { score: 100 },
        },
      },
    });

    expect(isAdaptiveLearnerStateServiceEnabled({ ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED: 'true' })).toBe(true);
    expect(isAdaptiveLearnerStateServiceEnabled({ ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED: 'false' })).toBe(false);
    expect(state.authority).toBe('server-owned');
    expect(state.clientHints).toMatchObject({
      received: true,
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    });
    expect(state.primaryCompetencies.vector.controlModeling.score).toBe(78);
    expect(state.secondaryDimensions.conceptMastery).toMatchObject({
      primaryDimension: 'controlModeling',
      value: 78,
      confidence: 0.82,
    });
    expect(state.knowledgeMastery.tags['root-locus']).toMatchObject({
      posteriorMastery: 0.76,
      confidence: 0.82,
      source: 'adaptive-assessment',
    });
    expect(state.resourcePreference).toMatchObject({
      preferredModalities: ['assessment', 'media', 'simulation'],
    });
    expect(state.mediaAbsorption).toMatchObject({
      mediaFactCount: 1,
      averageCompletion: 0.58,
      confidence: 'low',
    });
    expect(state.pathContext).toMatchObject({
      activePathCount: 1,
      bookmarkedPathCount: 1,
      activeControlCorrectionPath: {
        state: 'active',
        pathId: 'path-1',
        status: 'active',
        currentNodeId: 'node-a',
        terminalValidationState: 'pending',
        lowConfidenceMarkers: ['arena-preview-only'],
      },
    });
    expect(state.risks).toEqual({
      riskLevel: 'redacted',
      activeFlags: [],
    });
    expect(state.evidence.statusMarkers).toEqual(expect.arrayContaining(['partial']));
    expect(state.prerequisiteFeatureGroups.simulationArena).toMatchObject({
      evidenceCount: 1,
      weakMetrics: [{ metricId: 'settlingTime', affectedFactCount: 1, lowestValue: 0.42 }],
    });
    expect(ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.knowledgeMastery).toMatchObject({
      privacyScope: 'student-visible',
      confidencePolicy: 'assessment-backed-mastery',
    });
  });

  it('excludes ungoverned facts from resource preference and media absorption', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [{
          id: 'unmanaged-media', factType: 'media', moduleId: 'unit-3-4',
          startedAt: new Date('2026-05-19T00:00:00.000Z'), finishedAt: new Date('2026-05-19T00:10:00.000Z'),
          outcome: 'success', score: 80, timeSpent: 600,
          contextJson: { media: { mediaType: 'video', progress: 0.9 } },
        }],
      },
    }), { userId: 'student-1', role: 'student', now: new Date('2026-05-20T03:00:00.000Z') });

    expect(state.resourcePreference.preferredModalities).toEqual([]);
    expect(state.mediaAbsorption.mediaFactCount).toBe(0);
  });

  it('excludes zero-weight and skipped facts from resource preference and media absorption', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          {
            id: 'context-only-media', factType: 'media', moduleId: 'unit-3-4',
            startedAt: new Date('2026-05-19T00:00:00.000Z'), finishedAt: new Date('2026-05-19T00:10:00.000Z'),
            outcome: 'success', score: 80, timeSpent: 600,
            contextJson: {
              media: { mediaType: 'video', progress: 0.9 },
              evidenceGovernance: {
                evidenceQuality: 'context-only', profileWeight: 0,
                skipProfileContribution: false, policyReason: 'context-only-source',
              },
            },
          },
          {
            id: 'skipped-simulation', factType: 'simulation', moduleId: 'unit-3-4',
            startedAt: new Date('2026-05-19T00:00:00.000Z'), finishedAt: new Date('2026-05-19T00:10:00.000Z'),
            outcome: 'success', score: 80, timeSpent: 600,
            contextJson: {
              evidenceGovernance: {
                evidenceQuality: 'context-only', profileWeight: 1,
                skipProfileContribution: true, policyReason: 'context-only-source',
              },
            },
          },
        ],
      },
    }), { userId: 'student-1', role: 'student', now: new Date('2026-05-20T03:00:00.000Z') });

    expect(state.resourcePreference.preferredModalities).toEqual([]);
    expect(state.mediaAbsorption.mediaFactCount).toBe(0);
  });

  it('pages past context-only facts before deriving resource and media preferences', async () => {
    const contextOnlyFacts = Array.from({ length: 101 }, (_, index) => ({
      id: `context-only-${index}`,
      factType: 'simulation',
      moduleId: 'unit-3-4',
      startedAt: new Date('2026-05-19T00:00:00.000Z'),
      finishedAt: new Date('2026-05-19T00:10:00.000Z'),
      outcome: 'success',
      score: 80,
      timeSpent: 600,
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'context-only',
          profileWeight: 0,
          skipProfileContribution: true,
          policyReason: 'context-only-source',
        },
      },
    }));
    const rows = [...contextOnlyFacts, {
      id: 'eligible-media',
      factType: 'media',
      moduleId: 'unit-3-4',
      startedAt: new Date('2026-05-18T00:00:00.000Z'),
      finishedAt: new Date('2026-05-18T00:10:00.000Z'),
      outcome: 'success',
      score: 90,
      timeSpent: 600,
      contextJson: {
        media: { mediaType: 'video', progress: 0.9 },
        evidenceGovernance: {
          evidenceQuality: 'governed',
          profileWeight: 1,
          skipProfileContribution: false,
          policyReason: 'approved-source',
        },
      },
    }];
    const calls: Array<{ cursor?: { id: string } }> = [];
    const findMany = async (args: { cursor?: { id: string }; take?: number }) => {
      calls.push(args);
      const start = args.cursor
        ? rows.findIndex((fact) => fact.id === args.cursor?.id) + 1
        : 0;
      return rows.slice(start, start + (args.take ?? 100));
    };

    const state = await readAdaptiveLearnerState(createDb({ learningFact: { findMany } }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.resourcePreference).toMatchObject({
      preferredModalities: ['media'],
      sourceCounts: { media: 1 },
    });
    expect(state.mediaAbsorption).toMatchObject({ mediaFactCount: 1, averageCompletion: 0.9 });
    expect(calls).toContainEqual(expect.objectContaining({ cursor: { id: 'context-only-99' } }));
  });

  it.each([
    ['migration-in-progress', undefined],
    ['current-state-unavailable', null],
    ['no-evidence-after-revocation', {
      userId: 'student-fenced',
      stateVersionId: 'state-no-evidence',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: BigInt(1),
      queueGeneration: BigInt(1),
      stateWatermark: BigInt(1),
      cutoverFence: BigInt(1),
      stateVersion: {
        id: 'state-no-evidence',
        userId: 'student-fenced',
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: BigInt(1),
        queueGeneration: BigInt(1),
        stateWatermark: BigInt(1),
        stateKind: 'NO_EVIDENCE',
        snapshotId: null,
        overallScore: null,
        dimensionCoverage: {
          evidencedDimensionIds: [],
          missingDimensionIds: [],
        },
        evidenceAsOf: null,
        confidence: null,
        lastTrend: null,
        lastRisk: [],
        availabilityReason: 'no-evidence-after-revocation',
        generatedAt: new Date('2026-05-20T03:00:00.000Z'),
        cutoverFence: BigInt(1),
        migrationRunId: 'migration-1',
        snapshot: null,
      },
    }],
  ] as const)('keeps %s fallback Portrait v2 derivation governed', async (_, currentState) => {
    const state = await readAdaptiveLearnerState(
      fencedPortraitDb(currentState),
      {
        userId: 'student-fenced',
        role: 'student',
        now: new Date('2026-05-20T03:00:00.000Z'),
      },
    );

    expect(state.primaryPortrait?.derivation.limitations).toEqual([
      'legacy-six-dimensional-input-is-non-authoritative',
    ]);
  });

  it('uses path choice resource mix as preference evidence without changing mastery', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          {
            id: 'fact-question',
            factType: 'question',
            moduleId: 'adaptive-assessment',
            lessonId: null,
            startedAt: new Date('2026-05-19T00:00:00.000Z'),
            finishedAt: new Date('2026-05-19T00:03:00.000Z'),
            outcome: 'success',
            score: 86,
            timeSpent: 180,
            contextJson: { adaptiveAssessment: { knowledgeTags: ['root-locus'] } },
          },
          {
            id: 'fact-path-choice',
            factType: 'control_correction_path.selection_recorded',
            moduleId: 'control-correction-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:00:00.000Z'),
            finishedAt: new Date('2026-05-18T00:02:00.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 120,
            contextJson: {
              goalId: 'frequency-response-foundations',
              preferenceEvidence: {
                action: 'selection',
                resourceMix: {
                  simulation: 3,
                  arena_task: 2,
                },
              },
            },
          },
          {
            id: 'fact-path-helpfulness',
            factType: 'control_correction_path.helpfulness_recorded',
            moduleId: 'control-correction-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:04:00.000Z'),
            finishedAt: new Date('2026-05-18T00:05:00.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 60,
            contextJson: {
              preferenceEvidence: {
                action: 'helpfulness',
                helpful: true,
                resourceMix: {
                  media: 1,
                },
              },
            },
          },
          {
            id: 'fact-generic-path-choice',
            factType: 'learning_path.selection_recorded',
            moduleId: 'frequency-response-foundations-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:05:30.000Z'),
            finishedAt: new Date('2026-05-18T00:06:00.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 30,
            contextJson: {
              goalId: 'frequency-response-foundations',
              preferenceEvidence: {
                action: 'selection',
                resourceMix: {
                  knowledge_card: 2,
                },
              },
            },
          },
          {
            id: 'fact-unregistered-generic-path-choice',
            factType: 'learning_path.selection_recorded',
            moduleId: 'unregistered-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:06:15.000Z'),
            finishedAt: new Date('2026-05-18T00:06:30.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 15,
            contextJson: {
              goalId: 'unregistered-goal',
              preferenceEvidence: {
                action: 'selection',
                resourceMix: {
                  handout: 9,
                },
              },
            },
          },
          {
            id: 'fact-missing-goal-generic-path-choice',
            factType: 'learning_path.selection_recorded',
            moduleId: 'missing-goal-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:06:35.000Z'),
            finishedAt: new Date('2026-05-18T00:06:45.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 10,
            contextJson: {
              preferenceEvidence: {
                action: 'selection',
                resourceMix: {
                  quiz: 7,
                },
              },
            },
          },
          {
            id: 'fact-path-rejection',
            factType: 'control_correction_path.rejection_recorded',
            moduleId: 'control-correction-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:06:00.000Z'),
            finishedAt: new Date('2026-05-18T00:07:00.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 60,
            contextJson: {
              preferenceEvidence: {
                action: 'rejection',
                resourceMix: {
                  video: 9,
                },
              },
            },
          },
          {
            id: 'fact-path-negative-helpfulness',
            factType: 'control_correction_path.helpfulness_recorded',
            moduleId: 'control-correction-path-advisor',
            lessonId: null,
            startedAt: new Date('2026-05-18T00:08:00.000Z'),
            finishedAt: new Date('2026-05-18T00:09:00.000Z'),
            outcome: 'success',
            score: null,
            timeSpent: 60,
            contextJson: {
              preferenceEvidence: {
                action: 'helpfulness',
                helpful: false,
                resourceMix: {
                  worksheet: 8,
                },
              },
            },
          },
        ].map((fact) => ({
          ...fact,
          contextJson: governedContext(fact.contextJson),
        })),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.resourcePreference.sourceCounts).toMatchObject({
      simulation: 3,
      arena_task: 2,
      knowledge_card: 2,
      assessment: 1,
      media: 1,
    });
    expect(state.resourcePreference.sourceCounts).not.toHaveProperty('control_correction_path.helpfulness_recorded');
    expect(state.resourcePreference.sourceCounts).not.toHaveProperty('video');
    expect(state.resourcePreference.sourceCounts).not.toHaveProperty('worksheet');
    expect(state.resourcePreference.sourceCounts).not.toHaveProperty('handout');
    expect(state.resourcePreference.sourceCounts).not.toHaveProperty('quiz');
    expect(state.resourcePreference.preferredModalities.slice(0, 2)).toEqual(['simulation', 'arena_task']);
    expect(state.knowledgeMastery.tags['root-locus']).toMatchObject({
      posteriorMastery: 0.76,
      confidence: 0.82,
      source: 'adaptive-assessment',
    });
  });

  it('surfaces missing and low-confidence evidence instead of synthesizing precise state', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => null },
      studentProfileSummary: { findUnique: async () => null },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      learningFact: { findMany: async () => [] },
      adaptiveMasteryUpdate: { findMany: async () => [] },
      adaptiveAssessmentAbilityEstimate: { findFirst: async () => null },
      studentRiskFlag: { findMany: async () => [] },
      learningPath: { findMany: async () => [] },
    }), {
      userId: 'student-2',
      role: 'system',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.primaryCompetencies.source).toBe('fallback-empty');
    expect(state.knowledgeMastery.coverage).toBe('missing');
    expect(state.evidence.confidence.level).toBe('none');
    expect(state.evidence.statusMarkers).toEqual(expect.arrayContaining(['missing-source', 'low-confidence']));
    expect(state.missingEvidence).toEqual(expect.arrayContaining([
      'StudentCompetencySnapshot',
      'StudentProfileSummary',
      'AdaptiveMasteryUpdate',
      'StudentEvidenceFeatureCache',
    ]));
  });

  it('derives legacy-shaped learner-state fields from a v2-only portrait', async () => {
    const now = new Date('2026-05-20T03:00:00.000Z');
    const scores = {
      controlModelingRepresentation: 78,
      systemAnalysisInterpretation: 78,
      controllerDesignSynthesis: 64,
      engineeringConstraintSafety: 71,
      simulationValidationEvidence: 20,
      transferIntegratedApplication: 58,
      reflectionImprovementAiCollab: 62,
    } as const;
    const portrait = createPortraitV2Payload({
      userId: 'student-v2-only',
      generatedAt: now.toISOString(),
      now,
      dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }, index) => ({
        id,
        score: scores[id],
        confidence: 0.1,
        trend: 'stable' as const,
        freshness: { state: 'current' as const, asOf: now.toISOString(), evidenceAgeDays: 0 },
        evidenceSummary: { totalCount: 8, sourceFamilyCounts: { LearningFact: 8 } },
        lastPositiveEvidenceAt: now.toISOString(),
        lastNegativeEvidenceAt: null,
        rationale: 'Governed evidence supports the current score.',
        limitations: [],
        sourceLineage: [
          { kind: 'evidence-family' as const, ref: 'LearningFact', privacyScope: 'student-visible' as const },
          { kind: 'citation' as const, ref: `citation-target:sha256:${index.toString(16).padStart(64, '0')}`, privacyScope: 'student-visible' as const },
          { kind: 'hashed' as const, ref: `sar:evidence:sha256:${index.toString(16).padStart(64, '0')}`, privacyScope: 'student-visible' as const },
          { kind: 'aggregate' as const, ref: `aggregate:sha256:${index.toString(16).padStart(64, '0')}`, privacyScope: 'student-visible' as const },
        ],
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      })),
      derivation: { kind: 'native', limitations: [] },
    });
    const conflictingLegacyVector = Object.fromEntries(Object.entries(snapshotVector).map(([dimension, value]) => [
      dimension,
      { ...value, score: 10 },
    ])) as unknown as CompetencyVector;
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => ({
        id: 'legacy-conflict',
        snapshotAt: now,
        competencyVector: conflictingLegacyVector,
      }) },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      learningFact: { findMany: async () => [controlCorrectionFact('question', '2026-05-20T01:00:00.000Z', 0.8)] },
      studentPortraitV2Snapshot: { findFirst: async () => ({
        id: 'portrait-v2-only',
        userId: 'student-v2-only',
        snapshotAt: new Date(portrait.generatedAt),
        payloadVersion: portrait.payloadVersion,
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        migrationVersion: portrait.migrationVersion,
        derivationKind: portrait.derivation.kind,
        payload: portrait,
      }) },
    }), {
      userId: 'student-v2-only',
      role: 'system',
      now,
      goal: 'control-correction',
    });

    expect(state.primaryCompetencies.source).toBe('portrait-v2-derived');
    expect(state.primaryPortrait?.dimensions.find((dimension) => dimension.id === 'controlModelingRepresentation')?.score).toBe(snapshotVector.controlModeling.score);
    expect(state.primaryCompetencies.vector.controlModeling.score).toBe(snapshotVector.controlModeling.score);
    expect(state.primaryCompetencies.vector.controlModeling.confidence).toBeCloseTo(0.1);
    expect(state.primaryCompetencies.vector.controlModeling.evidenceCount).toBe(snapshotVector.controlModeling.evidenceCount);
    expect(state.secondaryDimensions.conceptMastery.value).toBe(snapshotVector.controlModeling.score);
    expect(state.secondaryDimensions.solutionStability.value).toBe(snapshotVector.engineeringDecision.score);
    expect(state.missingEvidence).not.toEqual(expect.arrayContaining([
      'StudentCompetencySnapshot',
      'StudentEvidenceFeatureCache',
    ]));
    const goalDimensions = state.goalSlices?.controlCorrection?.dimensions ?? [];
    expect(goalDimensions.find((dimension) => dimension.id === 'simulation-validation')?.score).toBe(
      portrait.dimensions.find((dimension) => dimension.id === 'simulationValidationEvidence')?.score,
    );
    expect(goalDimensions.find((dimension) => dimension.id === 'frequency-domain-margin-analysis')?.score).toBe(
      portrait.dimensions.find((dimension) => dimension.id === 'systemAnalysisInterpretation')?.score,
    );
    expect(goalDimensions.find((dimension) => dimension.id === 'root-locus-reasoning')?.score).toBe(
      Math.round(((portrait.dimensions.find((dimension) => dimension.id === 'systemAnalysisInterpretation')?.score ?? 0)
        + (portrait.dimensions.find((dimension) => dimension.id === 'controllerDesignSynthesis')?.score ?? 0)) / 2),
    );
    const tracedCapabilities = Object.values(state.masteryTraceability?.capabilityTargets ?? {})
      .filter((target) => target.supportingEvidenceRefs.length > 0);
    expect(tracedCapabilities.length).toBeGreaterThan(0);
    expect(tracedCapabilities.every((target) => target.confidence <= 0.1)).toBe(true);

    const partiallyCurrentPortrait = structuredClone(portrait);
    const staleReflection = partiallyCurrentPortrait.dimensions.find(
      (dimension) => dimension.id === 'reflectionImprovementAiCollab',
    );
    if (!staleReflection) throw new Error('expected reflection dimension');
    staleReflection.freshness = {
      state: 'partial',
      asOf: '2026-04-19T03:00:00.000Z',
      evidenceAgeDays: 31,
    };
    staleReflection.lastPositiveEvidenceAt = '2026-04-19T03:00:00.000Z';
    const partialState = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => ({
        id: 'legacy-partial-fallback',
        snapshotAt: now,
        competencyVector: conflictingLegacyVector,
      }) },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      studentPortraitV2Snapshot: { findFirst: async () => ({
        id: 'portrait-v2-partial',
        userId: 'student-v2-only',
        snapshotAt: now,
        payloadVersion: partiallyCurrentPortrait.payloadVersion,
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        migrationVersion: partiallyCurrentPortrait.migrationVersion,
        derivationKind: partiallyCurrentPortrait.derivation.kind,
        payload: partiallyCurrentPortrait,
      }) },
    }), { userId: 'student-v2-only', role: 'system', now, goal: 'control-correction' });

    expect(partialState.primaryCompetencies.source).toBe('portrait-v2-mixed');
    expect(partialState.secondaryDimensions.conceptMastery.value).toBe(78);
    expect(partialState.secondaryDimensions.explanationQuality.value).toBe(10);
    expect(partialState.goalSlices?.controlCorrection?.dimensions
      .find((dimension) => dimension.id === 'simulation-validation')?.score).toBe(20);
  });

  it('does not derive legacy-shaped fields from a portrait that has aged out at read time', async () => {
    const generatedAt = new Date('2026-05-20T03:00:00.000Z');
    const portrait = buildMigratedPortraitPayload({
      id: 'legacy-v2-stale-at-read',
      userId: 'student-v2-stale',
      snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
      competencyVector: snapshotVector,
    }, generatedAt);
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => null },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      studentPortraitV2Snapshot: { findFirst: async () => ({
        id: 'portrait-v2-stale',
        userId: 'student-v2-stale',
        snapshotAt: generatedAt,
        payloadVersion: portrait.payloadVersion,
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        migrationVersion: portrait.migrationVersion,
        derivationKind: portrait.derivation.kind,
        payload: portrait,
      }) },
    }), {
      userId: 'student-v2-stale',
      role: 'system',
      now: new Date('2026-07-01T03:00:00.000Z'),
    });

    expect(state.primaryCompetencies.source).toBe('fallback-empty');
    expect(state.primaryCompetencies.vector.controlModeling.score).toBe(0);
    expect(state.secondaryDimensions.conceptMastery.evidenceCount).toBe(0);
  });

  it('distinguishes no evidence, no active path, and stale feature-cache states', async () => {
    const noEvidenceState = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => null },
      studentProfileSummary: { findUnique: async () => null },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      learningFact: { findMany: async () => [] },
      adaptiveMasteryUpdate: { findMany: async () => [] },
      adaptiveAssessmentAbilityEstimate: { findFirst: async () => null },
      studentRiskFlag: { findMany: async () => [] },
      learningPath: { findMany: async () => [] },
    }), {
      userId: 'student-sparse',
      role: 'student',
      goal: 'control-correction',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });
    const staleState = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-03-01T00:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: { LearningFact: 1 },
          sourceCoverage: { LearningFact: 'available' },
          confidenceMarkers: { level: 'medium', score: 0.6, evidenceCount: 1, sourceCompleteness: 0.5 },
          statusMarkers: [],
          features: {
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      goal: 'control-correction',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(noEvidenceState.evidence.readState).toBe('missing');
    expect(noEvidenceState.evidence.statusMarkers).toEqual(expect.arrayContaining(['missing-source', 'low-confidence']));
    expect(noEvidenceState.pathContext).toMatchObject({
      activeControlCorrectionPath: { state: 'none' },
      statusMarkers: ['missing'],
    });
    expect(noEvidenceState.goalSlices?.controlCorrection?.dimensions.every((dimension) =>
      dimension.fallbackMarkers.includes('missing-governed-evidence')
    )).toBe(true);
    expect(staleState.evidence.readState).toBe('stale');
    expect(staleState.goalSlices?.controlCorrection?.dimensions.some((dimension) =>
      dimension.fallbackMarkers.includes('stale')
    )).toBe(true);
  });

  it('keeps the active control-correction path even when recent generic paths fill the general window', async () => {
    const recentGenericPaths = Array.from({ length: 10 }, (_, index) => ({
      id: `legacy-path-${index}`,
      goalId: 'legacy',
      pathStatus: 'legacy',
      isBookmarked: false,
      updatedAt: new Date(`2026-05-${19 - index}T00:00:00.000Z`),
    }));
    const state = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async (args: any) => {
          if (args.where?.goalId === 'control-correction') {
            return [{
              id: 'active-control-path',
              goalId: 'control-correction',
              pathStatus: 'active',
              currentNodeId: 'control-node',
              terminalValidation: { state: 'pending' },
              lastExecutionMetadata: { lowConfidenceMarkers: ['low-source-coverage'] },
              isBookmarked: false,
            }];
          }
          return recentGenericPaths;
        },
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.pathContext.recentPathIds).toHaveLength(10);
    expect(state.pathContext.activeControlCorrectionPath).toMatchObject({
      state: 'active',
      pathId: 'active-control-path',
      currentNodeId: 'control-node',
      terminalValidationState: 'pending',
      lowConfidenceMarkers: ['low-source-coverage'],
    });
  });

  it('keeps active risk flags teacher scoped', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'teacher',
      classId: 'class-1',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.roleScope.privacyScopes).toContain('teacher-scoped');
    expect(state.risks).toMatchObject({
      riskLevel: 'medium',
      activeFlags: [
        {
          type: 'cross_domain',
          severity: 'medium',
          description: '跨域迁移证据不足',
        },
      ],
    });
  });

  it('exposes a governed control-correction goal slice only when requested', async () => {
    const generalState = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(generalState.goalSlices).toBeUndefined();
    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice).toMatchObject({
      goalId: 'control-correction',
      payloadVersion: 'control-correction-goal-slice.v1',
      targetLevels: ['foundation', 'developing', 'proficient', 'advanced'],
    });
    expect(resolveAdaptiveGoalSliceDefinition('control-correction')?.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        knowledgeNodeRef: 'control-correction:root-locus-design',
        capabilityLevel: 'analyze',
        behaviorVerb: 'compare',
        observableEvidenceType: 'question',
        evaluationMethod: expect.any(String),
        competencyDimensions: expect.arrayContaining(['parameterDesign']),
        learnerStateFeatureGroups: expect.arrayContaining(['knowledgeMastery']),
      }),
    ]));
    expect(slice.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: expect.objectContaining({
          knowledgeNodeRef: 'control-correction:arena-transfer',
          capabilityLevel: 'create',
          observableEvidenceType: 'arena-official-evaluation',
        }),
        observedEvidence: expect.objectContaining({
          state: 'missing',
          directEvidenceCount: 0,
          supportingEvidenceCount: expect.any(Number),
          source: 'adaptive-learner-state',
          recommendationBias: 'starter-or-evidence-gathering',
        }),
      }),
    ]));
    expect(slice.dimensions.map((dimension) => dimension.id)).toEqual(
      CONTROL_CORRECTION_GOAL_DIMENSIONS,
    );
    expect(slice.pathContext).toMatchObject({
      activePathId: 'path-1',
      activePathStatus: 'active',
      currentNodeId: 'node-a',
      terminalValidationState: 'pending',
      recentPathIds: ['path-1'],
      noActivePath: false,
    });
    expect(slice.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'root-locus-reasoning',
          targetLevel: 'developing',
          sourceCoverage: expect.objectContaining({
            assessment: 'missing',
            simulation: 'missing',
            arena: 'missing',
          }),
          confidence: expect.objectContaining({
            state: 'none',
            evidenceCount: 0,
          }),
          privacy: expect.objectContaining({
            score: 'student-visible',
            sourceCoverage: 'student-visible',
            auditRefs: 'audit-only',
            rawPayloads: 'system-internal',
          }),
        }),
        expect.objectContaining({
          id: 'arena-transfer',
          fallbackMarkers: expect.arrayContaining(['missing-arena-evidence', 'missing-official-arena-evidence']),
          freshness: 'missing',
          confidence: expect.objectContaining({ state: 'none', evidenceCount: 0 }),
        }),
      ]),
    );
    expect(() => validateControlCorrectionGoalSliceContract(slice)).not.toThrow();
    expect(JSON.stringify(slice)).not.toContain('rawDialogue');
    expect(JSON.stringify(slice)).not.toContain('rawAnswerBody');
    expect(JSON.stringify(slice)).not.toContain('hiddenArenaInternals');
    expect(JSON.stringify(slice)).not.toContain('rawSimulationTrace');
  });

  it('returns an explicit unsupported goal slice instead of silently falling back to general state', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'future-goal',
    });

    expect(state.goalSlices?.unsupported).toEqual({
      goalId: 'future-goal',
      state: 'unsupported-goal',
      fallbackReason: 'unregistered-adaptive-goal',
      supportedGoalIds: ['control-correction'],
    });
    expect(state.goalSlices?.controlCorrection).toBeUndefined();
    expect(state.primaryCompetencies.vector.controlModeling.score).toBe(78);

    for (const specialGoal of ['__proto__', 'constructor']) {
      const specialState = await readAdaptiveLearnerState(createDb(), {
        userId: 'student-1',
        role: 'student',
        now: new Date('2026-05-20T03:00:00.000Z'),
        goal: specialGoal,
      });
      expect(specialState.goalSlices?.unsupported).toMatchObject({
        goalId: specialGoal,
        state: 'unsupported-goal',
        fallbackReason: 'unregistered-adaptive-goal',
      });
      expect(specialState.goalSlices?.controlCorrection).toBeUndefined();
    }
  });

  it('rejects undeclared control-correction dimensions before consumers can use them', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });
    const slice = state.goalSlices?.controlCorrection;
    if (!slice) throw new Error('expected control-correction goal slice');

    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      dimensions: [
        ...slice.dimensions.slice(1),
        {
          ...slice.dimensions[0],
          id: 'undeclared-dimension',
        },
      ],
    })).toThrow('control-correction goal slice missing required dimensions');
  });

  it('rejects undeclared control-correction capability targets before consumers can use them', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });
    const slice = state.goalSlices?.controlCorrection;
    if (!slice) throw new Error('expected control-correction goal slice');

    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      capabilityTargets: slice.capabilityTargets.map((capability, index) => (
        index === 0 ? {
          ...capability,
          target: {
            ...capability.target,
            id: slice.capabilityTargets[1]?.target.id,
            knowledgeNodeRef: 'undeclared-capability',
          },
        } : capability
      )),
    })).toThrow('control-correction goal slice missing capability targets');
  });

  it('preserves path context field families for registered control-correction slices', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async () => [
          {
            id: 'path-active',
            status: 'active',
            currentNodeId: 'node-current',
            terminalValidationState: 'pending',
            isBookmarked: true,
            updatedAt: new Date('2026-05-19T00:00:00.000Z'),
          },
          {
            id: 'path-completed',
            status: 'completed',
            terminalValidationState: 'passed',
            updatedAt: new Date('2026-05-18T00:00:00.000Z'),
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.goalSlices?.controlCorrection?.pathContext).toEqual({
      activePathId: 'path-active',
      activePathStatus: 'active',
      currentNodeId: 'node-current',
      terminalValidationState: 'pending',
      recentPathIds: ['path-active', 'path-completed'],
      noActivePath: false,
    });

    const noActivePathState = await readAdaptiveLearnerState(createDb({
      learningPath: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(noActivePathState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: null,
      activePathStatus: null,
      recentPathIds: [],
      noActivePath: true,
    });

    const legacyPathShapeState = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async () => [
          {
            id: 'legacy-path',
            title: '历史推荐路径',
            nodeIds: ['node-a', 'node-b'],
            isBookmarked: true,
            updatedAt: new Date('2026-05-19T00:00:00.000Z'),
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(legacyPathShapeState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: null,
      activePathStatus: null,
      recentPathIds: ['legacy-path'],
      noActivePath: true,
    });

    const statusMatrixState = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async () => [
          {
            id: 'ready-plan',
            status: 'ready',
            executionStatus: { adopted: false },
            updatedAt: new Date('2026-05-19T00:00:00.000Z'),
          },
          {
            id: 'explicit-active-path',
            isActive: true,
            currentNodeId: 'node-active',
            terminalValidationState: 'in-progress',
            updatedAt: new Date('2026-05-18T00:00:00.000Z'),
          },
          {
            id: 'in-progress-path',
            status: 'in-progress',
            currentNodeId: 'node-in-progress',
            terminalValidationState: 'pending',
            updatedAt: new Date('2026-05-17T00:00:00.000Z'),
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(statusMatrixState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: 'explicit-active-path',
      activePathStatus: 'active',
      currentNodeId: 'node-active',
      terminalValidationState: 'in-progress',
      recentPathIds: ['ready-plan', 'explicit-active-path', 'in-progress-path'],
      noActivePath: false,
    });

    const inProgressPathState = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async () => [
          {
            id: 'in-progress-path',
            status: 'in-progress',
            currentNodeId: 'node-in-progress',
            terminalValidationState: 'pending',
            updatedAt: new Date('2026-05-19T00:00:00.000Z'),
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(inProgressPathState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: 'in-progress-path',
      activePathStatus: 'in-progress',
      currentNodeId: 'node-in-progress',
      terminalValidationState: 'pending',
      noActivePath: false,
    });

    const scopedActivePathState = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async (args: any) => {
          if (args.where?.goalId === 'control-correction') {
            return [
              {
                id: 'scoped-active-path',
                goalId: 'control-correction',
                pathStatus: 'active',
                currentNodeId: 'node-scoped',
                terminalValidation: { state: 'ready-for-terminal-check' },
                updatedAt: new Date('2026-05-01T00:00:00.000Z'),
              },
            ];
          }
          return Array.from({ length: 10 }, (_, index) => ({
            id: `generic-path-${index}`,
            pathStatus: 'ready',
            updatedAt: new Date(`2026-05-${String(20 - index).padStart(2, '0')}T00:00:00.000Z`),
          }));
        },
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(scopedActivePathState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: 'scoped-active-path',
      activePathStatus: 'active',
      currentNodeId: 'node-scoped',
      terminalValidationState: 'ready-for-terminal-check',
      recentPathIds: expect.arrayContaining(['generic-path-0', 'scoped-active-path']),
      noActivePath: false,
    });

    const otherGoalActivePathState = await readAdaptiveLearnerState(createDb({
      learningPath: {
        findMany: async (args: any) => {
          if (args.where?.goalId === 'control-correction') {
            return [];
          }
          return [
            {
              id: 'other-goal-active-path',
              goalId: 'other-goal',
              pathStatus: 'active',
              currentNodeId: 'node-other',
              terminalValidation: { state: 'pending' },
              updatedAt: new Date('2026-05-19T00:00:00.000Z'),
            },
          ];
        },
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(otherGoalActivePathState.goalSlices?.controlCorrection?.pathContext).toMatchObject({
      activePathId: null,
      activePathStatus: null,
      currentNodeId: null,
      terminalValidationState: null,
      recentPathIds: ['other-goal-active-path'],
      noActivePath: true,
    });
  });

  it('queries goal-scoped learning facts separately for control-correction slices', async () => {
    const learningFactQueries: unknown[] = [];
    const arenaSubmissionQueries: unknown[] = [];
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: {
        findMany: async (args: unknown) => {
          learningFactQueries.push(args);
          return learningFactQueries.length === 1
            ? Array.from({ length: 100 }, (_, index) => ({
                factType: 'question',
                moduleId: `unrelated-${index}`,
                startedAt: new Date(`2026-05-${String(19 - (index % 10)).padStart(2, '0')}T00:00:00.000Z`),
                score: 90,
                contextJson: {},
              }))
            : [
                controlCorrectionFact('question', '2026-04-01T00:00:00.000Z', 86),
              ];
        },
      },
      arenaSubmission: {
        findMany: async (args: unknown) => {
          arenaSubmissionQueries.push(args);
          return [
            officialArenaSubmission(),
            officialArenaSubmission({
              id: 'arena-submission-legacy',
              evaluationRun: { protocolVersion: 'whitebox-v1' },
            }),
            officialArenaSubmission({
              id: 'arena-submission-invalid',
              valid: false,
            }),
          ];
        },
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(learningFactQueries).toHaveLength(3);
    expect(learningFactQueries[1]).toEqual({
      where: {
        userId: 'student-1',
        OR: [
          { contextJson: { path: ['goalId'], equals: 'control-correction' } },
          { contextJson: { path: ['goal'], equals: 'control-correction' } },
          { contextJson: { path: ['targetGoal'], equals: 'control-correction' } },
          { contextJson: { path: ['learningGoal'], equals: 'control-correction' } },
        ],
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    expect(learningFactQueries[2]).toMatchObject({
      where: {
        userId: 'student-1',
        OR: expect.arrayContaining([
          { courseId: { in: expect.arrayContaining(['control-correction', '3-6', 'unit-3-6-zero-design-workshop', 'unit-3-6-zero-design-workshop-v1']) } },
          { lessonId: { in: expect.arrayContaining(['control-correction', '3-6', 'unit-3-6-zero-design-workshop', 'unit-3-6-zero-design-workshop-v1']) } },
          { moduleId: { in: expect.arrayContaining(['control-correction', '3-6', 'unit-3-6-zero-design-workshop', 'unit-3-6-zero-design-workshop-v1']) } },
          { contextJson: { path: ['agentTool', 'courseId'], equals: 'control-correction' } },
          { contextJson: { path: ['adaptiveAssessment', 'courseId'], equals: 'unit-3-6-zero-design-workshop-v1' } },
          { contextJson: { path: ['arena', 'taskId'], equals: 'task-second-order-lead-pid' } },
          { contextJson: { path: ['simulation', 'summary', 'sourceId'], equals: 'unit-3-6-zero-design-workshop' } },
          { contextJson: { path: ['agentTool', 'courseId'], equals: 'unit-3-6-zero-design-workshop-v1' } },
        ]),
      },
      take: 500,
    });
    expect(arenaSubmissionQueries).toHaveLength(1);
    expect(arenaSubmissionQueries[0]).toMatchObject({
      where: {
        userId: 'student-1',
        valid: true,
        taskId: { in: ['task-second-order-lead-pid'] },
      },
    });
    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      evidenceCount: 1,
      confidence: expect.objectContaining({ state: 'high' }),
    });
  });

  it('counts registered legacy and explicitly goal-scoped assessment simulation reflection and AI facts', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-05-19T00:00:00.000Z', 92, {
            contextJson: { adaptiveAssessment: { courseId: 'unit-3-6-zero-design-workshop-v1' } },
          }),
          controlCorrectionFact('simulation', '2026-05-18T00:00:00.000Z', 90, {
            contextJson: { simulation: { summary: { sourceId: 'unit-3-6-zero-design-workshop' } } },
          }),
          controlCorrectionFact('reflection', '2026-05-17T00:00:00.000Z', 86, {
            lessonId: '3-6',
            contextJson: {},
          }),
          controlCorrectionFact('ai_intervention', '2026-05-16T00:00:00.000Z', 84, {
            contextJson: {
              agentTool: { courseId: 'unit-3-6-zero-design-workshop-v1' },
              evidenceSummary: { materialized: true },
            },
          }),
          controlCorrectionFact('prompt_design', '2026-05-15T00:00:00.000Z', 82, {
            contextJson: {
              goalId: 'control-correction',
              agentTool: { taskId: 'task-second-order-lead-pid' },
              evidenceSummary: { materialized: true },
            },
          }),
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ assessment: 'available' }),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'simulation-validation')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ simulation: 'available' }),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ reflection: 'available' }),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'ai-collaboration')).toMatchObject({
      evidenceCount: 2,
      sourceCoverage: expect.objectContaining({ aiCollaboration: 'available' }),
      evidenceProvenance: expect.objectContaining({ aiCollaboration: 'governed-ai-collaboration' }),
    });
  });

  it('keeps approved materialized AgentToolRun facts out of personalized goal evidence', async () => {
    const materialized = buildSimulationAgentEvidenceMaterialization({
      agentToolRuns: [
        {
          id: 'tool-run-1',
          agentSessionId: 'agent-session-1',
          ownerUserId: 'student-1',
          actorUserId: 'student-1',
          targetUserId: 'student-1',
          classId: 'class-1',
          courseId: 'control-correction',
          pageId: 'adaptive-path-center',
          resourceId: 'resource-1',
          pathNodeId: 'node-1',
          toolName: 'record_intervention_result',
          permissionTier: 'write',
          approvalState: 'approved',
          status: 'completed',
          inputSummary: {},
          outputSummary: {
            simulationRunId: 'run-1',
            traceRef: { traceId: 'trace-1' },
            metrics: { interventionOutcome: 0.78 },
          },
          idempotencyKey: 'analysis-1',
          correlationId: 'correlation-1',
          startedAt: new Date('2026-05-16T00:00:00.000Z'),
          completedAt: new Date('2026-05-16T00:05:00.000Z'),
          createdAt: new Date('2026-05-16T00:00:00.000Z'),
          updatedAt: new Date('2026-05-16T00:05:00.000Z'),
        },
      ],
      now: new Date('2026-05-20T03:00:00.000Z'),
    });
    expect(materialized.learningFacts).toHaveLength(1);

    const fact = materialized.learningFacts[0] as Record<string, unknown>;
    expect(fact.contextJson).toMatchObject({
      evidenceGovernance: {
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'unmanaged_learning_fact_context_only',
      },
    });
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          {
            ...fact,
            id: 'materialized-agent-fact',
            startedAt: fact.startedAt ?? new Date('2026-05-16T00:05:00.000Z'),
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'ai-collaboration')).toMatchObject({
      evidenceCount: 0,
      sourceCoverage: expect.objectContaining({ aiCollaboration: 'missing' }),
      evidenceProvenance: expect.objectContaining({ aiCollaboration: 'missing' }),
    });
  });

  it('does not count facts outside registered control-correction legacy scopes', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          {
            factType: 'reflection',
            lessonId: 'unrelated-lesson',
            startedAt: new Date('2026-05-17T00:00:00.000Z'),
            score: 86,
            contextJson: {},
          },
          {
            factType: 'ai_intervention',
            moduleId: 'unrelated-module',
            startedAt: new Date('2026-05-16T00:00:00.000Z'),
            score: 84,
            contextJson: { agentTool: { taskId: 'unrelated-task' } },
          },
          {
            factType: 'reflection',
            lessonId: '3-6',
            startedAt: new Date('2026-05-15T00:00:00.000Z'),
            score: 92,
            contextJson: { goalId: 'other-goal' },
          },
          {
            factType: 'reflection',
            lessonId: '3-6',
            startedAt: new Date('2026-05-14T00:00:00.000Z'),
            score: 94,
            contextJson: { goalId: 'other-goal', targetGoal: 'control-correction' },
          },
        ],
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 0,
      sourceCoverage: expect.objectContaining({ reflection: 'missing' }),
    });
    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'ai-collaboration')).toMatchObject({
      evidenceCount: 0,
      sourceCoverage: expect.objectContaining({ aiCollaboration: 'missing' }),
    });
  });

  it('keeps explicit control-correction facts from being squeezed out by legacy white-list noise', async () => {
    let explicitPage = 0;
    let legacyPage = 0;
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async (args: any) => {
          if (args.take === 100) {
            return [];
          }
          const goals = (args.where?.OR ?? [])
            .map((condition: any) => condition.contextJson?.path?.join('.'))
            .filter(Boolean);
          if (goals.includes('goalId') && goals.includes('learningGoal') && args.where.OR.length === 4) {
            explicitPage += 1;
            return [
              controlCorrectionFact('reflection', '2026-04-01T00:00:00.000Z', 86, {
                id: 'real-control-correction-reflection',
                contextJson: { goalId: 'control-correction' },
              }),
            ];
          }
          legacyPage += 1;
          return Array.from({ length: 500 }, (_, index) => ({
            id: `other-goal-legacy-${index}`,
            factType: 'reflection',
            lessonId: '3-6',
            startedAt: new Date(`2026-05-${String(20 - (index % 20)).padStart(2, '0')}T00:00:00.000Z`),
            score: 90,
            contextJson: { goalId: 'other-goal' },
          }));
        },
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ reflection: 'available' }),
    });
    expect(explicitPage).toBe(1);
    expect(legacyPage).toBeGreaterThan(1);
  });

  it('keeps explicit control-correction facts from being squeezed out by conflicting explicit goal fields', async () => {
    let explicitPage = 0;
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async (args: any) => {
          if (args.take === 100) {
            return [];
          }
          const goals = (args.where?.OR ?? [])
            .map((condition: any) => condition.contextJson?.path?.join('.'))
            .filter(Boolean);
          if (goals.includes('goalId') && goals.includes('learningGoal') && args.where.OR.length === 4) {
            explicitPage += 1;
            if (explicitPage === 1) {
              return Array.from({ length: 500 }, (_, index) => ({
                id: `conflicting-explicit-${index}`,
                factType: 'reflection',
                startedAt: new Date(`2026-05-${String(20 - (index % 20)).padStart(2, '0')}T00:00:00.000Z`),
                score: 90,
                contextJson: { goalId: 'other-goal', targetGoal: 'control-correction' },
              }));
            }
            return [
              controlCorrectionFact('reflection', '2026-04-01T00:00:00.000Z', 86, {
                id: 'real-explicit-control-correction-reflection',
                contextJson: { goalId: 'control-correction' },
              }),
            ];
          }
          return [];
        },
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ reflection: 'available' }),
    });
    expect(explicitPage).toBe(2);
  });

  it('scans beyond ten context-only pages for an eligible control-correction fact', async () => {
    let explicitPage = 0;
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async (args: any) => {
          if (args.take === 100) {
            return [];
          }
          const goals = (args.where?.OR ?? [])
            .map((condition: any) => condition.contextJson?.path?.join('.'))
            .filter(Boolean);
          if (!(goals.includes('goalId') && goals.includes('learningGoal') && args.where.OR.length === 4)) {
            return [];
          }
          explicitPage += 1;
          if (explicitPage <= 11) {
            return Array.from({ length: 500 }, (_, index) => ({
              id: `context-only-page-${explicitPage}-fact-${index}`,
              factType: 'reflection',
              startedAt: new Date('2026-05-19T00:00:00.000Z'),
              score: 90,
              contextJson: {
                goalId: 'control-correction',
                evidenceGovernance: {
                  evidenceQuality: 'context-only',
                  profileWeight: 0,
                  skipProfileContribution: true,
                  policyReason: 'audit-only-source',
                },
              },
            }));
          }
          return [
            controlCorrectionFact('reflection', '2026-04-01T00:00:00.000Z', 86, {
              id: 'eligible-after-eleven-pages',
              contextJson: { goalId: 'control-correction' },
            }),
          ];
        },
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ reflection: 'available' }),
    });
    expect(explicitPage).toBe(12);
  });

  it('counts Arena-context design facts as preview Arena evidence for control-correction', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('design', '2026-05-19T00:00:00.000Z', 88, {
            contextJson: { goalId: 'control-correction', arena: { taskId: 'task-second-order-lead-pid' } },
          }),
        ],
      },
      arenaSubmission: {
        findMany: async () => [],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const arenaTransfer = state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'arena-transfer');
    expect(arenaTransfer).toMatchObject({
      evidenceCount: 1,
      sourceCoverage: expect.objectContaining({ arena: 'partial' }),
      evidenceProvenance: expect.objectContaining({ arena: 'preview' }),
      fallbackMarkers: expect.arrayContaining(['partial-arena-evidence', 'preview-only-arena-evidence']),
    });
  });

  it('filters path execution mastery references to the requested goal slice and target', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      learningFact: {
        findMany: async () => [],
      },
      arenaSubmission: {
        findMany: async () => [],
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: {},
          },
          sourceCoverage: {
            LearningFact: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'medium',
            score: 0.68,
            evidenceCount: 2,
            sourceCompleteness: 0.5,
          },
          statusMarkers: ['partial'],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 8,
                calculationVersion: 'competency-v2',
                competencyVector: snapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow(),
            },
            pathExecution: pathExecutionFeature({
              allTime: pathExecutionWindow({
                evidenceCount: 2,
                completionCount: 2,
                sourceReferences: [
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-frequency-response',
                    goalId: 'frequency-response-foundations',
                    capabilityTargetId: 'frequency-response-foundations:bode-analysis:analyze',
                    occurredAt: '2026-06-04T10:20:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    resourceType: 'arena_task',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-legacy-missing-goal',
                    occurredAt: '2026-06-04T10:22:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    resourceType: 'arena_task',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-control-correction',
                    goalId: 'control-correction',
                    capabilityTargetId: 'control-correction:arena-transfer:create',
                    occurredAt: '2026-06-04T10:24:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    resourceType: 'arena_task',
                  },
                ],
              }),
            }),
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    if (!slice) throw new Error('expected control-correction goal slice');
    const arenaTarget = slice.capabilityTargets.find((entry) => entry.target.id === 'control-correction:arena-transfer:create');
    expect(arenaTarget?.observedEvidence.supportingEvidenceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: expect.stringContaining('exec-control-correction') }),
    ]));
    const refsJson = JSON.stringify(arenaTarget?.observedEvidence.supportingEvidenceRefs);
    expect(refsJson).not.toContain('exec-frequency-response');
    expect(refsJson).not.toContain('exec-legacy-missing-goal');
  });

  it('keeps complete control-correction fixtures current without fallback markers', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: {
        findFirst: async () => ({
          snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
          factCount: 12,
          calculationVersion: 'competency-v2',
          competencyVector: strongSnapshotVector,
          evidenceSummary: {},
        }),
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-19T00:00:00.000Z',
            daysCovered: 18,
          },
          sourceCounts: {
            LearningFact: 8,
            StudentPortraitV2Snapshot: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 3, simulation: 2, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentPortraitV2Snapshot: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 8,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow(),
            },
            pathExecution: pathExecutionFeature(),
          },
        }),
      },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-05-19T00:00:00.000Z', 92, {
            lessonId: 'lesson-root-locus',
            moduleId: 'step-root-locus-check',
          }),
          controlCorrectionFact('simulation', '2026-05-18T00:00:00.000Z', 90),
          controlCorrectionFact('arena', '2026-05-17T00:00:00.000Z', 88),
          controlCorrectionFact('reflection', '2026-05-16T00:00:00.000Z', 86),
          controlCorrectionFact('konling', '2026-05-15T00:00:00.000Z', 84, {
            contextJson: { goalId: 'control-correction', evidenceSummary: { materialized: true } },
          }),
        ],
      },
      arenaSubmission: {
        findMany: async () => [
          officialArenaSubmission(),
	          officialArenaSubmission({
	            id: 'arena-submission-other-task',
	            taskId: 'unrelated-arena-task',
	          }),
	          officialArenaSubmission({
	            id: 'arena-submission-legacy',
	            evaluationRun: { protocolVersion: 'whitebox-v1' },
	          }),
          officialArenaSubmission({
            id: 'arena-submission-invalid',
            valid: false,
          }),
        ],
      },
      evidenceOutbox: {
        findMany: async () => [acceptedArenaWritebackOutboxRow()],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    const dimensions = slice.dimensions;
    expect(dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      freshness: 'current',
      fallbackMarkers: [],
      confidence: expect.objectContaining({ sourceCompleteness: 1 }),
    });
    expect(dimensions.find((dimension) => dimension.id === 'root-locus-reasoning')).toMatchObject({
      targetLevel: 'advanced',
      freshness: 'current',
      fallbackMarkers: [],
      evidenceProvenance: expect.objectContaining({ arena: 'official' }),
      confidence: expect.objectContaining({ state: 'high' }),
    });
    expect(dimensions.find((dimension) => dimension.id === 'arena-transfer')).toMatchObject({
      freshness: 'current',
      evidenceCount: 1,
      fallbackMarkers: [],
      evidenceProvenance: expect.objectContaining({ arena: 'official' }),
      confidence: expect.objectContaining({ state: 'high' }),
    });
    expect(slice.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: expect.objectContaining({
          id: 'control-correction:arena-transfer:create',
          observableEvidenceType: 'arena-official-evaluation',
        }),
        observedEvidence: expect.objectContaining({
          state: 'observed',
          knowledgeMastery: null,
          confidence: 0.7,
          directEvidenceCount: 1,
          recommendationBias: 'targeted-practice',
        }),
      }),
    ]));
  });

  it('uses governed question facts as capability target evidence without mastery updates', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-05-19T00:00:00.000Z', 92, {
            lessonId: 'lesson-root-locus',
            moduleId: 'step-root-locus-check',
          }),
        ],
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: expect.objectContaining({
          id: 'control-correction:root-locus-design:analyze',
          observableEvidenceType: 'question',
        }),
        observedEvidence: expect.objectContaining({
          state: 'low-confidence',
          knowledgeMastery: null,
          confidence: 0.45,
          directEvidenceCount: 1,
          eventReferences: [{
            sourceScope: 'interactive-lesson-submission',
            occurredAt: '2026-05-19T00:00:00.000Z',
            summary: '课堂作答记录参与了该项能力判断。',
            nextAction: {
              href: '/profile/evidence?lessonId=lesson-root-locus',
              label: '复盘课堂作答',
            },
          }],
          recommendationBias: 'starter-or-evidence-gathering',
        }),
      }),
    ]));
  });

  it('carries an exact adaptive assessment answer lineage from learner state into planner deficits', async () => {
    const targetedSourceEventIdQueries: string[][] = [];
    const recentUnrelatedFacts = Array.from({ length: 120 }, (_, index) => ({
      id: `recent-unrelated-${index}`,
      factType: 'video',
      sourceEventId: `video:${index}`,
      startedAt: new Date(`2026-05-19T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00.000Z`),
      contextJson: {},
    }));
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: {
        findMany: async () => [
          {
            id: 'mastery-root-locus',
            answerId: 'answer-root-locus',
            knowledgeTag: 'control-correction:root-locus-design',
            posteriorMastery: 0.24,
            confidence: 0.72,
            algorithmVersion: 'adaptive-assessment-bkt-v1',
            createdAt: new Date('2026-05-19T00:00:01.000Z'),
          },
          {
            id: 'mastery-unresolvable',
            answerId: 'answer-unresolvable',
            knowledgeTag: 'control-correction:simulation-validation',
            posteriorMastery: 0.2,
            confidence: 0.68,
            algorithmVersion: 'adaptive-assessment-bkt-v1',
            createdAt: new Date('2026-05-18T00:00:01.000Z'),
          },
          {
            id: 'mastery-missing',
            answerId: 'answer-missing',
            knowledgeTag: 'control-correction:time-domain-targets',
            posteriorMastery: 0.3,
            confidence: 0.65,
            algorithmVersion: 'adaptive-assessment-bkt-v1',
            createdAt: new Date('2026-05-17T00:00:01.000Z'),
          },
        ],
      },
      learningFact: {
        findMany: async (args: {
          where?: { sourceEventId?: { in?: string[] } };
          take?: number;
        }) => {
          const sourceEventIds = args.where?.sourceEventId?.in;
          if (!sourceEventIds) {
            return args.take === 100 ? recentUnrelatedFacts.slice(0, 100) : [];
          }
          targetedSourceEventIdQueries.push(sourceEventIds);
          return [controlCorrectionFact('assessment', '2026-04-01T00:00:00.000Z', 45, {
            id: 'fact-root-locus',
            moduleId: 'adaptive-assessment',
            sourceEventId: 'adaptive-assessment:answer-root-locus',
            contextJson: {
              goalId: 'control-correction',
              adaptiveAssessment: {
                adaptiveAssessmentRef: { answerId: 'answer-root-locus' },
              },
            },
          }),
          controlCorrectionFact('unknown', '2026-05-18T00:00:00.000Z', 60, {
            id: 'fact-unresolvable',
            moduleId: 'unknown-source',
            sourceEventId: 'adaptive-assessment:answer-unresolvable',
            contextJson: {
              goalId: 'control-correction',
              adaptiveAssessment: {
                adaptiveAssessmentRef: { answerId: 'answer-unresolvable' },
              },
            },
          }),
          controlCorrectionFact('assessment', '2026-05-17T00:00:00.000Z', 70, {
            id: 'context-only-answer-fact',
            moduleId: 'adaptive-assessment',
            sourceEventId: 'adaptive-assessment:answer-missing',
            contextJson: {
              goalId: 'control-correction',
              adaptiveAssessment: {
                adaptiveAssessmentRef: { answerId: 'answer-missing' },
              },
              evidenceGovernance: {
                evidenceQuality: 'context-only',
                profileWeight: 0,
                skipProfileContribution: true,
                policyReason: 'audit-only-source',
              },
            },
          })];
        },
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const registry = buildControlCorrectionResourceNodeRegistry();
    const plan = buildAdaptiveLearningPathPlan({
      studentId: 'student-1',
      goal: {
        id: 'control-correction',
        title: 'Control correction',
        knowledgeTargets: [
          'control-correction:time-domain-targets',
          'control-correction:root-locus-design',
          'control-correction:simulation-validation',
          'control-correction:arena-transfer',
        ],
        competencyTargets: ['parameterDesign'],
      },
      learnerState: state as unknown as AdaptiveLearningPathPlannerInput['learnerState'],
      registry,
      constraints: {
        timeBudgetMinutes: 100,
        privacyScopes: ['student-visible'],
        device: 'desktop',
        timelineWindowDays: 7,
      },
      now: new Date('2026-05-20T03:00:00.000Z'),
    });

    expect(state.knowledgeMastery.tags['control-correction:root-locus-design']?.eventReferences).toEqual([{
      sourceScope: 'adaptive-practice-submission',
      occurredAt: '2026-04-01T00:00:00.000Z',
      summary: expect.any(String),
      nextAction: {
        href: '/assessment/adaptive-practice?intent=practice',
        label: expect.any(String),
      },
    }]);
    expect(plan.visualization.evidence.learnerStateDeficits.find((deficit) =>
      deficit.targetId === 'control-correction:root-locus-design'
    )?.eventReferences).toEqual([
      expect.objectContaining({
        sourceScope: 'adaptive-practice-submission',
        occurredAt: '2026-04-01T00:00:00.000Z',
      }),
    ]);
    expect(targetedSourceEventIdQueries).toEqual([[
      'adaptive-assessment:answer-root-locus',
      'adaptive-assessment:answer-unresolvable',
      'adaptive-assessment:answer-missing',
    ]]);
    expect(plan.visualization.evidence.learnerStateDeficits.find((deficit) =>
      deficit.targetId === 'parameterDesign'
    )?.eventReferences).toEqual([]);
    expect(state.knowledgeMastery.tags['control-correction:simulation-validation']?.eventReferences).toEqual([]);
    expect(state.knowledgeMastery.tags['control-correction:time-domain-targets']?.eventReferences).toEqual([]);
    expect(JSON.stringify(state.knowledgeMastery.tags['control-correction:time-domain-targets'])).not.toContain(
      'context-only-answer-fact',
    );
    expect(plan.visualization.evidence.learnerStateDeficits.find((deficit) =>
      deficit.targetId === 'control-correction:simulation-validation'
    )?.eventReferences).toEqual([]);
    const serializedEventReferences = JSON.stringify(Object.values(state.knowledgeMastery.tags)
      .flatMap((mastery) => mastery.eventReferences ?? []));
    expect(serializedEventReferences).not.toContain('answer-root-locus');
    expect(serializedEventReferences).not.toContain('fact-root-locus');
  });

  it('bounds, orders, deduplicates, and redacts student-safe capability event references', async () => {
    const simulationFacts = [1, 2, 3, 4].map((day) => controlCorrectionFact(
      'simulation',
      `2026-05-${String(14 + day).padStart(2, '0')}T00:00:00.000Z`,
      80 + day,
      {
        id: `simulation-${day}`,
        moduleId: 'control-workbench',
        sourceLogId: `source-log-${day}`,
        sourceEventId: `source-event-${day}`,
      },
    ));
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: { findMany: async () => [...simulationFacts, simulationFacts[3]] },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const target = state.goalSlices?.controlCorrection?.capabilityTargets.find((entry) =>
      entry.target.id === 'control-correction:time-domain-targets:apply'
    );
    expect(target?.observedEvidence.eventReferences).toHaveLength(3);
    expect(target?.observedEvidence.eventReferences?.map((entry) => entry.occurredAt)).toEqual([
      '2026-05-18T00:00:00.000Z',
      '2026-05-17T00:00:00.000Z',
      '2026-05-16T00:00:00.000Z',
    ]);
    const serialized = JSON.stringify(target?.observedEvidence.eventReferences);
    expect(serialized).not.toContain('simulation-4');
    expect(serialized).not.toContain('source-log');
    expect(serialized).not.toContain('source-event');
  });

  it('keeps type-level simulation evidence below observed confidence for capability targets', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('simulation', '2026-05-19T00:00:00.000Z', 90),
        ],
      },
      arenaSubmission: { findMany: async () => [] },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.capabilityTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        target: expect.objectContaining({
          id: 'control-correction:time-domain-targets:apply',
          observableEvidenceType: 'simulation-run',
        }),
        observedEvidence: expect.objectContaining({
          state: 'low-confidence',
          confidence: 0.45,
          directEvidenceCount: 1,
          recommendationBias: 'starter-or-evidence-gathering',
        }),
      }),
      expect.objectContaining({
        target: expect.objectContaining({
          id: 'control-correction:simulation-validation:evaluate',
          observableEvidenceType: 'simulation-run',
        }),
        observedEvidence: expect.objectContaining({
          state: 'low-confidence',
          confidence: 0.45,
          directEvidenceCount: 1,
          recommendationBias: 'starter-or-evidence-gathering',
        }),
      }),
    ]));
  });

  it('exposes governed path execution features through prerequisite feature groups', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 8,
            StudentPortraitV2Snapshot: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 3, simulation: 2, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentPortraitV2Snapshot: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 8,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow(),
            },
            pathExecution: pathExecutionFeature({
              allTime: pathExecutionWindow({
                evidenceCount: 3,
                adoptionCount: 1,
                completionCount: 1,
                terminalValidationCount: 1,
                sourceCoverage: {
                  adoption: 'available',
                  completion: 'available',
                  deviation: 'missing',
                  fallback: 'missing',
                  terminalValidation: 'available',
                  interventionOutcome: 'available',
                },
                confidence: {
                  level: 'medium',
                  score: 0.86,
                  lowConfidenceCount: 0,
                },
                interventionOutcome: {
                  acceptedCount: 1,
                  completedCount: 0,
                  dismissedCount: 0,
                  lowConfidenceCount: 0,
                },
                sourceReferences: [
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-1',
                    pathId: 'path-1',
                    nodeId: 'terminal-node',
                    occurredAt: '2026-06-04T10:20:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    resourceType: 'arena_task',
                  },
                  {
                    sourceType: 'LearningPathIntervention',
                    sourceId: 'int-1',
                    pathId: 'path-1',
                    nodeId: null,
                    occurredAt: '2026-06-04T10:24:00.000Z',
                    privacyLevel: 'teacher-scoped',
                    interventionKind: 'hint',
                    studentOutcome: 'accepted',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-in-progress',
                    pathId: 'path-1',
                    nodeId: 'draft-node',
                    occurredAt: '2026-06-04T10:28:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'in_progress',
                    resourceType: 'arena_task',
                  },
                  {
                    sourceType: 'LearningPathExecution',
                    sourceId: 'exec-wrong-resource',
                    pathId: 'path-1',
                    nodeId: 'media-node',
                    occurredAt: '2026-06-04T10:32:00.000Z',
                    privacyLevel: 'student-visible',
                    status: 'completed',
                    resourceType: 'media',
                  },
                ],
              }),
            }),
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    expect(state.prerequisiteFeatureGroups.pathExecution).toMatchObject({
      evidenceCount: 3,
      completionCount: 1,
      terminalValidationCount: 1,
      sourceReferences: expect.arrayContaining([
        expect.objectContaining({ sourceType: 'LearningPathExecution', sourceId: 'exec-1' }),
        expect.objectContaining({ sourceType: 'LearningPathExecution', sourceId: 'exec-in-progress' }),
        expect.objectContaining({ sourceType: 'LearningPathExecution', sourceId: 'exec-wrong-resource' }),
      ]),
    });
    expect((state.prerequisiteFeatureGroups.pathExecution as any).sourceReferences).toHaveLength(3);
    expect(JSON.stringify(state.prerequisiteFeatureGroups.pathExecution)).not.toContain('int-1');
    expect(state.evidence.readState).toBe('ready');
  });

  it('uses official Arena submissions even when simulation Arena feature coverage is stale or missing', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 1,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { arena: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 1,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
          },
        }),
      },
      learningFact: {
        findMany: async () => [],
      },
      arenaSubmission: {
        findMany: async () => [officialArenaSubmission()],
      },
      evidenceOutbox: {
        findMany: async () => [acceptedArenaWritebackOutboxRow()],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const arenaTransfer = state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'arena-transfer');
    expect(arenaTransfer).toMatchObject({
      sourceCoverage: expect.objectContaining({ arena: 'available' }),
      evidenceCount: 1,
      evidenceProvenance: expect.objectContaining({ arena: 'official' }),
      confidence: expect.objectContaining({ sourceCompleteness: 1 }),
    });
    const arenaCapability = state.goalSlices?.controlCorrection?.capabilityTargets.find((entry) =>
      entry.target.id === 'control-correction:arena-transfer:create'
    );
    expect(arenaCapability?.observedEvidence.eventReferences).toEqual([{
      sourceScope: 'arena-official-result',
      occurredAt: '2026-05-19T01:00:00.000Z',
      summary: 'Arena 官方评测结果参与了该项能力判断。',
      nextAction: { href: '/arena', label: '查看 Arena 结果' },
    }]);
  });

  it('excludes blocked persisted Arena writeback outcomes from official control-correction evidence', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 1,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { arena: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 1,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
          },
        }),
      },
      learningFact: {
        findMany: async () => [],
      },
      arenaSubmission: {
        findMany: async () => [officialArenaSubmission({
          id: 'arena-submission-blocked',
        })],
      },
      evidenceOutbox: {
        findMany: async () => [
          {
            causationId: 'arena-submission-blocked',
            payload: {
              evidenceWriteback: {
                status: 'blocked',
                sourceRef: { kind: 'ArenaSubmission', id: 'arena-submission-blocked' },
                attemptStatus: 'duplicate-only',
                visibilityState: 'diagnostic-only',
                targetLabel: '控制校正 Arena 官方迁移验证',
                summary: '重复官方提交只保留诊断证据，不写入终端掌握判定。',
                recoveryAction: '提交新的有效官方结果。',
                limitationCodes: ['attempt-not-effective:duplicate-only'],
                overlayCount: 0,
                terminalValidationAccepted: false,
              },
            },
          },
        ],
      },
    }), {
      userId: 'student-1',
      role: 'system',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const arenaTransfer = state.goalSlices?.controlCorrection?.dimensions.find((dimension) => dimension.id === 'arena-transfer');
    expect(arenaTransfer).toMatchObject({
      sourceCoverage: expect.objectContaining({ arena: 'missing' }),
      evidenceCount: 0,
      evidenceProvenance: expect.objectContaining({ arena: 'missing' }),
    });
    expect(arenaTransfer?.fallbackMarkers).toContain('missing-governed-evidence');
  });

  it('marks control-correction dimensions with missing, stale, partial, and low-confidence fallback states', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: { findFirst: async () => null },
      studentProfileSummary: { findUnique: async () => null },
      studentEvidenceFeatureCache: { findUnique: async () => null },
      learningFact: { findMany: async () => [] },
      adaptiveMasteryUpdate: { findMany: async () => [] },
      adaptiveAssessmentAbilityEstimate: { findFirst: async () => null },
      studentRiskFlag: { findMany: async () => [] },
      learningPath: { findMany: async () => [] },
    }), {
      userId: 'student-2',
      role: 'system',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice?.dimensions).toHaveLength(CONTROL_CORRECTION_GOAL_DIMENSIONS.length);
    expect(slice?.dimensions.every((dimension) => dimension.freshness === 'missing')).toBe(true);
    expect(slice?.dimensions.every((dimension) => dimension.confidence.state === 'none')).toBe(true);
    expect(slice?.dimensions.every((dimension) => dimension.fallbackMarkers.includes('missing-governed-evidence'))).toBe(true);
  });

  it('marks missing required sources per dimension even when global evidence markers are clean', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-19T00:00:00.000Z',
            daysCovered: 18,
          },
          sourceCounts: {
            LearningFact: 1,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 1,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 8,
                calculationVersion: 'competency-v2',
                competencyVector: snapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow({
                evidenceCount: 0,
                completedCount: 0,
                officialCount: 0,
                previewCount: 0,
                agentAssistedCount: 0,
                courseLaunchedCount: 0,
                standaloneCount: 0,
                traceReferenceCount: 0,
                sourceCoverage: {
                  simulation: 'missing',
                  arena: 'missing',
                  traceReferences: 'missing',
                  replayConfidence: 'missing',
                },
                replayConfidence: {
                  average: null,
                  highConfidenceCount: 0,
                  lowConfidenceCount: 0,
                  missingCount: 0,
                },
              }),
              allTime: simulationArenaWindow({
                evidenceCount: 0,
                completedCount: 0,
                officialCount: 0,
                previewCount: 0,
                agentAssistedCount: 0,
                courseLaunchedCount: 0,
                standaloneCount: 0,
                traceReferenceCount: 0,
                sourceCoverage: {
                  simulation: 'missing',
                  arena: 'missing',
                  traceReferences: 'missing',
                  replayConfidence: 'missing',
                },
                replayConfidence: {
                  average: null,
                  highConfidenceCount: 0,
                  lowConfidenceCount: 0,
                  missingCount: 0,
                },
              }),
            },
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      freshness: 'missing',
      confidence: expect.objectContaining({ state: 'none', sourceCompleteness: 0 }),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'arena-transfer')).toMatchObject({
      freshness: 'missing',
      fallbackMarkers: expect.arrayContaining(['missing-arena-evidence', 'missing-official-arena-evidence']),
      confidence: expect.objectContaining({ state: 'none', sourceCompleteness: 0 }),
    });
  });

  it('does not treat unrelated learning facts or snapshot counts as assessment evidence', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: {
        findMany: async () => [
          {
            id: 'fact-media-only',
            factType: 'media',
            moduleId: 'unit-3-4',
            lessonId: 'unit-3-4-root-locus-reading-validation',
            startedAt: new Date('2026-05-19T00:00:00.000Z'),
            finishedAt: new Date('2026-05-19T00:10:00.000Z'),
            outcome: 'success',
            score: 90,
            timeSpent: 600,
            contextJson: { media: { mediaType: 'video', progress: 0.9 } },
          },
        ],
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-19T00:00:00.000Z',
            daysCovered: 18,
          },
          sourceCounts: {
            LearningFact: 1,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { media: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 1,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 8,
                calculationVersion: 'competency-v2',
                competencyVector: snapshotVector,
              },
            },
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      sourceCoverage: expect.objectContaining({ assessment: 'missing' }),
      evidenceCount: 0,
      freshness: 'missing',
      confidence: expect.objectContaining({ state: 'none', sourceCompleteness: 0 }),
      fallbackMarkers: expect.arrayContaining(['missing-assessment-evidence']),
    });
  });

  it('does not count learning facts without control-correction scope as goal evidence', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: {
        findFirst: async () => ({
          snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
          factCount: 20,
          calculationVersion: 'competency-v2',
          competencyVector: strongSnapshotVector,
          evidenceSummary: {},
        }),
      },
      adaptiveMasteryUpdate: { findMany: async () => [] },
      learningFact: {
        findMany: async () => [
          {
            factType: 'question',
            moduleId: 'lesson09-correction-precheck',
            startedAt: new Date('2026-05-19T00:00:00.000Z'),
            score: 92,
            contextJson: {},
          },
          {
            factType: 'simulation',
            moduleId: 'unit-2-3',
            startedAt: new Date('2026-05-18T00:00:00.000Z'),
            score: 90,
            contextJson: { stepId: 'correction_rate' },
          },
          {
            factType: 'arena',
            moduleId: 'unit-2-4',
            startedAt: new Date('2026-05-17T00:00:00.000Z'),
            score: 88,
            contextJson: { nodeId: '串联无源滞后校正_6_2a52e865' },
          },
          { factType: 'reflection', moduleId: 'unit-3-4', startedAt: new Date('2026-05-16T00:00:00.000Z'), score: 86, contextJson: {} },
          { factType: 'konling', moduleId: 'unit-3-5', startedAt: new Date('2026-05-15T00:00:00.000Z'), score: 84, contextJson: {} },
        ],
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 5,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 1, simulation: 1, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 5,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 20,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      evidenceCount: 0,
      freshness: 'missing',
      confidence: expect.objectContaining({ state: 'none' }),
      fallbackMarkers: expect.arrayContaining(['missing-assessment-evidence']),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'root-locus-reasoning')).toMatchObject({
      evidenceCount: 0,
      confidence: expect.objectContaining({ state: 'none' }),
      fallbackMarkers: expect.arrayContaining([
        'missing-assessment-evidence',
        'missing-simulation-evidence',
        'missing-arena-evidence',
      ]),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      evidenceCount: 0,
      fallbackMarkers: expect.arrayContaining(['missing-reflection-evidence']),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'ai-collaboration')).toMatchObject({
      evidenceCount: 0,
      fallbackMarkers: expect.arrayContaining(['missing-ai-collaboration-evidence']),
    });
  });

  it('marks stale control-correction fixtures without treating them as current evidence', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-04-01T02:00:00.000Z'),
          evidenceWindow: {
            firstStartedAt: '2026-03-01T00:00:00.000Z',
            lastStartedAt: '2026-03-19T00:00:00.000Z',
            daysCovered: 18,
          },
          sourceCounts: {
            LearningFact: 3,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 1, simulation: 1 },
          },
          sourceCoverage: {
            LearningFact: 'partial',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'medium',
            score: 0.6,
            evidenceCount: 3,
            sourceCompleteness: 0.67,
          },
          statusMarkers: ['stale'],
          features: {
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow({
                evidenceCount: 1,
                completedCount: 1,
                officialCount: 0,
                previewCount: 0,
                sourceCoverage: {
                  simulation: 'available',
                  arena: 'missing',
                  traceReferences: 'available',
                  replayConfidence: 'partial',
                },
              }),
              allTime: simulationArenaWindow({
                evidenceCount: 1,
                completedCount: 1,
                officialCount: 0,
                previewCount: 0,
                sourceCoverage: {
                  simulation: 'available',
                  arena: 'missing',
                  traceReferences: 'available',
                  replayConfidence: 'partial',
                },
              }),
            },
          },
        }),
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    const dimensions = slice.dimensions;
    expect(dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      freshness: 'missing',
      fallbackMarkers: expect.arrayContaining(['stale']),
    });
    expect(dimensions.find((dimension) => dimension.id === 'arena-transfer')).toMatchObject({
      freshness: 'missing',
      fallbackMarkers: expect.arrayContaining(['stale', 'missing-official-arena-evidence']),
    });
  });

  it('treats stale feature-cache read state as stale even without a stale status marker', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-04-01T02:00:00.000Z'),
          evidenceWindow: {
            firstStartedAt: '2026-03-01T00:00:00.000Z',
            lastStartedAt: '2026-03-19T00:00:00.000Z',
            daysCovered: 18,
          },
          sourceCounts: {
            LearningFact: 8,
            StudentPortraitV2Snapshot: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 3, simulation: 2, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentPortraitV2Snapshot: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 8,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-03-19T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow(),
            },
          },
        }),
      },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-03-19T00:00:00.000Z', 92),
          controlCorrectionFact('simulation', '2026-03-18T00:00:00.000Z', 90),
          controlCorrectionFact('arena', '2026-03-17T00:00:00.000Z', 88),
          controlCorrectionFact('reflection', '2026-03-16T00:00:00.000Z', 86),
          controlCorrectionFact('konling', '2026-03-15T00:00:00.000Z', 84, {
            contextJson: { goalId: 'control-correction', evidenceSummary: { materialized: true } },
          }),
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(state.evidence.readState).toBe('stale');
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      freshness: 'stale',
      fallbackMarkers: expect.arrayContaining(['stale']),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'root-locus-reasoning')).toMatchObject({
      freshness: 'stale',
      fallbackMarkers: expect.arrayContaining(['stale']),
    });
  });

  it('caps dimension confidence when governed evidence carries a low-confidence marker', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: {
        findFirst: async () => ({
          snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
          factCount: 12,
          calculationVersion: 'competency-v2',
          competencyVector: strongSnapshotVector,
          evidenceSummary: {},
        }),
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 8,
            StudentPortraitV2Snapshot: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 3, simulation: 2, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentPortraitV2Snapshot: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'low',
            score: 0.35,
            evidenceCount: 8,
            sourceCompleteness: 1,
          },
          statusMarkers: ['low-confidence'],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature({
              confidence: {
                level: 'low',
                score: 0.35,
                evidenceCount: 8,
                sourceCompleteness: 1,
                markers: ['low-confidence'],
              },
            }),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow(),
            },
          },
        }),
      },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-05-19T00:00:00.000Z', 92),
          controlCorrectionFact('simulation', '2026-05-18T00:00:00.000Z', 90),
          controlCorrectionFact('arena', '2026-05-17T00:00:00.000Z', 88),
          controlCorrectionFact('reflection', '2026-05-16T00:00:00.000Z', 86),
          controlCorrectionFact('konling', '2026-05-15T00:00:00.000Z', 84, {
            contextJson: { goalId: 'control-correction', evidenceSummary: { materialized: true } },
          }),
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'root-locus-reasoning')).toMatchObject({
      confidence: expect.objectContaining({ state: 'low', sourceCompleteness: 1 }),
      fallbackMarkers: expect.arrayContaining(['low-confidence']),
    });
  });

  it('propagates simulation Arena window quality markers into goal slice freshness and confidence', async () => {
    const state = await readAdaptiveLearnerState(createDb({
      studentCompetencySnapshot: {
        findFirst: async () => ({
          snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
          factCount: 12,
          calculationVersion: 'competency-v2',
          competencyVector: strongSnapshotVector,
          evidenceSummary: {},
        }),
      },
      studentEvidenceFeatureCache: {
        findUnique: async () => ({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-20T02:00:00.000Z'),
          evidenceWindow: evidenceWindow(),
          sourceCounts: {
            LearningFact: 8,
            StudentPortraitV2Snapshot: 0,
            StudentCompetencySnapshot: 1,
            StudentProfileSummary: 1,
            byFactType: { question: 3, simulation: 2, arena: 1, reflection: 1, konling: 1 },
          },
          sourceCoverage: {
            LearningFact: 'available',
            StudentPortraitV2Snapshot: 'missing',
            StudentCompetencySnapshot: 'available',
            StudentProfileSummary: 'available',
          },
          confidenceMarkers: {
            level: 'high',
            score: 0.9,
            evidenceCount: 8,
            sourceCompleteness: 1,
          },
          statusMarkers: [],
          features: {
            approvedAggregates: {
              latestSnapshot: {
                snapshotAt: '2026-05-20T00:00:00.000Z',
                factCount: 12,
                calculationVersion: 'competency-v2',
                competencyVector: strongSnapshotVector,
              },
            },
            adaptiveLearnerState: adaptiveLearnerStateFeature(),
            simulationArena: {
              recent30d: simulationArenaWindow(),
              allTime: simulationArenaWindow({
                qualityMarkers: ['partial', 'low-confidence', 'preview-only', 'standalone-only'],
              }),
            },
            pathExecution: pathExecutionFeature(),
          },
        }),
      },
      learningFact: {
        findMany: async () => [
          controlCorrectionFact('question', '2026-05-19T00:00:00.000Z', 92),
          controlCorrectionFact('simulation', '2026-05-18T00:00:00.000Z', 90),
          controlCorrectionFact('arena', '2026-05-17T00:00:00.000Z', 88),
          controlCorrectionFact('reflection', '2026-05-16T00:00:00.000Z', 86),
          controlCorrectionFact('konling', '2026-05-15T00:00:00.000Z', 84, {
            contextJson: { goalId: 'control-correction', evidenceSummary: { materialized: true } },
          }),
        ],
      },
    }), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(slice).toBeDefined();
    if (!slice) throw new Error('expected control-correction goal slice');
    expect(slice.dimensions.find((dimension) => dimension.id === 'simulation-validation')).toMatchObject({
      freshness: 'partial',
      confidence: expect.objectContaining({ state: 'low' }),
      fallbackMarkers: expect.arrayContaining([
        'partial-simulation-evidence',
        'preview-only-simulation-arena-evidence',
        'standalone-only-simulation-arena-evidence',
        'low-confidence',
      ]),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'root-locus-reasoning')).toMatchObject({
      freshness: 'partial',
      confidence: expect.objectContaining({ state: 'low' }),
      fallbackMarkers: expect.arrayContaining([
        'partial-simulation-evidence',
        'partial-arena-evidence',
        'preview-only-simulation-arena-evidence',
        'standalone-only-simulation-arena-evidence',
        'low-confidence',
      ]),
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'time-domain-analysis')).toMatchObject({
      freshness: 'current',
      confidence: expect.objectContaining({ state: 'high' }),
      fallbackMarkers: [],
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'reflection')).toMatchObject({
      confidence: expect.objectContaining({ state: 'high' }),
      fallbackMarkers: [],
    });
    expect(slice.dimensions.find((dimension) => dimension.id === 'ai-collaboration')).toMatchObject({
      confidence: expect.objectContaining({ state: 'high' }),
      fallbackMarkers: [],
    });
  });

  it('rejects control-correction goal slices without privacy or confidence metadata', async () => {
    const state = await readAdaptiveLearnerState(createDb(), {
      userId: 'student-1',
      role: 'student',
      now: new Date('2026-05-20T03:00:00.000Z'),
      goal: 'control-correction',
    });

    const slice = state.goalSlices?.controlCorrection;
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      dimensions: slice?.dimensions.map((dimension, index) => (
        index === 0 ? { ...dimension, confidence: undefined } : dimension
      )),
    })).toThrow('control-correction dimension missing confidence metadata');
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      dimensions: slice?.dimensions.map((dimension, index) => (
        index === 0 ? { ...dimension, privacy: undefined } : dimension
      )),
    })).toThrow('control-correction dimension missing privacy metadata');
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      dimensions: slice?.dimensions.map((dimension, index) => (
        index === 0 ? { ...dimension, confidence: { ...dimension.confidence, score: undefined } } : dimension
      )),
    })).toThrow('control-correction dimension missing confidence metadata');
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      dimensions: slice?.dimensions.map((dimension, index) => (
        index === 0 ? {
          ...dimension,
          privacy: { ...dimension.privacy, rawPayloads: 'student-visible' },
        } : dimension
      )),
    })).toThrow('control-correction dimension missing privacy metadata');
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      privacyClasses: { student: 'student-visible' },
    })).toThrow('control-correction goal slice missing privacy classes');
    expect(() => validateControlCorrectionGoalSliceContract({
      ...slice,
      targetLevels: ['foundation'],
    })).toThrow('control-correction goal slice missing target levels');
  });
});

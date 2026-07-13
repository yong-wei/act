import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompetencyVector } from '../competency-model';

const mocks = vi.hoisted(() => ({
  prisma: {
    studentEvidenceFeatureCache: {
      findUnique: vi.fn(),
    },
    studentCompetencySnapshot: {
      findFirst: vi.fn(),
    },
    studentRiskFlag: {
      findMany: vi.fn(),
    },
    learningFact: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    userProgress: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { generateRecommendations } from '../recommendation-engine';
import { STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION } from '../student-evidence-feature-cache';

const strongSnapshotVector: CompetencyVector = {
  controlModeling: { score: 86, trend: 'stable', confidence: 0.82, evidenceCount: 6, lastUpdated: '2026-05-18T00:00:00.000Z' },
  parameterDesign: { score: 82, trend: 'stable', confidence: 0.8, evidenceCount: 6, lastUpdated: '2026-05-18T00:00:00.000Z' },
  crossDomainTransfer: { score: 88, trend: 'stable', confidence: 0.81, evidenceCount: 6, lastUpdated: '2026-05-18T00:00:00.000Z' },
  engineeringDecision: { score: 80, trend: 'stable', confidence: 0.78, evidenceCount: 5, lastUpdated: '2026-05-18T00:00:00.000Z' },
  inquiryReflection: { score: 77, trend: 'stable', confidence: 0.76, evidenceCount: 5, lastUpdated: '2026-05-18T00:00:00.000Z' },
  selfDirectedLearning: { score: 79, trend: 'stable', confidence: 0.74, evidenceCount: 5, lastUpdated: '2026-05-18T00:00:00.000Z' },
};

const cacheVector: CompetencyVector = {
  controlModeling: { score: 82, trend: 'stable', confidence: 0.82, evidenceCount: 7, lastUpdated: '2026-05-18T00:00:00.000Z' },
  parameterDesign: { score: 74, trend: 'stable', confidence: 0.78, evidenceCount: 6, lastUpdated: '2026-05-18T00:00:00.000Z' },
  crossDomainTransfer: { score: 42, trend: 'down', confidence: 0.62, evidenceCount: 7, lastUpdated: '2026-05-18T00:00:00.000Z' },
  engineeringDecision: { score: 69, trend: 'stable', confidence: 0.7, evidenceCount: 5, lastUpdated: '2026-05-18T00:00:00.000Z' },
  inquiryReflection: { score: 63, trend: 'stable', confidence: 0.66, evidenceCount: 4, lastUpdated: '2026-05-18T00:00:00.000Z' },
  selfDirectedLearning: { score: 61, trend: 'stable', confidence: 0.64, evidenceCount: 4, lastUpdated: '2026-05-18T00:00:00.000Z' },
};

function emptySimulationArenaWindow() {
  return {
    window: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
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
    interventionOutcome: {
      reviewedCount: 0,
      improvedCount: 0,
      lowConfidenceCount: 0,
    },
    weakMetrics: [],
    qualityMarkers: [],
    traceReferences: [],
  };
}

function emptySimulationArenaFeature() {
  return {
    recent30d: emptySimulationArenaWindow(),
    allTime: emptySimulationArenaWindow(),
  };
}

function emptyPathExecutionWindow() {
  return {
    window: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
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
    sourceReferences: [],
  };
}

function emptyPathExecutionFeature() {
  return {
    recent30d: emptyPathExecutionWindow(),
    allTime: emptyPathExecutionWindow(),
  };
}

function defaultApprovedAggregates() {
  return {
    latestSnapshot: {
      snapshotAt: '2026-05-18T00:00:00.000Z',
      factCount: 7,
      calculationVersion: 'v1',
      competencyVector: cacheVector,
    },
    profileSummary: {
      updatedAt: '2026-05-18T00:00:00.000Z',
      overallScore: 65,
      riskLevel: 'medium',
      trendDirection: 'down',
    },
  };
}

function defaultAdaptiveLearnerStateFeature() {
  return {
    payloadVersion: 'adaptive-learner-state.v1',
    sourceWindows: {
      learnerStateRecent30d: {
        firstStartedAt: '2026-05-01T00:00:00.000Z',
        lastStartedAt: '2026-05-18T00:00:00.000Z',
        daysCovered: 17,
      },
      learnerStateAllTime: {
        firstStartedAt: '2026-05-01T00:00:00.000Z',
        lastStartedAt: '2026-05-18T00:00:00.000Z',
        daysCovered: 17,
      },
    },
    sourceCoverage: {
      primaryCompetencies: 'available',
      knowledgeMastery: 'missing',
      resourcePreference: 'missing',
      mediaAbsorption: 'missing',
      pathContext: 'missing',
      simulationArena: 'missing',
    },
    sourceCounts: {
      LearningFact: 7,
      AdaptiveMasteryEvidence: 0,
    },
    confidence: {
      level: 'medium',
      score: 0.66,
      evidenceCount: 7,
      sourceCompleteness: 0.86,
      markers: [],
    },
  };
}

function evidenceCache(overrides: Record<string, unknown> = {}) {
  const overrideFeatures = overrides.features && typeof overrides.features === 'object'
    ? overrides.features as Record<string, unknown>
    : {};

  return {
    userId: 'student-1',
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    refreshedAt: new Date('2026-05-19T00:00:00.000Z'),
    evidenceWindow: {
      firstStartedAt: '2026-05-01T00:00:00.000Z',
      lastStartedAt: '2026-05-18T00:00:00.000Z',
      daysCovered: 17,
    },
    sourceCounts: {
      LearningFact: 7,
      StudentCompetencySnapshot: 1,
      StudentProfileSummary: 1,
      byFactType: { question: 4, design: 3 },
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'available',
      StudentProfileSummary: 'available',
    },
    confidenceMarkers: {
      level: 'medium',
      score: 0.66,
      evidenceCount: 7,
      sourceCompleteness: 0.86,
    },
    statusMarkers: [],
    features: {
      approvedAggregates: defaultApprovedAggregates(),
      adaptiveLearnerState: defaultAdaptiveLearnerStateFeature(),
      simulationArena: emptySimulationArenaFeature(),
      pathExecution: emptyPathExecutionFeature(),
      ...overrideFeatures,
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => key !== 'features')
    ),
  };
}

function previewOnlySimulationArenaFeature() {
  return {
    recent30d: {
      window: {
        firstStartedAt: '2026-05-18T08:00:00.000Z',
        lastStartedAt: '2026-05-18T08:00:00.000Z',
        daysCovered: 0,
      },
      evidenceCount: 2,
      completedCount: 0,
      officialCount: 0,
      previewCount: 2,
      agentAssistedCount: 0,
      courseLaunchedCount: 0,
      standaloneCount: 2,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'partial',
      },
      replayConfidence: {
        average: 0.39,
        highConfidenceCount: 0,
        lowConfidenceCount: 2,
        missingCount: 0,
      },
      interventionOutcome: {
        reviewedCount: 0,
        improvedCount: 0,
        lowConfidenceCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 2, lowestValue: 0.32 },
      ],
      qualityMarkers: ['low-confidence', 'preview-only', 'standalone-only'],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaVirtualSimulationRun:preview-1',
          factId: 'fact-preview-1',
          startedAt: '2026-05-18T08:00:00.000Z',
        },
      ],
    },
    allTime: {
      window: {
        firstStartedAt: '2026-05-18T08:00:00.000Z',
        lastStartedAt: '2026-05-18T08:00:00.000Z',
        daysCovered: 0,
      },
      evidenceCount: 2,
      completedCount: 0,
      officialCount: 0,
      previewCount: 2,
      agentAssistedCount: 0,
      courseLaunchedCount: 0,
      standaloneCount: 2,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'partial',
      },
      replayConfidence: {
        average: 0.39,
        highConfidenceCount: 0,
        lowConfidenceCount: 2,
        missingCount: 0,
      },
      interventionOutcome: {
        reviewedCount: 0,
        improvedCount: 0,
        lowConfidenceCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 2, lowestValue: 0.32 },
      ],
      qualityMarkers: ['low-confidence', 'preview-only', 'standalone-only'],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaVirtualSimulationRun:preview-1',
          factId: 'fact-preview-1',
          startedAt: '2026-05-18T08:00:00.000Z',
        },
      ],
    },
  };
}

describe('generateRecommendations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    vi.clearAllMocks();
    delete process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED;
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: strongSnapshotVector,
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      factCount: 12,
    });
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findFirst.mockResolvedValue(null);
    mocks.prisma.userProgress.count.mockImplementation(async (args?: { where?: { status?: string } }) =>
      args?.where?.status === 'COMPLETED' ? 6 : 8
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the governed feature cache as the recommendation evidence source', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());

    const recommendations = await generateRecommendations('student-1');

    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
    expect(recommendations.map((item) => item.title)).toContain('提升迁移整合与应用能力');
    const weakDimension = recommendations.find((item) => item.title === '提升迁移整合与应用能力');
    expect(weakDimension?.rationale).toMatchObject({
      reasonCode: 'weak-dimension-practice',
      evidenceBasis: 'student-evidence-feature-cache',
      evidenceRole: 'direct',
      evidenceCount: 7,
      evidenceWindow: {
        firstStartedAt: '2026-05-01T00:00:00.000Z',
        lastStartedAt: '2026-05-18T00:00:00.000Z',
      },
      sourceCoverage: {
        LearningFact: 'available',
        StudentCompetencySnapshot: 'available',
        StudentProfileSummary: 'available',
      },
      confidence: {
        state: 'ready',
        level: 'medium',
        score: 0.66,
      },
    });
  });

  it('marks recommendation rationale as missing when the feature cache is absent', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.userProgress.count.mockResolvedValue(0);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((item) => item.rationale.confidence.state === 'missing')).toBe(true);
    const contextOnly = recommendations.find((item) => item.title === '探索知识图谱');
    expect(contextOnly?.rationale).toMatchObject({
      reasonCode: 'knowledge-graph-exploration',
      evidenceRole: 'context',
      contextOnly: true,
      confidence: {
        state: 'missing',
        level: 'low',
      },
    });
  });

  it('exposes simulation and Arena rationale without treating preview-only context as high-confidence competency evidence', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      confidenceMarkers: {
        level: 'high',
        score: 0.91,
        evidenceCount: 8,
        sourceCompleteness: 1,
      },
      features: {
        approvedAggregates: {
          latestSnapshot: {
            snapshotAt: '2026-05-18T00:00:00.000Z',
            factCount: 8,
            calculationVersion: 'v1',
            competencyVector: cacheVector,
          },
          profileSummary: {
            updatedAt: '2026-05-18T00:00:00.000Z',
            overallScore: 65,
            riskLevel: 'medium',
            trendDirection: 'down',
          },
        },
        simulationArena: previewOnlySimulationArenaFeature(),
      },
    }));
    mocks.prisma.userProgress.count.mockResolvedValue(0);

    const recommendations = await generateRecommendations('student-1');
    const weakDimension = recommendations.find((item) => item.title === '提升迁移整合与应用能力');
    const contextOnly = recommendations.find((item) => item.title === '探索知识图谱');

    expect((weakDimension?.rationale as any).simulationArena).toMatchObject({
      readiness: 'low-confidence',
      evidenceKinds: ['preview-only', 'standalone'],
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 2, lowestValue: 0.32 },
      ],
      replayConfidence: {
        average: 0.39,
        lowConfidenceCount: 2,
      },
      qualityMarkers: ['low-confidence', 'preview-only', 'standalone-only'],
    });
    expect(contextOnly?.rationale.contextOnly).toBe(true);
    expect(contextOnly?.rationale.confidence.level).toBe('medium');
    expect((contextOnly?.rationale as any).simulationArena).toMatchObject({
      readiness: 'low-confidence',
      evidenceKinds: ['preview-only', 'standalone'],
    });
  });

  it('cites governed path execution features without raw execution scans or model-authored text', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      features: {
        pathExecution: {
          recent30d: emptyPathExecutionWindow(),
          allTime: {
            ...emptyPathExecutionWindow(),
            window: {
              firstStartedAt: '2026-06-04T10:00:00.000Z',
              lastStartedAt: '2026-06-04T10:20:00.000Z',
              daysCovered: 1,
            },
            evidenceCount: 4,
            adoptionCount: 1,
            completionCount: 1,
            deviationCount: 1,
            fallbackCount: 1,
            terminalValidationCount: 1,
            sourceCoverage: {
              adoption: 'available',
              completion: 'available',
              deviation: 'available',
              fallback: 'available',
              terminalValidation: 'available',
              interventionOutcome: 'available',
            },
            confidence: {
              level: 'medium',
              score: 0.88,
              lowConfidenceCount: 1,
            },
            interventionOutcome: {
              acceptedCount: 1,
              completedCount: 0,
              dismissedCount: 0,
              lowConfidenceCount: 1,
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
                occurredAt: '2026-06-04T10:06:00.000Z',
                privacyLevel: 'teacher-scoped',
                interventionKind: 'hint',
                studentOutcome: 'accepted',
              },
            ],
          },
        },
      },
    }));

    const recommendations = await generateRecommendations('student-1');
    const weakDimension = recommendations.find((item) => item.title === '提升迁移整合与应用能力');

    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'student-1' }),
    }));
    expect(mocks.prisma).not.toHaveProperty('learningPathExecution');
    expect((weakDimension?.rationale as any).pathExecution).toMatchObject({
      readiness: 'partial',
      featureGroup: 'pathExecution',
      evidenceCount: 4,
      evidenceWindow: {
        firstStartedAt: '2026-06-04T10:00:00.000Z',
        lastStartedAt: '2026-06-04T10:20:00.000Z',
      },
      sourceCoverage: {
        completion: 'available',
        terminalValidation: 'available',
        interventionOutcome: 'available',
      },
      confidence: {
        level: 'medium',
        lowConfidenceCount: 1,
      },
      sourceReferences: [
        expect.objectContaining({
          sourceType: 'LearningPathExecution',
          sourceId: 'exec-1',
        }),
      ],
    });
    expect((weakDimension?.rationale as any).pathExecution.sourceReferences).toHaveLength(1);
    expect(JSON.stringify((weakDimension?.rationale as any).pathExecution)).not.toContain('suggestedAction');
    expect(JSON.stringify((weakDimension?.rationale as any).pathExecution)).not.toContain('int-1');
  });

  it('keeps stale evidence state ahead of simulation Arena low-confidence downgrade', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      refreshedAt: new Date('2026-04-01T00:00:00.000Z'),
      confidenceMarkers: {
        level: 'high',
        score: 0.91,
        evidenceCount: 8,
        sourceCompleteness: 1,
      },
      features: {
        approvedAggregates: {
          latestSnapshot: {
            snapshotAt: '2026-05-18T00:00:00.000Z',
            factCount: 8,
            calculationVersion: 'v1',
            competencyVector: cacheVector,
          },
          profileSummary: {
            updatedAt: '2026-05-18T00:00:00.000Z',
            overallScore: 65,
            riskLevel: 'medium',
            trendDirection: 'down',
          },
        },
        simulationArena: previewOnlySimulationArenaFeature(),
      },
    }));

    const recommendations = await generateRecommendations('student-1');
    const weakDimension = recommendations.find((item) => item.title === '提升迁移整合与应用能力');

    expect(weakDimension?.rationale.confidence).toMatchObject({
      state: 'stale',
      level: 'high',
    });
    expect((weakDimension?.rationale as any).simulationArena).toMatchObject({
      readiness: 'low-confidence',
    });
  });

  it('downgrades top-level rationale state when simulation Arena evidence is partial', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      confidenceMarkers: {
        level: 'high',
        score: 0.91,
        evidenceCount: 8,
        sourceCompleteness: 1,
      },
      features: {
        approvedAggregates: {
          latestSnapshot: {
            snapshotAt: '2026-05-18T00:00:00.000Z',
            factCount: 8,
            calculationVersion: 'v1',
            competencyVector: cacheVector,
          },
          profileSummary: null,
        },
        simulationArena: {
          recent30d: {
            ...previewOnlySimulationArenaFeature().recent30d,
            previewCount: 0,
            courseLaunchedCount: 2,
            standaloneCount: 0,
            traceReferenceCount: 1,
            sourceCoverage: {
              simulation: 'available',
              arena: 'available',
              traceReferences: 'partial',
              replayConfidence: 'partial',
            },
            replayConfidence: {
              average: 0.76,
              highConfidenceCount: 1,
              lowConfidenceCount: 0,
              missingCount: 1,
            },
            qualityMarkers: ['partial'],
          },
          allTime: {
            ...previewOnlySimulationArenaFeature().allTime,
            previewCount: 0,
            courseLaunchedCount: 2,
            standaloneCount: 0,
            traceReferenceCount: 1,
            sourceCoverage: {
              simulation: 'available',
              arena: 'available',
              traceReferences: 'partial',
              replayConfidence: 'partial',
            },
            replayConfidence: {
              average: 0.76,
              highConfidenceCount: 1,
              lowConfidenceCount: 0,
              missingCount: 1,
            },
            qualityMarkers: ['partial'],
          },
        },
      },
    }));

    const recommendations = await generateRecommendations('student-1');
    const weakDimension = recommendations.find((item) => item.title === '提升迁移整合与应用能力');

    expect(weakDimension?.rationale.confidence).toMatchObject({
      state: 'partial',
      level: 'high',
    });
    expect((weakDimension?.rationale as any).simulationArena).toMatchObject({
      readiness: 'partial',
    });
  });

  it('uses server learner state as the authoritative vector when the service is enabled', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.map((item) => item.title)).not.toContain('提升迁移整合与应用能力');
    expect(recommendations.map((item) => item.title)).toContain('挑战专家级任务');
  });

  it('falls back from learner state to the feature cache when direct personalization evidence is weak', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      statusMarkers: ['low-confidence'],
      confidenceMarkers: {
        level: 'low',
        score: 0.31,
        evidenceCount: 7,
        sourceCompleteness: 0.86,
      },
    }));

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.map((item) => item.title)).toContain('提升迁移整合与应用能力');
    expect(recommendations.map((item) => item.title)).not.toContain('挑战专家级任务');
  });
});

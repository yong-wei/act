import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('uses the governed feature cache as the recommendation evidence source', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());

    const recommendations = await generateRecommendations('student-1');

    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
    expect(recommendations.map((item) => item.title)).toContain('提升跨域迁移与联动能力');
    const weakDimension = recommendations.find((item) => item.title === '提升跨域迁移与联动能力');
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
    const weakDimension = recommendations.find((item) => item.title === '提升跨域迁移与联动能力');
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
    const weakDimension = recommendations.find((item) => item.title === '提升跨域迁移与联动能力');

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
    const weakDimension = recommendations.find((item) => item.title === '提升跨域迁移与联动能力');

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

    expect(recommendations.map((item) => item.title)).not.toContain('提升跨域迁移与联动能力');
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

    expect(recommendations.map((item) => item.title)).toContain('提升跨域迁移与联动能力');
    expect(recommendations.map((item) => item.title)).not.toContain('挑战专家级任务');
  });
});

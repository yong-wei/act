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
    studentPortraitV2Snapshot: {
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
import { PORTRAIT_V2_DIMENSIONS } from '../kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
} from '../portrait-v2-model';
import { buildMigratedPortraitPayload } from '../portrait-v2-migration';

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

function strongNativePortrait(
  evidencedIds = new Set(PORTRAIT_V2_DIMENSIONS.map(({ id }) => id)),
  freshnessState: 'current' | 'partial' | 'stale' = 'current',
  score = 85,
  confidence = 0.82
) {
  const evidenceAsOf = freshnessState === 'stale'
    ? '2026-01-01T00:00:00.000Z'
    : freshnessState === 'partial'
      ? '2026-04-01T00:00:00.000Z'
      : '2026-05-18T00:00:00.000Z';
  return createPortraitV2Payload({
    userId: 'student-1',
    generatedAt: '2026-05-18T00:00:00.000Z',
    now: '2026-05-20T12:00:00.000Z',
    dimensions: PORTRAIT_V2_DIMENSIONS.map(({ id }) => evidencedIds.has(id)
      ? {
          id,
          score,
          confidence,
          trend: 'stable' as const,
          freshness: {
            state: freshnessState,
            asOf: evidenceAsOf,
            evidenceAgeDays: freshnessState === 'stale' ? 137 : freshnessState === 'partial' ? 47 : 0,
          },
          evidenceSummary: { totalCount: 4, sourceFamilyCounts: { LearningFact: 4 } },
          lastPositiveEvidenceAt: evidenceAsOf,
          lastNegativeEvidenceAt: null,
          rationale: 'Governed evidence supports the current score.',
          limitations: [],
          sourceLineage: [{ kind: 'evidence-family' as const, ref: 'LearningFact', privacyScope: 'student-visible' as const }],
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        }
      : {
          id,
          score: 0,
          confidence: 0,
          trend: 'stable' as const,
          freshness: { state: 'missing' as const, asOf: null, evidenceAgeDays: null },
          evidenceSummary: { totalCount: 0, sourceFamilyCounts: {} as Record<string, number> },
          lastPositiveEvidenceAt: null,
          lastNegativeEvidenceAt: null,
          rationale: 'No safe legacy mapping exists.',
          limitations: ['missing-native-portrait-v2-evidence'],
          sourceLineage: [],
          calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        }),
  });
}

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
      StudentPortraitV2Snapshot: 0,
      StudentProfileSummary: 1,
      byFactType: { question: 4, design: 3 },
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'available',
      StudentPortraitV2Snapshot: 'missing',
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
      // Persisted shape: identity diagnostics live inside features JSON.
      knowledgeIdentityCoverage: {
        totalFacts: 7,
        byNamespace: { LEGACY: 7, CANONICAL: 0, LEGACY_UNVERSIONED: 0 },
        distinctRevisionRefs: ['legacy-active:pre-cutover-v1'],
        mixedNamespaces: false,
        mixedRevisions: false,
        singleVersionComparable: true,
        availability: 'single-version',
      },
      knowledgeIdentityLayers: [
        {
          layerKey: 'LEGACY\u001flegacy-active:pre-cutover-v1',
          identityNamespace: 'LEGACY',
          knowledgeRevisionRef: 'legacy-active:pre-cutover-v1',
          factCount: 7,
          evidenceWindow: {
            firstStartedAt: '2026-05-01T00:00:00.000Z',
            lastStartedAt: '2026-05-18T00:00:00.000Z',
            daysCovered: 17,
          },
          activity: {
            totalFacts: 7,
            successfulFacts: 7,
            partialFacts: 0,
            failedFacts: 0,
            averageScore: 80,
            totalTimeSpentSeconds: 0,
            distinctLessons: [],
            distinctModules: [],
          },
          competencyContributions: {},
        },
      ],
      mergedAggregateComparability: {
        singleVersionComparable: true,
        reason: 'single-layer',
        layerCount: 1,
      },
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
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue(null);
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

  it('excludes ungoverned LearningFacts from recommendation activity evidence', async () => {
    mocks.prisma.learningFact.findMany.mockResolvedValue([{
      factType: 'question',
      outcome: 'success',
      startedAt: new Date('2026-05-20T10:00:00.000Z'),
      score: 100,
      contextJson: {},
    }]);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((item) => item.rationale.evidenceCount === 0)).toBe(true);
  });

  it('fails closed on pre-#1116 v4 feature caches without knowledge identity diagnostics', async () => {
    // Explicitly omit knowledgeIdentityCoverage / layers so missing diagnostics
    // cannot be treated as single-version comparable after #1116 rollout.
    const v4Cache = evidenceCache({
      payloadVersion: 'student-evidence-features.v4',
      // Keep cache freshness current so state reflects identity fail-closed, not stale.
      refreshedAt: new Date('2026-05-20T12:00:00.000Z'),
    });
    // evidenceCache spreads overrides after defaults; force-delete identity fields
    // from both top-level compatibility fields and features JSON.
    delete (v4Cache as { knowledgeIdentityCoverage?: unknown }).knowledgeIdentityCoverage;
    delete (v4Cache as { knowledgeIdentityLayers?: unknown }).knowledgeIdentityLayers;
    delete (v4Cache as { mergedAggregateComparability?: unknown }).mergedAggregateComparability;
    const features = v4Cache.features as Record<string, unknown>;
    delete features.knowledgeIdentityCoverage;
    delete features.knowledgeIdentityLayers;
    delete features.mergedAggregateComparability;
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(v4Cache);

    const recommendations = await generateRecommendations('student-1');
    expect(recommendations.length).toBeGreaterThan(0);
    const cacheBacked = recommendations.filter(
      (item) => item.rationale.evidenceBasis === 'student-evidence-feature-cache',
    );
    expect(cacheBacked.length).toBeGreaterThan(0);
    for (const item of cacheBacked) {
      expect(item.rationale.confidence.state).toBe('partial');
      expect(item.rationale.confidence.markers).toEqual(
        expect.arrayContaining(['mixed-knowledge-identity', 'partial']),
      );
      // Must not present undiagnosed multi-era merge as ready single-version evidence.
      expect(item.rationale.confidence.state).not.toBe('ready');
      expect(item.rationale.confidence.level === 'high').toBe(false);
    }
  });

  it('consumes identity diagnostics from persisted features JSON (not only top-level)', async () => {
    // Simulate real Prisma cache: diagnostics live only under features.
    const cache = evidenceCache({
      refreshedAt: new Date('2026-05-20T12:00:00.000Z'),
    });
    delete (cache as { knowledgeIdentityCoverage?: unknown }).knowledgeIdentityCoverage;
    delete (cache as { knowledgeIdentityLayers?: unknown }).knowledgeIdentityLayers;
    delete (cache as { mergedAggregateComparability?: unknown }).mergedAggregateComparability;
    // features retains single-version diagnostics (set by evidenceCache helper).
    expect((cache.features as any).knowledgeIdentityCoverage?.singleVersionComparable).toBe(true);
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);

    const recommendations = await generateRecommendations('student-1');
    const cacheBacked = recommendations.filter(
      (item) => item.rationale.evidenceBasis === 'student-evidence-feature-cache',
    );
    expect(cacheBacked.length).toBeGreaterThan(0);
    for (const item of cacheBacked) {
      // With features-only diagnostics present, single-version path remains usable.
      expect(item.rationale.confidence.state).not.toBe('partial');
      expect(item.rationale.confidence.markers).not.toEqual(
        expect.arrayContaining(['mixed-knowledge-identity']),
      );
    }
  });

  it('does not treat explicit empty LearningFact identity coverage as mixed for path-only v5 caches', async () => {
    // Valid v5 cache: zero LearningFacts (empty identity coverage) but path evidence present.
    // Empty is not multi-version conflict — must not invent mixed-knowledge-identity or cap confidence.
    const pathAllTime = {
      ...emptyPathExecutionWindow(),
      window: {
        firstStartedAt: '2026-05-18T10:00:00.000Z',
        lastStartedAt: '2026-05-18T10:20:00.000Z',
        daysCovered: 1,
      },
      evidenceCount: 3,
      adoptionCount: 1,
      completionCount: 1,
      deviationCount: 0,
      fallbackCount: 0,
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
        score: 0.8,
        lowConfidenceCount: 0,
      },
      interventionOutcome: {
        acceptedCount: 1,
        completedCount: 1,
        dismissedCount: 0,
        lowConfidenceCount: 0,
      },
      sourceReferences: [
        {
          sourceType: 'LearningPathExecution',
          sourceId: 'exec-path-only-1',
          pathId: 'path-1',
          nodeId: 'node-1',
          occurredAt: '2026-05-18T10:20:00.000Z',
          privacyLevel: 'student-visible',
          status: 'completed',
          resourceType: 'arena_task',
        },
      ],
    };
    const emptyIdentityCoverage = {
      totalFacts: 0,
      byNamespace: { LEGACY: 0, CANONICAL: 0, LEGACY_UNVERSIONED: 0 },
      distinctRevisionRefs: [] as string[],
      mixedNamespaces: false,
      mixedRevisions: false,
      singleVersionComparable: false,
      availability: 'empty' as const,
    };
    const cache = evidenceCache({
      payloadVersion: 'student-evidence-features.v5',
      refreshedAt: new Date('2026-05-20T12:00:00.000Z'),
      sourceCounts: {
        LearningFact: 0,
        StudentCompetencySnapshot: 1,
        StudentPortraitV2Snapshot: 0,
        StudentProfileSummary: 1,
        byFactType: {},
      },
      sourceCoverage: {
        LearningFact: 'missing',
        StudentCompetencySnapshot: 'available',
        StudentPortraitV2Snapshot: 'missing',
        StudentProfileSummary: 'available',
      },
      confidenceMarkers: {
        level: 'medium',
        score: 0.72,
        evidenceCount: 3,
        sourceCompleteness: 0.7,
      },
      statusMarkers: [],
      features: {
        knowledgeIdentityCoverage: emptyIdentityCoverage,
        knowledgeIdentityLayers: [],
        mergedAggregateComparability: {
          singleVersionComparable: false,
          reason: 'empty',
          layerCount: 0,
        },
        pathExecution: {
          recent30d: pathAllTime,
          allTime: pathAllTime,
        },
      },
    });
    // Real Prisma shape: diagnostics only under features JSON.
    delete (cache as { knowledgeIdentityCoverage?: unknown }).knowledgeIdentityCoverage;
    delete (cache as { knowledgeIdentityLayers?: unknown }).knowledgeIdentityLayers;
    delete (cache as { mergedAggregateComparability?: unknown }).mergedAggregateComparability;
    expect((cache.features as any).knowledgeIdentityCoverage).toMatchObject({
      availability: 'empty',
      totalFacts: 0,
      singleVersionComparable: false,
    });
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);

    const recommendations = await generateRecommendations('student-1');
    const cacheBacked = recommendations.filter(
      (item) => item.rationale.evidenceBasis === 'student-evidence-feature-cache',
    );
    expect(cacheBacked.length).toBeGreaterThan(0);

    for (const item of cacheBacked) {
      // No false mixed marker solely because LearningFact coverage is empty.
      expect(item.rationale.confidence.markers).not.toEqual(
        expect.arrayContaining(['mixed-knowledge-identity']),
      );
      // Identity emptiness must not force partial + low confidence cap.
      expect(item.rationale.confidence.state).not.toBe('partial');
      expect(item.rationale.confidence.level).toBe('medium');
      expect(item.rationale.confidence.score).toBe(0.72);
      expect(item.rationale.confidence.level === 'low').toBe(false);
    }

    // Path-only evidence remains usable and is not identity-degraded.
    const withPath = cacheBacked.find((item) => (item.rationale as any).pathExecution);
    expect(withPath).toBeDefined();
    expect((withPath?.rationale as any).pathExecution).toMatchObject({
      readiness: 'ready',
      featureGroup: 'pathExecution',
      evidenceCount: 3,
      confidence: {
        level: 'medium',
        lowConfidenceCount: 0,
      },
    });
  });

  it('still fails closed for non-empty mixed-version LearningFact identity coverage', async () => {
    const cache = evidenceCache({
      payloadVersion: 'student-evidence-features.v5',
      refreshedAt: new Date('2026-05-20T12:00:00.000Z'),
      features: {
        knowledgeIdentityCoverage: {
          totalFacts: 4,
          byNamespace: { LEGACY: 2, CANONICAL: 2, LEGACY_UNVERSIONED: 0 },
          distinctRevisionRefs: ['legacy-active:pre-cutover-v1', 'canonical:rev-a'],
          mixedNamespaces: true,
          mixedRevisions: true,
          singleVersionComparable: false,
          availability: 'mixed-version',
        },
        knowledgeIdentityLayers: [],
        mergedAggregateComparability: {
          singleVersionComparable: false,
          reason: 'mixed-layers',
          layerCount: 2,
        },
      },
    });
    delete (cache as { knowledgeIdentityCoverage?: unknown }).knowledgeIdentityCoverage;
    delete (cache as { knowledgeIdentityLayers?: unknown }).knowledgeIdentityLayers;
    delete (cache as { mergedAggregateComparability?: unknown }).mergedAggregateComparability;
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(cache);

    const recommendations = await generateRecommendations('student-1');
    const cacheBacked = recommendations.filter(
      (item) => item.rationale.evidenceBasis === 'student-evidence-feature-cache',
    );
    expect(cacheBacked.length).toBeGreaterThan(0);
    for (const item of cacheBacked) {
      expect(item.rationale.confidence.state).toBe('partial');
      expect(item.rationale.confidence.markers).toEqual(
        expect.arrayContaining(['mixed-knowledge-identity', 'partial']),
      );
      expect(item.rationale.confidence.level).toBe('low');
      expect(item.rationale.confidence.score).toBeLessThanOrEqual(0.45);
    }
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

  it.each(['no-recent-evidence', 'no-evidence-after-revocation'])('does not generate current recommendations for %s', async (state) => {
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: strongSnapshotVector,
      snapshotAt: new Date('2026-05-20T00:00:00.000Z'),
      factCount: 0,
      evidenceSummary: { _derivation: { state } },
    });
    expect(await generateRecommendations('student-1')).toEqual([]);
    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).not.toHaveBeenCalled();
  });

  it('derives compatibility scores from native portrait v2 for rules without a legacy snapshot', async () => {
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-1',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const recommendations = await generateRecommendations('student-1');
    const titles = recommendations.map((item) => item.title);

    expect(titles).toContain('挑战专家级任务');
    expect(titles).toContain('伦理决策挑战');
    expect(titles).toContain('参数优化大师');
    expect(titles).not.toContain('工程决策训练');
    for (const recommendation of recommendations.filter((item) =>
      ['挑战专家级任务', '伦理决策挑战', '参数优化大师'].includes(item.title)
    )) {
      expect(recommendation.rationale).toMatchObject({
        evidenceBasis: 'portrait-v2',
        evidenceCount: 4,
        sourceCoverage: {
          LearningFact: 'available',
          StudentCompetencySnapshot: 'missing',
        },
        confidence: { state: 'ready', level: 'high', score: 0.82 },
      });
    }
  });

  it('keeps portrait v2 as the rationale source when a legacy feature cache also exists', async () => {
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-with-cache',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const expert = (await generateRecommendations('student-1'))
      .find((item) => item.title === '挑战专家级任务');

    expect(expert?.rationale).toMatchObject({
      evidenceBasis: 'portrait-v2',
      evidenceCount: 4,
    });
  });

  it('scopes portrait rationale evidence to the dimensions used by each rule', async () => {
    const base = strongNativePortrait();
    const portrait = {
      ...base,
      dimensions: base.dimensions.map((dimension) => {
        const relevant = dimension.id === 'engineeringConstraintSafety';
        const count = relevant ? 2 : 20;
        return {
          ...dimension,
          confidence: relevant ? 0.9 : 0.45,
          evidenceSummary: {
            totalCount: count,
            sourceFamilyCounts: { LearningFact: count },
          },
        };
      }),
    };
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-rule-scoped-rationale',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const ethics = (await generateRecommendations('student-1'))
      .find((item) => item.title === '伦理决策挑战');

    expect(ethics?.rationale).toMatchObject({
      evidenceBasis: 'portrait-v2',
      evidenceCount: 2,
      confidence: { level: 'high', score: 0.9 },
      portraitV2: {
        dimensionIds: ['engineeringConstraintSafety'],
        weakDimensionId: 'engineeringConstraintSafety',
        confidence: 0.9,
        freshness: { state: 'current' },
      },
    });
  });

  it('does not run vector rules for a legacy snapshot without evidence', async () => {
    const noEvidenceVector = Object.fromEntries(Object.entries(strongSnapshotVector).map(([key, value]) => [
      key,
      { ...value, score: 0, evidenceCount: 0 },
    ])) as CompetencyVector;
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: noEvidenceVector,
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      factCount: 0,
    });

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).not.toContain('工程决策训练');
    expect(titles).not.toContain('挑战专家级任务');
  });

  it('runs a legacy rule when its required dimension has evidence', async () => {
    const partialEvidenceVector = Object.fromEntries(Object.entries(strongSnapshotVector).map(([key, value]) => [
      key,
      { ...value, score: key === 'engineeringDecision' ? 40 : value.score, evidenceCount: key === 'engineeringDecision' ? 2 : 0 },
    ])) as CompetencyVector;
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: partialEvidenceVector,
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      factCount: 2,
    });

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).toContain('工程决策训练');
    expect(titles).not.toContain('挑战专家级任务');
  });

  it('does not run direct vector rules from stale legacy evidence', async () => {
    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).not.toContain('练习跨域知识迁移');
    expect(titles).not.toContain('工程决策训练');
    expect(titles).not.toContain('挑战专家级任务');
    expect(titles).not.toContain('伦理决策挑战');
    expect(titles).not.toContain('参数优化大师');
  });

  it('does not hide a stale legacy contributor behind a current compatibility dimension', async () => {
    const mixedFreshnessVector: CompetencyVector = {
      ...strongSnapshotVector,
      inquiryReflection: {
        ...strongSnapshotVector.inquiryReflection,
        score: 10,
        lastUpdated: '2026-01-01T00:00:00.000Z',
      },
      selfDirectedLearning: {
        ...strongSnapshotVector.selfDirectedLearning,
        score: 80,
        lastUpdated: '2026-05-18T00:00:00.000Z',
      },
    };
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      features: {
        approvedAggregates: {
          ...defaultApprovedAggregates(),
          latestSnapshot: {
            ...defaultApprovedAggregates().latestSnapshot,
            competencyVector: mixedFreshnessVector,
          },
        },
      },
    }));

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).not.toContain('提升反思改进与 AI 协作能力');
  });

  it('falls back to governed cache recommendations when portrait v2 evidence is non-current', async () => {
    vi.setSystemTime(new Date('2026-06-20T00:00:00.000Z'));
    const portrait = strongNativePortrait(
      new Set(PORTRAIT_V2_DIMENSIONS.map(({ id }) => id)),
      'current',
      40
    );
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-stale',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const recommendations = await generateRecommendations('student-1');
    const titles = recommendations.map((item) => item.title);

    expect(titles).not.toContain('挑战专家级任务');
    expect(titles).not.toContain('伦理决策挑战');
    expect(recommendations.find((item) => item.title === '提升迁移整合与应用能力')?.rationale)
      .toMatchObject({ evidenceBasis: 'student-evidence-feature-cache' });
  });

  it('does not use future-dated portrait v2 evidence for direct recommendations', async () => {
    vi.setSystemTime(new Date('2026-05-17T12:00:00.000Z'));
    const portrait = strongNativePortrait(undefined, 'current', 40);
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-future-evidence',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const direct = (await generateRecommendations('student-1'))
      .filter((item) => item.rationale.evidenceRole === 'direct');

    expect(direct).toHaveLength(0);
  });

  it.each([
    ['partial freshness', strongNativePortrait(undefined, 'partial', 40)],
    ['low confidence', strongNativePortrait(undefined, 'current', 40, 0.44)],
  ])('does not use %s portrait v2 evidence for direct vector recommendations', async (_case, portrait) => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: `portrait-v2-${_case}`,
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const direct = (await generateRecommendations('student-1'))
      .filter((item) => item.rationale.evidenceRole === 'direct');

    expect(direct.length).toBeGreaterThan(0);
    expect(direct.every((item) => item.rationale.evidenceBasis !== 'portrait-v2')).toBe(true);
  });

  it('selects the weakest valid dimension when a lower portrait dimension is partial', async () => {
    const base = strongNativePortrait();
    const [partialId, validId] = PORTRAIT_V2_DIMENSIONS.map(({ id }) => id);
    const portrait = createPortraitV2Payload({
      userId: 'student-1',
      generatedAt: base.generatedAt,
      now: '2026-05-20T12:00:00.000Z',
      dimensions: base.dimensions.map((dimension) => dimension.id === partialId
        ? {
            ...dimension,
            score: 20,
            freshness: { state: 'partial' as const, asOf: '2026-04-01T00:00:00.000Z', evidenceAgeDays: 47 },
            lastPositiveEvidenceAt: '2026-04-01T00:00:00.000Z',
          }
        : dimension.id === validId
          ? { ...dimension, score: 40 }
          : dimension),
    });
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-mixed-quality', userId: 'student-1', snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion, derivationKind: portrait.derivation.kind, payload: portrait,
    });

    const weak = (await generateRecommendations('student-1'))
      .find((item) => item.rationale.reasonCode === 'weak-dimension-practice');

    expect(weak?.rationale.portraitV2?.weakDimensionId).toBe(validId);
  });

  it('keeps a migrated portrait authoritative over conflicting legacy evidence', async () => {
    const portrait = buildMigratedPortraitPayload({
      id: 'legacy-portrait-source',
      userId: 'student-1',
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      competencyVector: strongSnapshotVector,
    }, new Date('2026-05-20T12:00:00.000Z'));
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-migrated',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).toEqual(expect.arrayContaining(['挑战专家级任务', '伦理决策挑战', '参数优化大师']));
  });

  it('falls back to governed legacy evidence when a native portrait has no evidence', async () => {
    const portrait = strongNativePortrait(new Set());
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-empty',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const recommendation = (await generateRecommendations('student-1'))
      .find((item) => item.title === '提升迁移整合与应用能力');

    expect(recommendation?.rationale).toMatchObject({
      evidenceBasis: 'student-evidence-feature-cache',
      evidenceCount: 7,
    });
  });

  it('preserves partial freshness when zero-evidence portrait falls back to legacy evidence', async () => {
    const portrait = strongNativePortrait(new Set());
    const partialVector: CompetencyVector = {
      ...cacheVector,
      crossDomainTransfer: {
        ...cacheVector.crossDomainTransfer,
        lastUpdated: '2026-04-01T00:00:00.000Z',
      },
    };
    const approvedAggregates = defaultApprovedAggregates();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      features: {
        approvedAggregates: {
          ...approvedAggregates,
          latestSnapshot: {
            ...approvedAggregates.latestSnapshot,
            competencyVector: partialVector,
          },
        },
      },
    }));
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-empty-partial-fallback',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const recommendation = (await generateRecommendations('student-1'))
      .find((item) => item.title === '提升迁移整合与应用能力');

    expect(recommendation?.rationale.portraitV2?.freshness).toMatchObject({
      state: 'partial',
      asOf: '2026-04-01T00:00:00.000Z',
    });
  });

  it('uses a current migrated portrait dimension for weak-dimension practice', async () => {
    const weakVector: CompetencyVector = {
      ...strongSnapshotVector,
      engineeringDecision: { ...strongSnapshotVector.engineeringDecision, score: 40 },
    };
    const portrait = buildMigratedPortraitPayload({
      id: 'legacy-portrait-weak-source',
      userId: 'student-1',
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      competencyVector: weakVector,
    }, new Date('2026-05-20T12:00:00.000Z'));
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-migrated-weak', userId: 'student-1', snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion, calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion, derivationKind: portrait.derivation.kind, payload: portrait,
    });

    const weak = (await generateRecommendations('student-1'))
      .find((item) => item.rationale.reasonCode === 'weak-dimension-practice');

    expect(weak?.rationale.portraitV2).toMatchObject({
      weakDimensionId: 'engineeringConstraintSafety',
      derivationKind: 'migrated',
    });
  });

  it('does not interpret missing portrait v2 dimensions as low competency scores', async () => {
    const portrait = strongNativePortrait(
      new Set(['controlModelingRepresentation']),
      'current',
      40
    );
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-partial',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const recommendations = await generateRecommendations('student-1');
    const titles = recommendations.map((item) => item.title);

    expect(titles).not.toContain('工程决策训练');
    expect(titles).not.toContain('挑战专家级任务');
    expect(titles).not.toContain('参数优化大师');
    expect(recommendations.find((item) => item.title === '提升控制建模与表征能力')?.rationale)
      .toMatchObject({ evidenceBasis: 'portrait-v2', evidenceCount: 4 });
  });

  it.each([
    'simulationValidationEvidence',
    'systemAnalysisInterpretation',
  ] as const)('only suppresses rules that depend on missing %s evidence', async (missingId) => {
    const evidencedIds = new Set(PORTRAIT_V2_DIMENSIONS
      .map(({ id }) => id)
      .filter((id) => id !== missingId));
    const portrait = strongNativePortrait(evidencedIds);
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: `portrait-v2-missing-${missingId}`,
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    if (missingId === 'simulationValidationEvidence') {
      expect(titles).toEqual(expect.arrayContaining(['挑战专家级任务', '参数优化大师']));
    } else {
      expect(titles).not.toContain('挑战专家级任务');
      expect(titles).not.toContain('参数优化大师');
    }
  });

  it('keeps the source legacy vector ahead of its compatibility-derived portrait', async () => {
    const divergentVector: CompetencyVector = {
      ...strongSnapshotVector,
      inquiryReflection: { ...strongSnapshotVector.inquiryReflection, score: 50 },
      selfDirectedLearning: { ...strongSnapshotVector.selfDirectedLearning, score: 90 },
    };
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: divergentVector,
      snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
      factCount: 12,
    });

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).toContain('优化提示词设计');
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
    expect(contextOnly?.rationale).not.toHaveProperty('portraitV2');
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

  it('keeps native portrait v2 authoritative when learner state is enabled', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    mocks.prisma.studentPortraitV2Snapshot.findFirst.mockResolvedValue({
      id: 'portrait-v2-with-learner-state',
      userId: 'student-1',
      snapshotAt: new Date(portrait.generatedAt),
      payloadVersion: portrait.payloadVersion,
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      migrationVersion: portrait.migrationVersion,
      derivationKind: portrait.derivation.kind,
      payload: portrait,
    });

    const expert = (await generateRecommendations('student-1'))
      .find((item) => item.title === '挑战专家级任务');

    expect(expert?.rationale.evidenceBasis).toBe('portrait-v2');
  });

  it('requires learner-state evidence on each rule dependency', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    const vector = {
      ...strongSnapshotVector,
      engineeringDecision: { ...strongSnapshotVector.engineeringDecision, score: 40, evidenceCount: 0 },
    };
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      features: {
        approvedAggregates: {
          ...defaultApprovedAggregates(),
          latestSnapshot: {
            snapshotAt: '2026-05-18T00:00:00.000Z',
            factCount: 7,
            calculationVersion: 'v1',
            competencyVector: vector,
          },
        },
      },
    }));

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    expect(titles).not.toContain('工程决策训练');
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

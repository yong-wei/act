import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import { buildMigratedPortraitPayload } from '@/lib/data-governance/portrait-v2-migration';
import { MANIFEST_COURSE_ROUTE_SEGMENTS } from '@/features/interactive/shared/manifest-course-route-segments';

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
    adaptiveMasteryUpdate: {
      findMany: vi.fn(),
    },
    adaptiveAssessmentAbilityEstimate: {
      findFirst: vi.fn(),
    },
    userProgress: {
      count: vi.fn(),
    },
    learnerPortraitCurrentState: {
      findUnique: vi.fn(),
    },
    cumulativePortraitCutoverFence: {
      findUnique: vi.fn(),
    },
    cumulativePortraitMigrationRun: {
      findUnique: vi.fn(),
    },
    learningMaterializationRebuildRequest: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { generateRecommendations } from '../public-api';
import { STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION } from '@/lib/data-governance/student-evidence-feature-cache';
import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  createPortraitV2Payload,
  PORTRAIT_V2_CALCULATION_VERSION,
  type PortraitV2Payload,
} from '@/lib/data-governance/portrait-v2-model';

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

function fencedTrustedSnapshotDb(portrait: PortraitV2Payload) {
  process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
  const evidencedDimensionIds = portrait.dimensions
    .filter((dimension) => dimension.evidenceSummary.totalCount > 0)
    .map((dimension) => dimension.id);
  const missingDimensionIds = portrait.dimensions
    .filter((dimension) => dimension.evidenceSummary.totalCount === 0)
    .map((dimension) => dimension.id);

  mocks.prisma.cumulativePortraitCutoverFence.findUnique.mockResolvedValue({
    fence: BigInt(1),
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    learnerGeneration: BigInt(1),
    queueGeneration: BigInt(1),
    activeMigrationRunId: 'migration-1',
  });
  mocks.prisma.cumulativePortraitMigrationRun.findUnique.mockResolvedValue({
    id: 'migration-1',
    mode: 'APPLY',
    status: 'COMPLETED',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    learnerGeneration: BigInt(1),
    queueGeneration: BigInt(1),
    cutoverFence: BigInt(1),
  });
  mocks.prisma.learningMaterializationRebuildRequest.findFirst.mockResolvedValue(null);
  mocks.prisma.learnerPortraitCurrentState.findUnique.mockResolvedValue({
    userId: 'student-1',
    stateVersionId: 'state-trusted',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    generation: BigInt(1),
    queueGeneration: BigInt(1),
    stateWatermark: BigInt(1),
    taskInputDigest: 'task-input-digest',
    cutoverFence: BigInt(1),
    stateVersion: {
      id: 'state-trusted',
      userId: 'student-1',
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: BigInt(1),
      queueGeneration: BigInt(1),
      stateWatermark: BigInt(1),
      taskInputDigest: 'task-input-digest',
      stateKind: 'SNAPSHOT',
      snapshotId: 'snapshot-trusted',
      overallScore: 85,
      dimensionCoverage: {
        evidencedDimensionIds,
        missingDimensionIds,
      },
      evidenceAsOf: new Date(portrait.dimensions[0]?.freshness.asOf ?? portrait.generatedAt),
      confidence: 0.82,
      lastTrend: 'stable',
      lastRisk: [],
      availabilityReason: 'available',
      generatedAt: new Date(portrait.generatedAt),
      cutoverFence: BigInt(1),
      migrationRunId: 'migration-1',
      snapshot: {
        id: 'snapshot-trusted',
        userId: 'student-1',
        snapshotAt: new Date(portrait.generatedAt),
        payloadVersion: portrait.payloadVersion,
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        migrationVersion: portrait.migrationVersion,
        derivationKind: 'native',
        payload: portrait,
      },
    },
  });
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
    mocks.prisma.learnerPortraitCurrentState.findUnique.mockReset();
    mocks.prisma.cumulativePortraitCutoverFence.findUnique.mockReset();
    mocks.prisma.cumulativePortraitMigrationRun.findUnique.mockReset();
    mocks.prisma.learningMaterializationRebuildRequest.findFirst.mockReset();
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
    mocks.prisma.adaptiveMasteryUpdate.findMany.mockResolvedValue([]);
    mocks.prisma.adaptiveAssessmentAbilityEstimate.findFirst.mockResolvedValue(null);
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

    expect(recommendations).toEqual([]);
  });

  it('does not let context-only facts create activity coverage or a learning streak', async () => {
    const contextOnlyGovernance = {
      evidenceGovernance: {
        evidenceQuality: 'context-only',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'context-only-source',
      },
    };
    const recentFacts = Array.from({ length: 7 }, (_, index) => ({
      factType: 'question',
      outcome: 'success',
      startedAt: new Date(`2026-05-${20 - index}T10:00:00.000Z`),
      score: 100,
      contextJson: contextOnlyGovernance,
    }));
    mocks.prisma.learningFact.findMany.mockResolvedValue(recentFacts);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.every((item) => item.rationale.evidenceCount === 0)).toBe(true);
    expect(recommendations.find((item) => item.id.startsWith('self-directed-project-'))).toBeUndefined();
  });

  it('pages past context-only facts before deriving recent activity and streaks', async () => {
    const contextOnlyFacts = Array.from({ length: 51 }, (_, index) => ({
      id: `context-only-${index}`,
      factType: 'question',
      outcome: 'success',
      startedAt: new Date('2026-05-20T10:00:00.000Z'),
      score: 100,
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'context-only',
          profileWeight: 0,
          skipProfileContribution: true,
          policyReason: 'context-only-source',
        },
      },
    }));
    const eligibleFacts = Array.from({ length: 7 }, (_, index) => ({
      id: `eligible-${index}`,
      factType: 'question',
      outcome: 'success',
      startedAt: new Date(`2026-05-${20 - index}T10:00:00.000Z`),
      score: 100,
      contextJson: {
        evidenceGovernance: {
          evidenceQuality: 'governed',
          profileWeight: 1,
          skipProfileContribution: false,
          policyReason: 'approved-source',
        },
      },
    }));
    const rows = [...contextOnlyFacts, ...eligibleFacts];
    mocks.prisma.learningFact.findMany.mockImplementation(async (args: {
      cursor?: { id: string };
      take?: number;
    }) => {
      const start = args.cursor
        ? rows.findIndex((fact) => fact.id === args.cursor?.id) + 1
        : 0;
      return rows.slice(start, start + (args.take ?? 50));
    });

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations).toEqual([]);
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: 'context-only-49' },
      select: { id: true, startedAt: true, contextJson: true },
    }));
  });

  it('rejects pre-v6 feature caches without exposing them to recommendation rules', async () => {
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
    expect(recommendations).toEqual([]);
    const cacheBacked = recommendations.filter(
      (item) => item.rationale.evidenceBasis === 'student-evidence-feature-cache',
    );
    expect(cacheBacked).toHaveLength(0);
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
    expect(recommendations).toEqual([]);
    expect(cacheBacked).toHaveLength(0);
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
      payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
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
    expect(recommendations).toEqual([]);
    expect(cacheBacked).toHaveLength(0);
  });

  it('still fails closed for non-empty mixed-version LearningFact identity coverage', async () => {
    const cache = evidenceCache({
      payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
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
    expect(recommendations).toEqual([]);
    expect(cacheBacked).toHaveLength(0);
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
    expect(recommendations).toEqual([]);
  });

  it('does not consume a pre-governance v5 cache for direct recommendation rules', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      payloadVersion: 'student-evidence-features.v5',
      refreshedAt: new Date('2026-05-20T11:00:00.000Z'),
    }));

    const recommendations = await generateRecommendations('student-1');
    const titles = recommendations.map((item) => item.title);

    expect(mocks.prisma.studentCompetencySnapshot.findFirst).toHaveBeenCalled();
    expect(titles).not.toContain('提升迁移整合与应用能力');
    expect(recommendations.every(
      (item) => item.rationale.evidenceBasis !== 'student-evidence-feature-cache',
    )).toBe(true);
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
    fencedTrustedSnapshotDb(portrait);

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
    fencedTrustedSnapshotDb(portrait);

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
    fencedTrustedSnapshotDb(portrait);

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

  it('does not run legacy rules without a trusted cumulative portrait', async () => {
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

    expect(titles).not.toContain('工程决策训练');
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

  it('does not fall back to governed cache recommendations when portrait v2 evidence is non-current', async () => {
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

    expect(recommendations).toEqual([]);
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

    expect(direct).toHaveLength(0);
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
    fencedTrustedSnapshotDb(portrait);

    const weak = (await generateRecommendations('student-1'))
      .find((item) => item.rationale.reasonCode === 'weak-dimension-practice');

    expect(weak?.rationale.portraitV2?.weakDimensionId).toBe(validId);
  });

  it('fails closed for migrated portrait snapshots without a trusted current state', async () => {
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

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations).toEqual([]);
  });

  it('fails closed when a native portrait has no trusted current state', async () => {
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

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations).toEqual([]);
  });

  it('fails closed when a zero-evidence portrait has no trusted current state', async () => {
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

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations).toEqual([]);
  });

  it('does not use migrated portrait dimensions for weak-dimension practice', async () => {
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

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations).toEqual([]);
  });

  it('does not interpret missing portrait v2 dimensions as low competency scores', async () => {
    const portrait = strongNativePortrait(
      new Set(['controlModelingRepresentation']),
      'current',
      40
    );
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue(null);
    fencedTrustedSnapshotDb(portrait);

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
    fencedTrustedSnapshotDb(portrait);

    const titles = (await generateRecommendations('student-1')).map((item) => item.title);

    if (missingId === 'simulationValidationEvidence') {
      expect(titles).toEqual(expect.arrayContaining(['挑战专家级任务', '参数优化大师']));
    } else {
      expect(titles).not.toContain('挑战专家级任务');
      expect(titles).not.toContain('参数优化大师');
    }
  });

  it('does not use the source legacy vector without a trusted cumulative portrait', async () => {
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

    expect(titles).not.toContain('优化提示词设计');
  });

  it('keeps non-vector context recommendations when no trusted cumulative portrait exists', async () => {
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(null);
    mocks.prisma.userProgress.count.mockResolvedValue(0);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.map((item) => item.title)).toContain('探索知识图谱');
    expect(recommendations.map((item) => item.title)).not.toContain('提升迁移整合与应用能力');
  });

  it('keeps preview-only simulation Arena rationale without promoting it to competency evidence', async () => {
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
    const knowledgeGraph = recommendations
      .find((item) => item.title === '探索知识图谱');

    expect(knowledgeGraph?.rationale.contextOnly).toBe(true);
    expect(knowledgeGraph?.rationale.simulationArena?.readiness).toBe('low-confidence');
    expect(recommendations.map((item) => item.title)).not.toContain('提升迁移整合与应用能力');
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

    expect(mocks.prisma.studentEvidenceFeatureCache.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
    });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'student-1' }),
    }));
    expect(mocks.prisma).not.toHaveProperty('learningPathExecution');
    expect(recommendations).toEqual([]);
  });

  it('fails closed when stale feature-cache evidence has no trusted cumulative portrait', async () => {
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

    expect(recommendations).toEqual([]);
  });

  it('fails closed when partial simulation Arena evidence has no trusted cumulative portrait', async () => {
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

    expect(recommendations).toEqual([]);
  });

  it('uses server learner state as the authoritative vector when the service is enabled', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    fencedTrustedSnapshotDb(portrait);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.map((item) => item.title)).not.toContain('提升迁移整合与应用能力');
    expect(recommendations.map((item) => item.title)).toContain('挑战专家级任务');
  });

  it('keeps native portrait v2 authoritative when learner state is enabled', async () => {
    process.env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED = 'true';
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache());
    fencedTrustedSnapshotDb(portrait);

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
    const portrait = strongNativePortrait();
    mocks.prisma.studentEvidenceFeatureCache.findUnique.mockResolvedValue(evidenceCache({
      statusMarkers: ['low-confidence'],
      confidenceMarkers: {
        level: 'low',
        score: 0.31,
        evidenceCount: 7,
        sourceCompleteness: 0.86,
      },
    }));
    fencedTrustedSnapshotDb(portrait);

    const recommendations = await generateRecommendations('student-1');

    expect(recommendations.map((item) => item.title)).not.toContain('提升迁移整合与应用能力');
    expect(recommendations.map((item) => item.title)).toContain('挑战专家级任务');
  });
});

describe('recommendation launch routes', () => {
  it('every engine actionUrl resolves to a real app page route', async () => {
    const { readFile } = await import('node:fs/promises');
    const { readdirSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const engineSource = await readFile(
      join(process.cwd(), 'src/features/personalization/recommendations/engine.ts'),
      'utf8',
    );
    const actionUrls = [...engineSource.matchAll(/actionUrl: '([^']+)'/g)].map((match) => match[1]);
    expect(actionUrls.length).toBeGreaterThanOrEqual(10);

    const pagePathnames = new Set<string>();
    const walk = (dir: string, prefix: string[]) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('_')) continue;
        const fullPath = join(dir, entry.name);
        if (!entry.isDirectory()) {
          if (entry.name.startsWith('page.')) pagePathnames.add(`/${prefix.join('/')}`);
          continue;
        }
        if (/^\([^)]+\)$/.test(entry.name)) {
          walk(fullPath, prefix);
          continue;
        }
        walk(fullPath, [...prefix, /\[.*\]/.test(entry.name) ? '*' : entry.name]);
      }
    };
    walk(join(process.cwd(), 'src/app'), []);

    const dynamicRouteMatches = (pathname: string) =>
      [...pagePathnames].some(
        (route) => route.endsWith('/*') && pathname.startsWith(route.slice(0, -1)),
      );
    const missing: string[] = [];
    for (const url of new Set(actionUrls)) {
      const pathname = url.split('?')[0];
      if (!pagePathnames.has(pathname) && !dynamicRouteMatches(pathname)) missing.push(pathname);
      if (pathname.startsWith('/interactive-learning/courses/')) {
        expect(MANIFEST_COURSE_ROUTE_SEGMENTS).toContain(
          pathname.replace('/interactive-learning/courses/', ''),
        );
      }
    }
    expect(missing).toEqual([]);
    expect(existsSync(join(process.cwd(), 'src/app'))).toBe(true);
  });
});

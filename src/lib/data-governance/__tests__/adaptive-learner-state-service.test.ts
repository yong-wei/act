import { describe, expect, it } from 'vitest';
import type { CompetencyVector } from '../competency-model';
import {
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState,
} from '../adaptive-learner-state-service';

const snapshotVector: CompetencyVector = {
  controlModeling: { score: 78, trend: 'up', confidence: 0.82, evidenceCount: 8, lastUpdated: '2026-05-20T00:00:00.000Z' },
  parameterDesign: { score: 64, trend: 'stable', confidence: 0.68, evidenceCount: 6, lastUpdated: '2026-05-20T00:00:00.000Z' },
  crossDomainTransfer: { score: 58, trend: 'down', confidence: 0.55, evidenceCount: 5, lastUpdated: '2026-05-20T00:00:00.000Z' },
  engineeringDecision: { score: 71, trend: 'stable', confidence: 0.7, evidenceCount: 6, lastUpdated: '2026-05-20T00:00:00.000Z' },
  inquiryReflection: { score: 62, trend: 'stable', confidence: 0.6, evidenceCount: 4, lastUpdated: '2026-05-20T00:00:00.000Z' },
  selfDirectedLearning: { score: 67, trend: 'up', confidence: 0.64, evidenceCount: 4, lastUpdated: '2026-05-20T00:00:00.000Z' },
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
        payloadVersion: 'student-evidence-features.v3',
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
          contextJson: { adaptiveAssessment: { knowledgeTags: ['root-locus'] } },
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
          contextJson: { media: { mediaType: 'video', progress: 0.58 } },
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
          contextJson: { simulation: { launchMode: 'course-resource' } },
        },
      ],
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
          updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ],
    },
    ...overrides,
  };
}

describe('adaptive learner state service', () => {
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
});

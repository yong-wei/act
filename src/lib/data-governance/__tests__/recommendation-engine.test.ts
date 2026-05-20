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

function evidenceCache(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'student-1',
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
      approvedAggregates: {
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
      },
    },
    ...overrides,
  };
}

describe('generateRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

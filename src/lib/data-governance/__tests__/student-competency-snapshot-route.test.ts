import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();

  return {
    getServerAuthSession,
    prisma: {
      $queryRaw: vi.fn(),
      diagnosisReportSnapshot: {
        findMany: vi.fn(),
      },
      studentProfile: {
        findUnique: vi.fn(),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn(),
      },
      studentRiskFlag: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '@/app/api/student/competency-snapshot/route';

describe('GET /api/student/competency-snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.$queryRaw.mockResolvedValue([{ exists: false }]);
    mocks.prisma.diagnosisReportSnapshot.findMany.mockResolvedValue([]);
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({ classId: 'class-1' });

    mocks.prisma.studentCompetencySnapshot.findFirst
      .mockResolvedValueOnce({
        classId: 'class-1',
        competencyVector: {
          controlModeling: { score: 75, trend: 'stable', confidence: 0.8, evidenceCount: 6, lastUpdated: '2026-03-19T09:00:00.000Z' },
          parameterDesign: { score: 71, trend: 'stable', confidence: 0.7, evidenceCount: 5, lastUpdated: '2026-03-19T09:00:00.000Z' },
          crossDomainTransfer: { score: 43, trend: 'down', confidence: 0.7, evidenceCount: 4, lastUpdated: '2026-03-19T09:00:00.000Z' },
          engineeringDecision: { score: 63, trend: 'stable', confidence: 0.65, evidenceCount: 4, lastUpdated: '2026-03-19T09:00:00.000Z' },
          inquiryReflection: { score: 52, trend: 'down', confidence: 0.6, evidenceCount: 3, lastUpdated: '2026-03-19T09:00:00.000Z' },
          selfDirectedLearning: { score: 38, trend: 'down', confidence: 0.55, evidenceCount: 2, lastUpdated: '2026-03-19T09:00:00.000Z' },
        },
        snapshotAt: new Date('2026-03-19T09:00:00.000Z'),
        factCount: 14,
        evidenceSummary: {
          crossDomainTransfer: [{
            factType: 'question',
            outcome: 'failure',
            score: 0.2,
            studentAnswer: 'raw student answer should not leave snapshot API',
            rawAnswer: 'raw answer body should not leave snapshot API',
          }],
        },
      })
      .mockResolvedValueOnce({
        classId: 'class-1',
        competencyVector: {
          controlModeling: { score: 78, trend: 'stable', confidence: 0.75, evidenceCount: 5, lastUpdated: '2026-03-10T09:00:00.000Z' },
          parameterDesign: { score: 70, trend: 'stable', confidence: 0.68, evidenceCount: 4, lastUpdated: '2026-03-10T09:00:00.000Z' },
          crossDomainTransfer: { score: 55, trend: 'stable', confidence: 0.68, evidenceCount: 4, lastUpdated: '2026-03-10T09:00:00.000Z' },
          engineeringDecision: { score: 64, trend: 'stable', confidence: 0.62, evidenceCount: 3, lastUpdated: '2026-03-10T09:00:00.000Z' },
          inquiryReflection: { score: 60, trend: 'stable', confidence: 0.58, evidenceCount: 3, lastUpdated: '2026-03-10T09:00:00.000Z' },
          selfDirectedLearning: { score: 49, trend: 'stable', confidence: 0.52, evidenceCount: 2, lastUpdated: '2026-03-10T09:00:00.000Z' },
        },
        snapshotAt: new Date('2026-03-10T09:00:00.000Z'),
      });

    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([
      {
        flagType: 'participation',
        severity: 'high',
        description: '近一周学习活跃度较低',
        evidenceJson: { recentFactCount: 2 },
        triggeredAt: new Date('2026-03-19T08:00:00.000Z'),
      },
      {
        flagType: 'participation',
        severity: 'high',
        description: '近一周学习活跃度较低',
        evidenceJson: { recentFactCount: 1 },
        triggeredAt: new Date('2026-03-19T07:30:00.000Z'),
      },
      {
        flagType: 'cross_domain',
        severity: 'medium',
        description: '跨域知识迁移能力有待提升',
        evidenceJson: { crossDomainRate: 0.2 },
        triggeredAt: new Date('2026-03-18T09:00:00.000Z'),
      },
    ]);
  });

  it('deduplicates repeated risk flags and recommendations before responding', async () => {
    const response = await GET(new NextRequest('http://localhost/api/student/competency-snapshot?timeRange=30d'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.riskFlags).toHaveLength(2);
    expect(body.riskFlags.map((item: { type: string }) => item.type)).toEqual(['participation', 'cross_domain']);
    expect(body.recommendations.map((item: { title: string }) => item.title)).toEqual([
      '增加学习活跃度',
      '加强跨域知识联系',
      '提升迁移整合与应用能力',
      '巩固基础能力',
    ]);
    expect(body.currentSnapshot.portrait.dimensions).toHaveLength(7);
    expect(Object.keys(body.evidenceSummary)).toEqual(expect.arrayContaining([
      'controlModelingRepresentation',
      'transferIntegratedApplication',
    ]));
    expect(body.recommendations[0].rationale).toMatchObject({
      reasonCode: 'snapshot-risk-participation',
      evidenceBasis: 'approved-snapshot',
      evidenceRole: 'risk',
      evidenceCount: 14,
      sourceCoverage: {
        LearningFact: 'available',
        StudentCompetencySnapshot: 'available',
      },
      confidence: {
        state: 'ready',
      },
    });
    expect(JSON.stringify(body)).not.toContain('raw student answer should not leave snapshot API');
    expect(JSON.stringify(body)).not.toContain('raw answer body should not leave snapshot API');
    expect(body.evidenceSummary.transferIntegratedApplication[0]).not.toHaveProperty('studentAnswer');
    expect(body.evidenceSummary.transferIntegratedApplication[0]).not.toHaveProperty('rawAnswer');
  });

  it('reads a persisted diagnosis snapshot with the student class id when the table exists', async () => {
    const diagnosisSnapshot = {
      id: 'diagnosis-report-1',
      goalId: 'control-correction',
      subject: { kind: 'student', userId: 'student-1', classId: 'class-1' },
      generatedAt: '2026-03-19T09:30:00.000Z',
      materializerVersion: 'control-correction-diagnosis-profile.v1',
      indicators: [],
      dimensions: [{
        dimensionId: 'time-domain-analysis',
        score: 0.72,
        judgment: 'stable',
        confidence: 'high',
        indicatorIds: [],
        percentile: { state: 'available', percentile: 80, sampleSize: 12, fallback: 'none' },
        growthPercentile: { state: 'available', percentile: 65, sampleSize: 12, fallback: 'none' },
        limitations: [],
        evidenceRefs: [],
      }],
      limitations: [],
      sourceWindows: {},
    };
    mocks.prisma.$queryRaw.mockResolvedValue([{ exists: true }]);
    mocks.prisma.diagnosisReportSnapshot.findMany.mockResolvedValue([{
      id: diagnosisSnapshot.id,
      goalId: diagnosisSnapshot.goalId,
      subjectKind: 'student',
      userId: 'student-1',
      classId: 'class-1',
      generatedAt: new Date(diagnosisSnapshot.generatedAt),
      materializerVersion: diagnosisSnapshot.materializerVersion,
      snapshot: diagnosisSnapshot,
    }]);

    const response = await GET(new NextRequest('http://localhost/api/student/competency-snapshot?timeRange=30d'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.diagnosisReportSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        goalId: 'control-correction',
        userId: 'student-1',
        classId: 'class-1',
        subjectKind: 'student',
      }),
    }));
    expect(body.diagnosis.materialization.inputs).toContain('control-correction-diagnosis-report-snapshot');
    expect(body.diagnosis.claims[0]).toMatchObject({
      dimensionId: 'time-domain-analysis',
      metrics: {
        score: 0.72,
        percentile: { percentile: 80 },
        growthPercentile: { percentile: 65 },
      },
    });
  });
});

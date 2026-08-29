import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  readCurrentCumulativeClassPortrait: vi.fn(),
  readCurrentCumulativePortrait: vi.fn(),
  listSubmissions: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    classSession: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentProfile: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: { listSubmissions: mocks.listSubmissions },
}));
vi.mock('@/lib/data-governance/cumulative-portrait-read-model', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/data-governance/cumulative-portrait-read-model')>(),
  readCurrentCumulativeClassPortrait: mocks.readCurrentCumulativeClassPortrait,
  readCurrentCumulativePortrait: mocks.readCurrentCumulativePortrait,
}));

import { GET as getHeatmap } from '@/app/api/teacher/classes/[classId]/heatmap/route';
import { GET as getInsights } from '@/app/api/teacher/classes/[classId]/insights/route';
import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import { PORTRAIT_V2_CALCULATION_VERSION } from '@/lib/data-governance/portrait-v2-model';

const repoRoot = process.cwd();
const oldEvidenceAt = '2024-06-30T08:00:00.000Z';

function readSource(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function heatmapRequest(query = '') {
  return new NextRequest(`http://localhost/api/teacher/classes/class-1/heatmap${query}`);
}

function classPortrait(overrides: Record<string, unknown> = {}) {
  const dimensionAggregate = Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id, label }) => [
    id,
    {
      label,
      mean: id === 'controlModelingRepresentation' ? 82 : null,
      meanConfidence: id === 'controlModelingRepresentation' ? 0.8 : null,
      includedCount: id === 'controlModelingRepresentation' ? 1 : 0,
      missingCount: id === 'controlModelingRepresentation' ? 0 : 1,
    },
  ]));
  return {
    stateKind: 'SNAPSHOT',
    availabilityReason: 'available',
    materializationVersion: 'class-competency.cumulative.v2',
    aggregate: {
      overall: { mean: 82, meanConfidence: 0.8, includedCount: 1, missingCount: 0 },
      dimensions: dimensionAggregate,
    },
    dimensionCoverage: {
      totalMembers: 1,
      portraitMembers: 1,
      missingPortraitMembers: 0,
      overall: { includedCount: 1, missingCount: 0, meanConfidence: 0.8 },
      dimensions: Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id }) => [
        id,
        {
          includedCount: id === 'controlModelingRepresentation' ? 1 : 0,
          missingCount: id === 'controlModelingRepresentation' ? 0 : 1,
          meanConfidence: id === 'controlModelingRepresentation' ? 0.8 : null,
        },
      ])),
    },
    trendDistribution: { up: 1, stable: 0, down: 0, 'not-comparable': 0 },
    riskDistribution: {
      membersWithRisk: 1,
      membersWithoutRisk: 0,
      byType: { constraint: 1 },
      bySeverity: { medium: 1 },
    },
    diagnosis: {
      strengths: ['controlModelingRepresentation'],
      improvementClusters: [],
      limitations: [],
    },
    evidenceAsOf: oldEvidenceAt,
    generatedAt: '2026-07-23T08:00:00.000Z',
    activeStudentCount: 1,
    totalStudentCount: 1,
    ...overrides,
  };
}

function learnerPortrait(overrides: Record<string, unknown> = {}) {
  return {
    stateKind: 'SNAPSHOT',
    payload: {
      userId: 'student-1',
      derivation: { kind: 'native', limitations: [] },
      generatedAt: '2026-07-23T08:00:00.000Z',
      dimensions: [{
        id: 'controlModelingRepresentation',
        label: '控制系统建模与表示',
        score: 82,
        confidence: 0.8,
        evidenceSummary: { totalCount: 3 },
      }],
    },
    overallScore: 82,
    dimensionCoverage: {
      evidencedDimensionIds: ['controlModelingRepresentation'],
      missingDimensionIds: PORTRAIT_V2_DIMENSIONS
        .map(({ id }) => id)
        .filter((id) => id !== 'controlModelingRepresentation'),
    },
    evidenceAsOf: oldEvidenceAt,
    confidence: 0.8,
    lastTrend: 'up',
    lastRisk: [{ type: 'constraint', severity: 'medium', occurredAt: oldEvidenceAt }],
    availabilityReason: 'available',
    generatedAt: '2026-07-23T08:00:00.000Z',
    publication: {
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: '4',
      queueGeneration: '9',
      cutoverFence: '7',
      stateWatermark: '12',
      processingWatermark: '9',
      captureRevision: 'state-1',
      inputDigest: 'task-input-1',
    },
    ...overrides,
  };
}

describe('teacher cumulative attainment delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
      name: '2024自动化',
      code: 'AUTO-2024',
      description: null,
      semester: '秋',
      year: '2024',
      students: [{
        userId: 'student-1',
        studentNumber: 'S001',
        user: {
          id: 'student-1',
          name: '学生甲',
          email: 'student@example.test',
        },
      }],
    });
    mocks.prisma.studentProfile.findMany.mockResolvedValue([{
      userId: 'student-1',
      studentNumber: 'S001',
      user: {
        id: 'student-1',
        name: '学生甲',
        image: null,
      },
    }]);
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValue(classPortrait());
    mocks.readCurrentCumulativePortrait.mockResolvedValue(learnerPortrait());
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([]);
    mocks.listSubmissions.mockResolvedValue([]);
  });

  it('shows historical cumulative attainment and evidence-triggered trend/risk without a calendar window', async () => {
    const heatmapResponse = await getHeatmap(heatmapRequest(), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    const heatmap = await heatmapResponse.json();
    expect(heatmapResponse.status).toBe(200);
    expect(heatmap).toMatchObject({
      scope: 'cumulative',
      scopeLabel: '累计能力达成',
      coverage: {
        rosterStudents: 1,
        coveredStudents: 1,
        noEvidenceStudents: 0,
        unavailableStudents: 0,
      },
      trendDistribution: null,
      riskDistribution: null,
      lastUpdated: '2026-07-23T08:00:00.000Z',
    });
    expect(heatmap.matrix).toEqual([
      expect.objectContaining({
        studentId: 'student-1',
        score: 82,
        change: null,
        riskLevel: 'medium',
      }),
    ]);
    expect(heatmap.students[0]).toMatchObject({
      coverageState: 'covered',
      trendDirection: 'up',
      riskLevel: 'medium',
    });

    const insightsResponse = await getInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const insights = await insightsResponse.json();
    expect(insightsResponse.status).toBe(200);
    expect(insights).toMatchObject({
      scope: 'cumulative',
      overview: {
        overallIndex: null,
        mediumRiskStudents: 1,
        attentionStudents: 1,
      },
      trendDistribution: null,
      riskDistribution: null,
      diagnosis: {
        strengths: [],
        improvementClusters: [],
        limitations: ['independent-learner-small-sample'],
      },
    });
    expect(insights.students[0]).toMatchObject({
      overallScore: 82,
      trendDirection: 'up',
      riskLevel: 'medium',
      evidenceStatus: { state: 'ready', lastEvidenceAt: oldEvidenceAt },
    });
    expect(insights.arena).toMatchObject({
      submissionCount: 0,
      participantCount: 0,
      learningFactContextCount: 0,
    });
  });

  it('keeps current-member Arena submissions and scoped Arena learning facts in the independent summary', async () => {
    const arenaArtifact = {
      id: 'artifact-1',
      taskId: 'task-1',
      method: 'pid',
      params: { kp: 2, ki: 0.5, kd: 0.1 },
      createdAt: '2026-07-22T08:00:00.000Z',
    };
    mocks.prisma.classSession.findMany.mockResolvedValue([{ id: 'session-1' }]);
    mocks.listSubmissions.mockResolvedValue([{
      id: 'submission-1',
      taskId: 'task-1',
      userId: 'student-1',
      classId: 'class-1',
      publicationId: 'publication-1',
      studentLabel: '学生甲',
      artifactHash: 'hash-1',
      artifact: arenaArtifact,
      evaluation: {
        taskId: 'task-1',
        artifact: arenaArtifact,
        valid: true,
        score: 88,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: [],
      },
      submittedAt: '2026-07-22T08:05:00.000Z',
      reusedEvaluation: false,
    }]);
    mocks.prisma.learningFact.findMany.mockResolvedValue([{
      factType: 'design',
      moduleId: 'task-1',
      outcome: 'success',
      score: 88,
      contextJson: {
        arena: { classId: 'class-1', taskId: 'task-1', official: true },
      },
    }]);

    const response = await getInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listSubmissions).toHaveBeenCalledWith({ classId: 'class-1' });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: { in: ['student-1'] },
        factType: 'design',
      }),
    }));
    expect(payload.arena).toMatchObject({
      submissionCount: 1,
      participantCount: 1,
      averageScore: 88,
      learningFactContextCount: 1,
    });
  });

  it('fails closed when the current class pointer does not match the active fence', async () => {
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValue(classPortrait({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'current-state-version-mismatch',
      materializationVersion: null,
      aggregate: null,
      dimensionCoverage: null,
      trendDistribution: null,
      riskDistribution: null,
      diagnosis: null,
      evidenceAsOf: null,
      generatedAt: null,
      activeStudentCount: 0,
      totalStudentCount: 0,
    }));

    const response = await getInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    const payload = await response.json();
    expect(payload).toMatchObject({
      availability: {
        state: 'UNAVAILABLE',
        reason: 'current-state-version-mismatch',
      },
      overview: { overallIndex: null },
      ability: { state: 'unavailable' },
      trendDistribution: null,
      riskDistribution: null,
      diagnosis: null,
    });
  });

  it('returns explicit no-evidence member state without fabricating zero values', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValue(learnerPortrait({
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      evidenceAsOf: null,
      confidence: null,
      lastTrend: null,
      lastRisk: [],
      availabilityReason: 'no-eligible-evidence',
      generatedAt: '2026-07-23T08:00:00.000Z',
    }));

    const response = await getHeatmap(heatmapRequest(), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    const payload = await response.json();
    expect(payload.matrix).toEqual([]);
    expect(payload.students[0]).toMatchObject({
      coverageState: 'no-evidence',
      availabilityReason: 'no-eligible-evidence',
    });
  });

  it('rejects removed scopes only after authentication and class authorization', async () => {
    const authorized = await getHeatmap(heatmapRequest('?scope=recent'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    expect(authorized.status).toBe(400);
    await expect(authorized.json()).resolves.toEqual({
      error: 'unsupported-scope',
      scope: 'recent',
    });
    expect(mocks.readCurrentCumulativeClassPortrait).not.toHaveBeenCalled();
    const authorizedInsights = await getInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights?scope=recent'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    expect(authorizedInsights.status).toBe(400);
    await expect(authorizedInsights.json()).resolves.toEqual({
      error: 'unsupported-scope',
      scope: 'recent',
    });

    mocks.prisma.class.findUnique.mockResolvedValue({ teacherId: 'teacher-2' });
    const unauthorized = await getHeatmap(heatmapRequest('?scope=recent'), {
      params: Promise.resolve({ classId: 'class-1' }),
    });
    expect(unauthorized.status).toBe(403);
    await expect(unauthorized.json()).resolves.toEqual({
      error: '仅可查看本人班级数据',
    });
    const unauthorizedInsights = await getInsights(
      new Request('http://localhost/api/teacher/classes/class-1/insights?scope=recent'),
      { params: Promise.resolve({ classId: 'class-1' }) },
    );
    expect(unauthorizedInsights.status).toBe(403);
    await expect(unauthorizedInsights.json()).resolves.toEqual({ error: '权限不足' });
  });

  it('contains no legacy snapshot, compatibility, or calendar-window read path', () => {
    for (const route of [
      'src/app/api/teacher/classes/[classId]/insights/route.ts',
      'src/app/api/teacher/classes/[classId]/heatmap/route.ts',
    ]) {
      const source = readSource(route);
      expect(source).not.toContain('classCompetencySnapshot');
      expect(source).not.toContain('studentCompetencySnapshot');
      expect(source).not.toContain('readLatestValidNativePortraitV2Snapshots');
      expect(source).not.toContain('derivePortraitV2Compatibility');
      expect(source).not.toContain('buildClassScopedStudentProjections');
      if (route.endsWith('/heatmap/route.ts')) {
        expect(source).not.toContain('learningFact.');
      }
      expect(source).not.toMatch(/30\s*\*/);
      expect(source).not.toMatch(/60\s*\*/);
    }
  });

  it('keeps teacher class pages cumulative-only and exposes missing-state explanations', () => {
    for (const page of [
      'src/app/teacher/classes/[classId]/page.tsx',
      'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
    ]) {
      const source = readSource(page);
      expect(source).not.toContain('scope=recent');
      expect(source).not.toContain('近阶段');
      expect(source).not.toContain('recentSignalsApplicable');
      expect(source).not.toContain('recentOnlySignals');
      expect(source).not.toContain('recentTrend');
      expect(source).toContain('累计能力达成');
      expect(source).toContain('formatAvailabilityReason');
      expect(source).toContain('不可用');
    }

    const analyticsSource = readSource(
      'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
    );
    expect(analyticsSource).toContain('累计趋势分布');
    expect(analyticsSource).toContain('累计风险分布');
    expect(analyticsSource).toContain('七维累计诊断');
    expect(analyticsSource).toContain('无合格证据');
  });
});

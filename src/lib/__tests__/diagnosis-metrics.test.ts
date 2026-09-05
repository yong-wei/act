import { describe, expect, it } from 'vitest';

import {
  computeClassDiagnosisMetrics,
  computeMemberSetFingerprint,
  DIAGNOSIS_METRIC_COMPUTATION_VERSION,
  DIAGNOSIS_METRIC_COVERAGE_BASIS,
  DIAGNOSIS_METRIC_SCHEMA_VERSION,
  diagnosisClassMetricDataSchema,
  parseGovernedDiagnosisInput,
  type ClassDiagnosisMetricsSource,
} from '@/lib/diagnosis-metrics';
import type { GovernedDiagnosisInput } from '@/lib/diagnosis-governed-input';

function governedFixture(overrides: Partial<GovernedDiagnosisInput> = {}): GovernedDiagnosisInput {
  return parseGovernedDiagnosisInput({
    schemaVersion: 'teacher-diagnosis-governed-input.v1',
    classId: 'class-1',
    studentIds: ['student-3', 'student-1', 'student-2'],
    assignmentSubmissions: [
      {
        id: 'submission-1',
        userId: 'student-1',
        assignmentRevisionId: 'revision-1',
        contentHash: 'hash-1',
        score: 8,
        totalPoints: 10,
        reviewedAt: '2026-07-30T07:00:00.000Z',
      },
      {
        id: 'submission-2',
        userId: 'student-2',
        assignmentRevisionId: 'revision-1',
        contentHash: 'hash-1',
        score: 9,
        totalPoints: 10,
        reviewedAt: '2026-07-30T07:10:00.000Z',
      },
    ],
    assessmentSessions: [
      {
        id: 'session-1',
        userId: 'student-1',
        assessmentId: 'assessment-1',
        contentDigest: 'digest-1',
        itemCount: 5,
        correctCount: 4,
        score: 80,
        completedAt: '2026-07-30T07:30:00.000Z',
      },
    ],
    riskFlags: [
      {
        id: 'risk-1',
        userId: 'student-1',
        type: 'constraint',
        severity: 'medium',
        description: 'constraint flag',
        evidenceSummary: {},
        triggeredAt: '2026-07-29T00:00:00.000Z',
        observedAt: '2026-07-30T06:00:00.000Z',
      },
      {
        id: 'risk-legacy',
        userId: 'student-2',
        type: 'participation',
        severity: 'low',
        description: 'legacy audit-only flag',
        evidenceSummary: {},
        triggeredAt: '2026-07-29T00:00:00.000Z',
        observedAt: '2026-07-30T06:00:00.000Z',
      },
    ],
    competencySnapshots: [],
    knowledgeProgress: [
      { id: 'kp-1', userId: 'student-1', nodeId: 'node-a', status: 'NOT_STARTED', progress: 0, timeSpent: 0, lastVisited: '2026-07-30T06:00:00.000Z' },
      { id: 'kp-2', userId: 'student-2', nodeId: 'node-a', status: 'IN_PROGRESS', progress: 10, timeSpent: 5, lastVisited: '2026-07-30T06:00:00.000Z' },
      { id: 'kp-3', userId: 'student-3', nodeId: 'node-a', status: 'IN_PROGRESS', progress: 20, timeSpent: 5, lastVisited: '2026-07-30T06:00:00.000Z' },
      { id: 'kp-4', userId: 'student-1', nodeId: 'node-b', status: 'NOT_STARTED', progress: 0, timeSpent: 0, lastVisited: '2026-07-30T06:00:00.000Z' },
      { id: 'kp-5', userId: 'student-2', nodeId: 'node-b', status: 'IN_PROGRESS', progress: 90, timeSpent: 5, lastVisited: '2026-07-30T06:00:00.000Z' },
    ],
    ...overrides,
  });
}

function portraitsFixture(): ClassDiagnosisMetricsSource['portraits'] {
  return new Map([
    ['student-1', [
      { id: 'controlModelingRepresentation', score: 80, confidence: 0.8 },
      { id: 'systemAnalysisInterpretation', score: 90, confidence: 0.9 },
    ]],
    ['student-2', [
      { id: 'controlModelingRepresentation', score: 70, confidence: 0.6 },
    ]],
    // student-3 has no native portrait within the cutoff.
  ]);
}

function sourceFixture(overrides: Partial<ClassDiagnosisMetricsSource> = {}): ClassDiagnosisMetricsSource {
  return {
    memberUserIds: ['student-3', 'student-1', 'student-2'],
    governed: governedFixture(),
    portraits: portraitsFixture(),
    ...overrides,
  };
}

describe('computeClassDiagnosisMetrics', () => {
  it('produces schema-valid metrics with frozen schema and computation versions', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    expect(diagnosisClassMetricDataSchema.safeParse(metrics).success).toBe(true);
    expect(DIAGNOSIS_METRIC_SCHEMA_VERSION).toBe('diagnosis-metric-snapshot.v1');
    expect(DIAGNOSIS_METRIC_COMPUTATION_VERSION).toBe('class-metrics.v1');
    expect(metrics.coverageBasis).toBe(DIAGNOSIS_METRIC_COVERAGE_BASIS);
    expect(metrics.memberCount).toBe(3);
  });

  it('is deterministic and independent of member and row ordering', () => {
    const first = computeClassDiagnosisMetrics(sourceFixture());
    const second = computeClassDiagnosisMetrics({
      memberUserIds: ['student-1', 'student-2', 'student-3'],
      governed: governedFixture(),
      portraits: portraitsFixture(),
    });
    expect(first).toEqual(second);
    expect(computeClassDiagnosisMetrics(sourceFixture())).toEqual(first);
  });

  it('aggregates ability dimension means, confidence, and included/missing counts', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    const first = metrics.abilityDimensions[0];
    expect(first).toMatchObject({
      id: 'controlModelingRepresentation',
      availability: 'available',
      mean: 75,
      averageConfidence: 0.7,
      includedStudents: 2,
      missingStudents: 1,
    });
    const second = metrics.abilityDimensions[1];
    expect(second).toMatchObject({
      id: 'systemAnalysisInterpretation',
      availability: 'available',
      mean: 90,
      averageConfidence: 0.9,
      includedStudents: 1,
      missingStudents: 2,
    });
  });

  it('keeps unevidenced ability dimensions unavailable without zero-fill', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    const unevidenced = metrics.abilityDimensions.slice(2);
    expect(unevidenced).toHaveLength(5);
    for (const dimension of unevidenced) {
      expect(dimension.availability).toBe('unavailable');
      expect(dimension.mean).toBeNull();
      expect(dimension.averageConfidence).toBeNull();
      expect(dimension.includedStudents).toBe(0);
      expect(dimension.missingStudents).toBe(3);
    }
  });

  it('keeps absent score outcomes unavailable without zero-fill', () => {
    const metrics = computeClassDiagnosisMetrics({
      memberUserIds: ['student-1'],
      governed: governedFixture({
        assignmentSubmissions: undefined,
        assessmentSessions: undefined,
      }),
      portraits: new Map(),
    });
    expect(metrics.assignmentOutcomes).toMatchObject({
      availability: 'unavailable',
      mean: null,
      includedStudents: 0,
      missingStudents: 1,
      evidenceCount: 0,
      scoredCount: 0,
    });
    expect(metrics.assessmentOutcomes.availability).toBe('unavailable');
    expect(metrics.assessmentOutcomes.mean).toBeNull();
  });

  it('derives assignment percentages and assessment means with their own denominators', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    expect(metrics.assignmentOutcomes).toMatchObject({
      availability: 'available',
      mean: 85,
      includedStudents: 2,
      missingStudents: 1,
      evidenceCount: 2,
      scoredCount: 2,
    });
    expect(metrics.assessmentOutcomes).toMatchObject({
      availability: 'available',
      mean: 80,
      includedStudents: 1,
      missingStudents: 2,
      evidenceCount: 1,
      scoredCount: 1,
    });
  });

  it('counts only current governed risk flag types in the distribution', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    expect(metrics.riskDistribution).toEqual({
      availability: 'available',
      flaggedStudents: 1,
      byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
      bySeverity: { low: 0, medium: 1, high: 0 },
    });
  });

  it('projects eligible weak knowledge points with weak/covered counts and class threshold', () => {
    const metrics = computeClassDiagnosisMetrics(sourceFixture());
    expect(metrics.weakKnowledgePoints).toEqual([
      {
        nodeId: 'node-a',
        weakStudentCount: 3,
        coveredStudentCount: 3,
        minimumWeakStudents: 3,
        eligible: true,
      },
    ]);
  });

  it('drops weak knowledge points below the class eligibility threshold', () => {
    const metrics = computeClassDiagnosisMetrics({
      memberUserIds: ['student-1', 'student-2', 'student-3'],
      governed: governedFixture({
        knowledgeProgress: [
          { id: 'kp-1', userId: 'student-1', nodeId: 'node-a', status: 'NOT_STARTED', progress: 0, timeSpent: 0, lastVisited: '2026-07-30T06:00:00.000Z' },
          { id: 'kp-2', userId: 'student-2', nodeId: 'node-a', status: 'COMPLETED', progress: 100, timeSpent: 5, lastVisited: '2026-07-30T06:00:00.000Z' },
          { id: 'kp-3', userId: 'student-3', nodeId: 'node-a', status: 'COMPLETED', progress: 100, timeSpent: 5, lastVisited: '2026-07-30T06:00:00.000Z' },
        ],
      }),
      portraits: new Map(),
    });
    expect(metrics.weakKnowledgePoints).toEqual([]);
  });
});

describe('computeMemberSetFingerprint', () => {
  it('is order-insensitive and duplicate-insensitive', () => {
    expect(computeMemberSetFingerprint(['b', 'a', 'a'])).toBe(computeMemberSetFingerprint(['a', 'b']));
  });

  it('separates different member sets without exposing learner ids', () => {
    const fingerprint = computeMemberSetFingerprint(['student-1', 'student-2']);
    expect(fingerprint).not.toBe(computeMemberSetFingerprint(['student-1']));
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain('student');
  });
});

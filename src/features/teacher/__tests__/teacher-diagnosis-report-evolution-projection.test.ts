import { describe, expect, it } from 'vitest';

import type { DiagnosisEvolutionApiItem, DiagnosisMetricSnapshotApiItem } from '@/features/teacher/diagnosis/public-api';
import { projectDiagnosisMetricEvolution } from '@/features/teacher/diagnosis/application/project-report-evolution';
import { readTeacherDiagnosisReportEvolution } from '@/features/teacher/diagnosis/application/read-report-evolution';

function snapshotMetricsFixture(overrides: Record<string, unknown> = {}) {
  return {
    memberCount: 3,
    coverageBasis: 'class-roster@v1',
    abilityDimensions: ['controlModelingRepresentation', 'systemAnalysisInterpretation', 'controllerDesignSynthesis', 'simulationValidationEvidence', 'engineeringConstraintSafety', 'transferIntegratedApplication', 'reflectionImprovementAiCollab'].map((id, index) => ({
      id,
      label: `维度${index + 1}`,
      availability: 'available',
      mean: 70 + index,
      averageConfidence: 0.7,
      includedStudents: 3,
      missingStudents: 0,
    })),
    assignmentOutcomes: {
      availability: 'available',
      mean: 85,
      includedStudents: 2,
      missingStudents: 1,
      evidenceCount: 2,
      scoredCount: 2,
    },
    assessmentOutcomes: {
      availability: 'unavailable',
      mean: null,
      includedStudents: 0,
      missingStudents: 3,
      evidenceCount: 0,
      scoredCount: 0,
    },
    riskDistribution: {
      availability: 'available',
      flaggedStudents: 1,
      byType: { stagnation: 0, constraint: 1, cross_domain: 0 },
      bySeverity: { low: 0, medium: 1, high: 0 },
    },
    weakKnowledgePoints: [],
    ...overrides,
  };
}

function evolutionItemFixture(options: {
  id: string;
  generatedAt: string;
  snapshotOverrides?: Record<string, unknown>;
  metricsOverrides?: Record<string, unknown>;
  withoutSnapshot?: boolean;
  corruptedMetrics?: boolean;
}): DiagnosisEvolutionApiItem {
  if (options.withoutSnapshot) {
    return {
      id: options.id,
      scopeType: 'class',
      scopeId: 'class-1',
      evidenceCutoff: '2026-07-30T08:00:00.000Z',
      generatedAt: options.generatedAt,
      metricSnapshot: null,
    };
  }
  const metrics = options.corruptedMetrics
    ? { unexpected: 'shape' }
    : snapshotMetricsFixture(options.metricsOverrides);
  const snapshot: DiagnosisMetricSnapshotApiItem = {
    id: `${options.id}-snapshot`,
    schemaVersion: 'diagnosis-metric-snapshot.v1',
    computationVersion: 'class-metrics.v1',
    scopeType: 'class',
    scopeId: 'class-1',
    memberSetFingerprint: 'fingerprint-1',
    evidenceCutoff: '2026-07-30T08:00:00.000Z',
    metrics,
    generatedAt: options.generatedAt,
    ...options.snapshotOverrides,
  };
  return {
    id: options.id,
    scopeType: 'class',
    scopeId: 'class-1',
    evidenceCutoff: '2026-07-30T08:00:00.000Z',
    generatedAt: options.generatedAt,
    metricSnapshot: snapshot,
  };
}

const OLDER = { id: 'report-old', generatedAt: '2026-08-01T08:00:00.000Z' };
const NEWER = { id: 'report-new', generatedAt: '2026-09-01T08:00:00.000Z' };

function comparablePair() {
  return [
    evolutionItemFixture({ ...NEWER, metricsOverrides: { assignmentOutcomes: { availability: 'available', mean: 90, includedStudents: 3, missingStudents: 0, evidenceCount: 3, scoredCount: 3 } } }),
    evolutionItemFixture(OLDER),
  ];
}

describe('projectDiagnosisMetricEvolution', () => {
  it('connects comparable adjacent snapshots and produces numeric deltas only', () => {
    const board = projectDiagnosisMetricEvolution(comparablePair());

    expect(board.breaks).toEqual([]);
    expect(board.latestReportId).toBe(NEWER.id);
    expect(board.previousComparableReportId).toBe(OLDER.id);
    expect(board.snapshots.map((snapshot) => snapshot.reportId)).toEqual([OLDER.id, NEWER.id]);

    const assignmentDelta = board.deltas.find((delta) => delta.key === 'assignment-mean');
    expect(assignmentDelta).toMatchObject({ previousValue: 85, currentValue: 90, deltaDisplay: '+5' });
    for (const delta of board.deltas) {
      expect(delta.deltaDisplay).toMatch(/^[+-][\d.]+$/);
    }

    const assignmentSeries = board.series.find((series) => series.key === 'assignment-mean');
    expect(assignmentSeries?.points.map((point) => point.value)).toEqual([85, 90]);
    expect(assignmentSeries?.points.map((point) => point.connectedToPrevious)).toEqual([false, true]);
  });

  it.each([
    {
      label: 'member-set-changed',
      olderOverrides: { memberSetFingerprint: 'fingerprint-2' },
      expectedReason: 'member-set-changed',
    },
    {
      label: 'coverage-basis-changed',
      olderMetrics: { coverageBasis: 'class-roster@v2' },
      expectedReason: 'coverage-basis-changed',
    },
    {
      label: 'schema-version-changed',
      olderOverrides: { schemaVersion: 'diagnosis-metric-snapshot.v2' },
      expectedReason: 'schema-version-changed',
    },
    {
      label: 'computation-version-changed',
      olderOverrides: { computationVersion: 'class-metrics.v2' },
      expectedReason: 'computation-version-changed',
    },
  ])('breaks the trend when $label', ({ olderOverrides, olderMetrics, expectedReason }) => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItemFixture(NEWER),
      evolutionItemFixture({
        ...OLDER,
        snapshotOverrides: olderOverrides,
        metricsOverrides: olderMetrics,
      }),
    ]);

    expect(board.breaks).toHaveLength(1);
    expect(board.breaks[0]).toMatchObject({
      olderReportId: OLDER.id,
      newerReportId: NEWER.id,
      reason: expectedReason,
    });
    expect(board.deltas).toEqual([]);
    expect(board.previousComparableReportId).toBeNull();
    const assignmentSeries = board.series.find((series) => series.key === 'assignment-mean');
    expect(assignmentSeries?.points.every((point) => !point.connectedToPrevious)).toBe(true);
  });

  it('degrades legacy and corrupted snapshots explicitly without recomputing them', () => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItemFixture({
        ...NEWER,
        metricsOverrides: { assignmentOutcomes: { availability: 'available', mean: 90, includedStudents: 3, missingStudents: 0, evidenceCount: 3, scoredCount: 3 } },
      }),
      evolutionItemFixture(OLDER),
      evolutionItemFixture({ id: 'report-legacy', generatedAt: '2026-07-01T08:00:00.000Z', withoutSnapshot: true }),
      evolutionItemFixture({ id: 'report-corrupt', generatedAt: '2026-06-01T08:00:00.000Z', corruptedMetrics: true }),
    ]);

    expect(board.snapshots.map((snapshot) => snapshot.reportId)).toEqual([
      'report-corrupt',
      'report-legacy',
      OLDER.id,
      NEWER.id,
    ]);
    expect(board.snapshots.find((snapshot) => snapshot.reportId === 'report-legacy')?.historicalUnavailable)
      .toBe(true);
    expect(board.snapshots.find((snapshot) => snapshot.reportId === 'report-corrupt')?.historicalUnavailable)
      .toBe(true);
    expect(board.snapshots.find((snapshot) => snapshot.reportId === OLDER.id)?.historicalUnavailable)
      .toBe(false);

    expect(board.breaks).toEqual([
      {
        olderReportId: 'report-legacy',
        newerReportId: OLDER.id,
        reason: 'snapshot-unavailable',
        reasonLabel: expect.stringContaining('历史报告无指标快照'),
      },
    ]);
    expect(board.deltas.find((delta) => delta.key === 'assignment-mean')).toMatchObject({ deltaDisplay: '+5' });
  });

  it('keeps unavailable metric points as gaps instead of zero-filling them', () => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItemFixture({
        ...NEWER,
        metricsOverrides: {
          assignmentOutcomes: { availability: 'unavailable', mean: null, includedStudents: 0, missingStudents: 3, evidenceCount: 0, scoredCount: 0 },
        },
      }),
      evolutionItemFixture(OLDER),
    ]);

    const assignmentSeries = board.series.find((series) => series.key === 'assignment-mean');
    expect(assignmentSeries?.points.map((point) => point.value)).toEqual([85, null]);
    expect(assignmentSeries?.points[1].connectedToPrevious).toBe(false);
    expect(board.deltas.find((delta) => delta.key === 'assignment-mean')).toBeUndefined();
  });

  it('does not project deltas or trend connections for a single snapshot', () => {
    const board = projectDiagnosisMetricEvolution([evolutionItemFixture(NEWER)]);

    expect(board.latestReportId).toBe(NEWER.id);
    expect(board.previousComparableReportId).toBeNull();
    expect(board.deltas).toEqual([]);
    expect(board.series.every((series) => series.points.length === 1 && !series.points[0].connectedToPrevious)).toBe(true);
  });
});

describe('readTeacherDiagnosisReportEvolution', () => {
  it('serializes snapshot dates to ISO strings and keeps legacy rows as null snapshots', async () => {
    const payload = await readTeacherDiagnosisReportEvolution({
      reader: {
        read: async () => [
          {
            id: NEWER.id,
            scopeType: 'class',
            scopeId: 'class-1',
            evidenceCutoff: new Date('2026-07-30T08:00:00.000Z'),
            generatedAt: new Date('2026-09-01T08:00:00.000Z'),
            metricSnapshot: {
              id: 'snapshot-1',
              schemaVersion: 'diagnosis-metric-snapshot.v1',
              computationVersion: 'class-metrics.v1',
              scopeType: 'class',
              scopeId: 'class-1',
              memberSetFingerprint: 'fingerprint-1',
              evidenceCutoff: new Date('2026-07-30T08:00:00.000Z'),
              metrics: snapshotMetricsFixture(),
              generatedAt: new Date('2026-09-01T08:00:00.000Z'),
            },
          },
          {
            id: OLDER.id,
            scopeType: 'class',
            scopeId: 'class-1',
            evidenceCutoff: new Date('2026-07-01T08:00:00.000Z'),
            generatedAt: new Date('2026-08-01T08:00:00.000Z'),
            metricSnapshot: null,
          },
        ],
      },
      teacherId: 'teacher-1',
      classId: 'class-1',
    });

    expect(payload.reports).toHaveLength(2);
    expect(payload.reports[0]).toMatchObject({
      id: NEWER.id,
      generatedAt: '2026-09-01T08:00:00.000Z',
    });
    expect(payload.reports[0]?.metricSnapshot?.generatedAt).toBe('2026-09-01T08:00:00.000Z');
    expect(payload.reports[0]?.metricSnapshot?.evidenceCutoff).toBe('2026-07-30T08:00:00.000Z');
    expect(payload.reports[1]?.metricSnapshot).toBeNull();
  });
});

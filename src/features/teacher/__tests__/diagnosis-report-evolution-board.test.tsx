import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { projectDiagnosisMetricEvolution } from '@/features/teacher/diagnosis/application/project-report-evolution';
import { DiagnosisReportEvolutionBoardView } from '@/features/teacher/diagnosis-report-evolution-board';
import type { DiagnosisEvolutionApiItem } from '@/features/teacher/diagnosis/public-api';

function snapshotMetrics(overrides: Record<string, unknown> = {}) {
  return {
    memberCount: 3,
    coverageBasis: 'class-roster@v1',
    abilityDimensions: ['controlModelingRepresentation'].map((id) => ({
      id,
      label: '控制建模与表征',
      availability: 'available',
      mean: 75,
      averageConfidence: 0.7,
      includedStudents: 3,
      missingStudents: 0,
    })),
    assignmentOutcomes: { availability: 'available', mean: 85, includedStudents: 2, missingStudents: 1, evidenceCount: 2, scoredCount: 2 },
    assessmentOutcomes: { availability: 'unavailable', mean: null, includedStudents: 0, missingStudents: 3, evidenceCount: 0, scoredCount: 0 },
    riskDistribution: { availability: 'available', flaggedStudents: 1, byType: { stagnation: 0, constraint: 1, cross_domain: 0 }, bySeverity: { low: 0, medium: 1, high: 0 } },
    weakKnowledgePoints: [],
    ...overrides,
  };
}

function evolutionItem(options: {
  id: string;
  generatedAt: string;
  assignmentMean?: number;
  fingerprint?: string;
  withoutSnapshot?: boolean;
}): DiagnosisEvolutionApiItem {
  const metricsOverrides: Record<string, unknown> = {};
  if (options.assignmentMean !== undefined) {
    metricsOverrides.assignmentOutcomes = {
      availability: 'available',
      mean: options.assignmentMean,
      includedStudents: 3,
      missingStudents: 0,
      evidenceCount: 3,
      scoredCount: 3,
    };
  }
  return {
    id: options.id,
    scopeType: 'class',
    scopeId: 'class-1',
    evidenceCutoff: '2026-08-30T08:00:00.000Z',
    generatedAt: options.generatedAt,
    metricSnapshot: options.withoutSnapshot ? null : {
      id: `${options.id}-snapshot`,
      schemaVersion: 'diagnosis-metric-snapshot.v1',
      computationVersion: 'class-metrics.v1',
      scopeType: 'class',
      scopeId: 'class-1',
      memberSetFingerprint: options.fingerprint ?? 'fingerprint-1',
      evidenceCutoff: '2026-08-30T08:00:00.000Z',
      metrics: snapshotMetrics(metricsOverrides),
      generatedAt: options.generatedAt,
    },
  };
}

describe('DiagnosisReportEvolutionBoardView', () => {
  it('renders the three-layer board with deltas, trend, and snapshot details', () => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItem({ id: 'report-new', generatedAt: '2026-09-01T08:00:00.000Z', assignmentMean: 90 }),
      evolutionItem({ id: 'report-old', generatedAt: '2026-08-01T08:00:00.000Z', assignmentMean: 85 }),
    ]);
    const html = renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="ready" board={board} />,
    );

    expect(html).toContain('data-diagnosis-report-evolution-board');
    expect(html).toContain('data-evolution-deltas-layer');
    expect(html).toContain('data-evolution-delta-list');
    expect(html).toContain('data-evolution-delta="+5"');
    expect(html).toContain('data-evolution-trend-layer');
    expect(html).toContain('data-evolution-series-select');
    expect(html).toContain('data-evolution-snapshot-list-layer');
    expect(html).toContain('data-evolution-snapshot-item="report-new"');
    expect(html).toContain('纳入 3 人');
    expect(html).toContain('diagnosis-metric-snapshot.v1');
    expect(html).toContain('class-metrics.v1');
    expect(html).not.toContain('改善');
    expect(html).not.toContain('恶化');
    expect(html).not.toContain('提升');
    expect(html).not.toContain('下降');
    expect(html).not.toContain('变好');
    expect(html).not.toContain('变差');
  });

  it('visualizes trend breaks with reasons and keeps both reports listed', () => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItem({ id: 'report-new', generatedAt: '2026-09-01T08:00:00.000Z', fingerprint: 'fingerprint-2' }),
      evolutionItem({ id: 'report-old', generatedAt: '2026-08-01T08:00:00.000Z' }),
    ]);
    const html = renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="ready" board={board} />,
    );

    expect(html).toContain('data-evolution-break="member-set-changed"');
    expect(html).toContain('班级成员集合发生变化，趋势在此断开');
    expect(html).toContain('与上一份报告不可比');
    expect(html).toContain('data-evolution-snapshot-item="report-old"');
    expect(html).toContain('data-evolution-snapshot-item="report-new"');
  });

  it('marks legacy reports without snapshots as historical-unavailable', () => {
    const board = projectDiagnosisMetricEvolution([
      evolutionItem({ id: 'report-new', generatedAt: '2026-09-01T08:00:00.000Z' }),
      evolutionItem({ id: 'report-legacy', generatedAt: '2026-07-01T08:00:00.000Z', withoutSnapshot: true }),
    ]);
    const html = renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="ready" board={board} />,
    );

    expect(html).toContain('data-evolution-historical-unavailable');
    expect(html).toContain('历史指标不可用');
    expect(html).toContain('data-evolution-break="snapshot-unavailable"');
  });

  it('renders explicit loading, error, and empty states', () => {
    const emptyBoard = projectDiagnosisMetricEvolution([]);
    expect(renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="loading" board={emptyBoard} />,
    )).toContain('data-evolution-loading');
    expect(renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="error" board={emptyBoard} errorMessage="读取失败" />,
    )).toContain('data-evolution-error');
    expect(renderToStaticMarkup(
      <DiagnosisReportEvolutionBoardView state="ready" board={emptyBoard} />,
    )).toContain('data-evolution-empty');
  });

  it('stays out of delivery, PDF, and student-safe surfaces by source contract', () => {
    const excludedSources = [
      'src/features/teacher/diagnosis-report-delivery-view.tsx',
      'src/lib/diagnosis-report-delivery.ts',
      'src/lib/diagnosis-report-delivery-projection.ts',
      'src/lib/diagnosis-report-pdf.ts',
    ];
    const repoRoot = process.cwd();
    for (const relativePath of excludedSources) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');
      expect(source, `${relativePath} must not reference the evolution board`).not.toContain('evolution');
    }
  });

  it('keeps the client evolution chain free of server-only dependencies', () => {
    const repoRoot = process.cwd();
    const clientChainSources = [
      'src/features/teacher/diagnosis-report-evolution-board.tsx',
      'src/features/teacher/diagnosis/application/project-report-evolution.ts',
      'src/lib/diagnosis-metric-schema.ts',
    ];
    for (const relativePath of clientChainSources) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');
      expect(source, `${relativePath} must not import the server metric computation`).not.toContain('@/lib/diagnosis-metrics');
      expect(source, `${relativePath} must stay out of node builtins`).not.toContain('node:crypto');
      expect(source, `${relativePath} must stay out of the persistence layer`).not.toContain('@/lib/diagnosis-persistence');
    }
    const schemaSource = readFileSync(join(repoRoot, 'src/lib/diagnosis-metric-schema.ts'), 'utf8');
    expect(schemaSource.match(/from '@\//g) ?? []).toHaveLength(0);
  });
});

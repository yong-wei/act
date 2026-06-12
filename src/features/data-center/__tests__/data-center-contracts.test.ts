import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  SOURCE_QUALITY_MARKERS,
  PRESENTATION_METRIC_REGIONS,
  GOVERNANCE_REGIONS,
  DEFAULT_EXPORT_SNAPSHOT_OPTIONS,
} from '../shared/data-center-contracts';
import { buildDataMapContextCards, buildPresentationExportSnapshot } from '../presentation-data-center';
import { presentationDataCenterMock } from '../presentation-mock-data';
import { sanitizeSnapshotMetrics, buildExportSafeSnapshot } from '../shared/export-safe-snapshot';
import { canAccessDrilldown } from '../shared/drilldown-link';
import type { SnapshotMetric } from '../shared/export-safe-snapshot';
import {
  REPORT_LEDGER_ARCHETYPE_RULES,
  REPORT_LEDGER_REQUIRED_LABELS,
  getReportLedgerRule,
} from '@/lib/report-ledger-contracts';
import { PLATFORM_REPORT_SURFACE_INVENTORY } from '@/lib/platform-role-navigation';

const repoRoot = process.cwd();

describe('PresentationDataCenter commercial workspace layout', () => {
  it('uses the commercial operations workspace contract for data center surfaces', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/data-center/presentation-data-center.tsx'),
      'utf8',
    );

    expect(source).toContain('data-commercial-operations-workspace="data-center"');
    expect(source).toContain('data-commercial-workspace-zone="context-strip"');
    expect(source).toContain('data-commercial-workspace-zone="instrument-area"');
    expect(source).toContain('data-commercial-workspace-zone="command-bar"');
  });

  it('renders data-center snapshots as report-ledger output without taking over the data-center shell', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/data-center/presentation-data-center.tsx'),
      'utf8',
    );

    expect(source).toContain('data-report-ledger-surface="data-center-platform-snapshot"');
    expect(source).toContain('data-report-ledger-watermark="low-contrast-brand"');
    expect(source).toContain('data-report-ledger-privacy-scope="aggregate-only"');
    expect(source).toContain('data-report-ledger-export="available"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('pointer-events-none');
    expect(source).toContain('downloadExportSafeSnapshot(exportSnapshot()');
    expect(source).not.toContain('导出快照功能将在后续版本中提供');
    expect(source).toContain('来源质量');
    expect(source).toContain('隐私范围');
    expect(source).toContain('状态图例');
  });

  it('uses available-width grid tracks instead of defaulting operations panels to narrow xl-only stacks', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/data-center/presentation-data-center.tsx'),
      'utf8',
    );

    expect(source).toContain('repeat(auto-fit,minmax(min(100%,220px),1fr))');
    expect(source).toContain('repeat(auto-fit,minmax(min(100%,420px),1fr))');
    expect(source).toContain('sidebarMode="collapsible"');
    expect(source).not.toContain('xl:grid-cols-[1.6fr_1fr]');
    expect(source).not.toContain('xl:grid-cols-[1.3fr_1fr]');
  });

  it('renders governed data-map context instead of disconnected metric cards', () => {
    const source = readFileSync(
      join(repoRoot, 'src/features/data-center/presentation-data-center.tsx'),
      'utf8',
    );

    expect(source).toContain('data-data-map-semantics="source-quality-freshness-privacy-status"');
    expect(source).toContain('data-data-map-context={card.marker}');
    expect(source).toContain("marker: 'source-quality'");
    expect(source).toContain("marker: 'freshness'");
    expect(source).toContain("marker: 'privacy-scope'");
    expect(source).toContain("marker: 'status-legend'");
    expect(source).toContain('data-governance-action-context="repair-review-export"');
    expect(source).toContain('下一次复核');
    expect(source).toContain('导出可用性');
  });

  it('derives data-map context from every source quality state instead of collapsing to static labels', () => {
    const states = ['demo', 'real', 'partial', 'stale', 'restricted'] as const;

    for (const quality of states) {
      const cards = buildDataMapContextCards({
        sourceQuality: quality,
        generatedAt: quality === 'stale' ? '2025-09-01' : '2026-05-30',
        role: 'student',
      });

      expect(cards.map((card) => card.marker)).toEqual([
        'source-quality',
        'freshness',
        'privacy-scope',
        'status-legend',
      ]);
      expect(cards[0].value).toBe(SOURCE_QUALITY_MARKERS[quality].label);
      expect(cards[0].summary).toContain(SOURCE_QUALITY_MARKERS[quality].summary);
      expect(cards.every((card) => card.actionLabel.length > 0)).toBe(true);
      expect(cards.every((card) => card.actionHref.length > 0)).toBe(true);
    }

    const staleCards = buildDataMapContextCards({
      sourceQuality: 'stale',
      generatedAt: '2025-09-01',
      role: 'teacher',
    });
    const adminStaleCards = buildDataMapContextCards({
      sourceQuality: 'stale',
      generatedAt: '2025-09-01',
      role: 'admin',
    });
    const restrictedCards = buildDataMapContextCards({
      sourceQuality: 'restricted',
      generatedAt: '2026-05-30',
      role: 'student',
    });
    const teacherRestrictedCards = buildDataMapContextCards({
      sourceQuality: 'restricted',
      generatedAt: '2026-05-30',
      role: 'teacher',
    });

    expect(staleCards.find((card) => card.marker === 'status-legend')?.value).toContain('待复核');
    expect(staleCards.find((card) => card.marker === 'freshness')?.summary).toContain('2025-09-01');
    expect(restrictedCards.find((card) => card.marker === 'privacy-scope')?.value).toContain('受限');
    expect(restrictedCards.find((card) => card.marker === 'status-legend')?.exportAvailability).toBe('受限导出');
    expect(staleCards.find((card) => card.marker === 'status-legend')?.actionHref).toBe('/teacher');
    expect(adminStaleCards.find((card) => card.marker === 'status-legend')?.actionHref).toBe('/admin/data-governance');
    expect(restrictedCards.find((card) => card.marker === 'privacy-scope')?.actionHref).toBe('/admin/data-governance');
    expect(restrictedCards.every((card) => card.actionHref === '/admin/data-governance')).toBe(true);
    expect(teacherRestrictedCards.every((card) => card.actionHref === '/teacher')).toBe(true);
  });
});

describe('buildPresentationExportSnapshot', () => {
  it('builds a real export-safe snapshot for the data-center report ledger', () => {
    const snapshot = buildPresentationExportSnapshot(presentationDataCenterMock, {
      interactionTotal: 27594,
      simulationVisitTotal: 70870,
      monthlyVisitTotal: 261400,
    });

    expect(snapshot.metrics.map((metric) => metric.label)).toEqual([
      '学期',
      '最近同步',
      '隐私范围',
      '状态图例',
      '导出安全策略',
      '学生规模',
      '教师规模',
      '学期总访问量',
      '互动总量',
      '仿真访问总量',
      'Control Odyssey 访问',
    ]);
    expect(snapshot.sourceQualitySummary).toEqual(['demo']);
    expect(snapshot.metrics.every((metric) => metric.rawEvidence === undefined)).toBe(true);
    expect(snapshot.metrics.every((metric) => metric.rawTraces === undefined)).toBe(true);
  });
});

describe('report ledger contracts', () => {
  it('defines report-ledger rules for classroom, Arena, learner, teacher, governance, and data-center outputs', () => {
    expect(REPORT_LEDGER_ARCHETYPE_RULES.map((rule) => rule.category)).toEqual([
      'classroom',
      'arena',
      'learner',
      'teacher-report',
      'grading',
      'prep-pack',
      'assistant-effect',
      'governance',
      'data-center',
    ]);
    for (const rule of REPORT_LEDGER_ARCHETYPE_RULES) {
      expect(rule.watermark).toBe('low-contrast-brand');
      expect(rule.requiredLabels).toEqual(REPORT_LEDGER_REQUIRED_LABELS);
      expect(rule.readabilityRule).toContain('Watermark');
    }
    expect(getReportLedgerRule('data-center')).toMatchObject({
      exportAvailability: 'available',
      privacyScope: 'aggregate-only',
    });
  });

  it('keeps report-ledger ownership separate from source route shell ownership', () => {
    const categories = new Set(REPORT_LEDGER_ARCHETYPE_RULES.map((rule) => rule.category));

    expect(PLATFORM_REPORT_SURFACE_INVENTORY.every((surface) => (
      surface.owningChange === 'redesign-report-ledger-and-export-surfaces'
      || surface.owningChange === 'migrate-operations-report-ledger-surfaces'
    ))).toBe(true);
    expect(PLATFORM_REPORT_SURFACE_INVENTORY.filter((surface) => surface.owningChange === 'migrate-operations-report-ledger-surfaces').map((surface) => surface.id)).toEqual(
      expect.arrayContaining([
        'teacher-class-analytics-report',
        'document-grading-workbench-ledger',
        'teacher-prep-pack-review-slot',
        'assistant-effect-report-export',
        'governance-data-quality-snapshot',
      ]),
    );
    expect(PLATFORM_REPORT_SURFACE_INVENTORY.every((surface) => Boolean(getReportLedgerRule(surface.category)))).toBe(true);
    expect(categories).toEqual(new Set([
      'classroom',
      'arena',
      'learner',
      'teacher-report',
      'grading',
      'prep-pack',
      'assistant-effect',
      'governance',
      'data-center',
    ]));
  });
});

describe('SOURCE_QUALITY_MARKERS', () => {
  it('should define all five source quality levels', () => {
    const qualities = Object.keys(SOURCE_QUALITY_MARKERS);
    expect(qualities).toContain('demo');
    expect(qualities).toContain('real');
    expect(qualities).toContain('partial');
    expect(qualities).toContain('stale');
    expect(qualities).toContain('restricted');
  });

  it('should provide meaningful labels for each quality', () => {
    Object.values(SOURCE_QUALITY_MARKERS).forEach((marker) => {
      expect(marker.label).toBeTruthy();
      expect(marker.label.length).toBeGreaterThan(0);
      expect(marker.summary.length).toBeGreaterThan(0);
      expect(marker.quality).toBeTruthy();
    });
  });
});

describe('PRESENTATION_METRIC_REGIONS', () => {
  it('should include all six presentation regions', () => {
    expect(PRESENTATION_METRIC_REGIONS).toHaveLength(6);
    expect(PRESENTATION_METRIC_REGIONS).toContain('headline-metrics');
    expect(PRESENTATION_METRIC_REGIONS).toContain('module-activity');
    expect(PRESENTATION_METRIC_REGIONS).toContain('learning-trajectory');
    expect(PRESENTATION_METRIC_REGIONS).toContain('simulation-activity');
    expect(PRESENTATION_METRIC_REGIONS).toContain('classroom-activity');
    expect(PRESENTATION_METRIC_REGIONS).toContain('demo-snapshots');
  });
});

describe('GOVERNANCE_REGIONS', () => {
  it('should include all six governance regions', () => {
    expect(GOVERNANCE_REGIONS).toHaveLength(6);
    expect(GOVERNANCE_REGIONS).toContain('source-coverage');
    expect(GOVERNANCE_REGIONS).toContain('readiness');
    expect(GOVERNANCE_REGIONS).toContain('stale-data');
    expect(GOVERNANCE_REGIONS).toContain('missing-context');
    expect(GOVERNANCE_REGIONS).toContain('privacy-scope');
    expect(GOVERNANCE_REGIONS).toContain('unsupported-states');
  });
});

describe('sanitizeSnapshotMetrics', () => {
  const sampleMetrics: SnapshotMetric[] = [
    {
      label: '总访问量',
      value: 12345,
      sourceQuality: 'real',
      rawEvidence: { studentIds: ['s1', 's2'] },
      rawTraces: [{ traceId: 't1' }],
    },
    {
      label: '完课率',
      value: '85%',
      sourceQuality: 'real',
      hiddenEvaluation: { score: 92 },
      rawAnswers: [{ questionId: 'q1', answer: '42' }],
    },
    {
      label: '知识图谱交互',
      value: 3400,
      sourceQuality: 'demo',
      privateMemory: { notes: 'internal memo' },
    },
  ];

  it('should strip all sensitive data by default', () => {
    const sanitized = sanitizeSnapshotMetrics(sampleMetrics);
    sanitized.forEach((metric) => {
      expect(metric.rawEvidence).toBeUndefined();
      expect(metric.rawTraces).toBeUndefined();
      expect(metric.hiddenEvaluation).toBeUndefined();
      expect(metric.rawAnswers).toBeUndefined();
      expect(metric.privateMemory).toBeUndefined();
    });
  });

  it('should preserve label, value, and sourceQuality after sanitization', () => {
    const sanitized = sanitizeSnapshotMetrics(sampleMetrics);
    sanitized.forEach((metric, index) => {
      expect(metric.label).toBe(sampleMetrics[index].label);
      expect(metric.value).toBe(sampleMetrics[index].value);
      expect(metric.sourceQuality).toBe(sampleMetrics[index].sourceQuality);
    });
  });

  it('should unconditionally strip all sensitive fields', () => {
    const withAllSensitive: SnapshotMetric[] = [{
      label: 'X',
      value: 1,
      sourceQuality: 'real',
      rawEvidence: { secret: true },
      rawTraces: [{ t: 1 }],
      hiddenEvaluation: { score: 99 },
      rawAnswers: [{ q: '42' }],
      privateMemory: { note: 'secret' },
    }];
    const sanitized = sanitizeSnapshotMetrics(withAllSensitive);
    expect(sanitized[0].rawEvidence).toBeUndefined();
    expect(sanitized[0].rawTraces).toBeUndefined();
    expect(sanitized[0].hiddenEvaluation).toBeUndefined();
    expect(sanitized[0].rawAnswers).toBeUndefined();
    expect(sanitized[0].privateMemory).toBeUndefined();
  });
});

describe('buildExportSafeSnapshot', () => {
  it('should produce a safe snapshot with timestamp and deduplicated source qualities', () => {
    const metrics: SnapshotMetric[] = [
      { label: 'A', value: 10, sourceQuality: 'real' },
      { label: 'B', value: 20, sourceQuality: 'real' },
      { label: 'C', value: 30, sourceQuality: 'demo' },
    ];
    const snapshot = buildExportSafeSnapshot(metrics);
    expect(snapshot.exportedAt).toBeTruthy();
    expect(new Date(snapshot.exportedAt).getTime()).toBeGreaterThan(0);
    expect(snapshot.metrics).toHaveLength(3);
    expect(snapshot.sourceQualitySummary).toHaveLength(2);
    expect(snapshot.sourceQualitySummary).toContain('real');
    expect(snapshot.sourceQualitySummary).toContain('demo');
  });

  it('should always use default export options (unconditional sanitization)', () => {
    const metrics: SnapshotMetric[] = [
      { label: 'X', value: 1, sourceQuality: 'demo', rawEvidence: { secret: true }, rawTraces: [{ t: '1' }] },
    ];
    const snapshot = buildExportSafeSnapshot(metrics);
    expect(snapshot.metrics[0].rawEvidence).toBeUndefined();
    expect(snapshot.metrics[0].rawTraces).toBeUndefined();
  });
});

describe('canAccessDrilldown', () => {
  it('should grant access when role is in allowed list', () => {
    expect(canAccessDrilldown('admin', ['admin', 'teacher'])).toBe(true);
    expect(canAccessDrilldown('teacher', ['teacher'])).toBe(true);
  });

  it('should deny access when role is not in allowed list', () => {
    expect(canAccessDrilldown('student', ['admin', 'teacher'])).toBe(false);
    expect(canAccessDrilldown('student', [])).toBe(false);
  });

  it('should respect role boundaries for governance drilldowns', () => {
    // Students cannot access admin governance
    expect(canAccessDrilldown('student', ['admin', 'teacher', 'audit'])).toBe(false);
    // Teachers can access teacher governance
    expect(canAccessDrilldown('teacher', ['teacher'])).toBe(true);
    // Admin can access admin governance
    expect(canAccessDrilldown('admin', ['admin', 'audit'])).toBe(true);
    // Audit can access evidence browser
    expect(canAccessDrilldown('audit', ['admin', 'teacher', 'audit'])).toBe(true);
  });
});

describe('DEFAULT_EXPORT_SNAPSHOT_OPTIONS', () => {
  it('should have all stripping options enabled by default', () => {
    expect(DEFAULT_EXPORT_SNAPSHOT_OPTIONS.stripRawEvidence).toBe(true);
    expect(DEFAULT_EXPORT_SNAPSHOT_OPTIONS.stripRawTraces).toBe(true);
    expect(DEFAULT_EXPORT_SNAPSHOT_OPTIONS.stripHiddenEvaluation).toBe(true);
    expect(DEFAULT_EXPORT_SNAPSHOT_OPTIONS.stripRawAnswers).toBe(true);
    expect(DEFAULT_EXPORT_SNAPSHOT_OPTIONS.stripPrivateMemory).toBe(true);
  });
});

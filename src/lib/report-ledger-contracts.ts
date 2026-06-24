export type ReportLedgerSurfaceCategory =
  | 'classroom'
  | 'arena'
  | 'learner'
  | 'teacher-report'
  | 'grading'
  | 'prep-pack'
  | 'assistant-effect'
  | 'governance'
  | 'data-center';
export type ReportLedgerExportAvailability = 'available' | 'restricted' | 'deferred';

export interface ReportLedgerArchetypeRule {
  category: ReportLedgerSurfaceCategory;
  title: string;
  watermark: 'low-contrast-brand';
  privacyScope: 'student-private' | 'teacher-review' | 'admin-governance' | 'aggregate-only';
  requiredLabels: readonly ['source-quality', 'freshness', 'privacy-scope', 'status-legend'];
  exportAvailability: ReportLedgerExportAvailability;
  readabilityRule: string;
}

export const REPORT_LEDGER_REQUIRED_LABELS = [
  'source-quality',
  'freshness',
  'privacy-scope',
  'status-legend',
] as const;

export const REPORT_LEDGER_ARCHETYPE_RULES: ReportLedgerArchetypeRule[] = [
  {
    category: 'classroom',
    title: '课堂报告',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'restricted',
    readabilityRule: 'Watermark must stay behind session tables, names, scores, and evidence labels.',
  },
  {
    category: 'arena',
    title: 'Arena 结果报告',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'restricted',
    readabilityRule: 'Watermark must not obscure official/preview labels, metric values, or leaderboard rows.',
  },
  {
    category: 'learner',
    title: '学习者成长报告',
    watermark: 'low-contrast-brand',
    privacyScope: 'student-private',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'restricted',
    readabilityRule: 'Watermark must not obscure learner record, confidence, missing-source, or next-action text.',
  },
  {
    category: 'teacher-report',
    title: '教师学情报告',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'restricted',
    readabilityRule: 'Watermark must not obscure class insight, governance coverage, student risk, or intervention status text.',
  },
  {
    category: 'grading',
    title: '报告评分账本',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'restricted',
    readabilityRule: 'Watermark must not obscure rubric criteria, draft status, citation anchors, or approval actions.',
  },
  {
    category: 'prep-pack',
    title: '备课包复核账本',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'deferred',
    readabilityRule: 'Watermark must stay behind prep-pack readiness, review state, source labels, and rollback actions.',
  },
  {
    category: 'assistant-effect',
    title: '助手效果报告',
    watermark: 'low-contrast-brand',
    privacyScope: 'teacher-review',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'available',
    readabilityRule: 'Watermark must not obscure deterministic seed, reset status, effect metrics, or export readiness.',
  },
  {
    category: 'governance',
    title: '治理快照',
    watermark: 'low-contrast-brand',
    privacyScope: 'admin-governance',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'deferred',
    readabilityRule: 'Watermark must not obscure repair state, source coverage, redaction, or restricted-state labels.',
  },
  {
    category: 'data-center',
    title: '数据中心快照',
    watermark: 'low-contrast-brand',
    privacyScope: 'aggregate-only',
    requiredLabels: REPORT_LEDGER_REQUIRED_LABELS,
    exportAvailability: 'available',
    readabilityRule: 'Watermark must stay behind charts and metric cards while preserving source and privacy labels.',
  },
];

export function getReportLedgerRule(category: ReportLedgerSurfaceCategory) {
  return REPORT_LEDGER_ARCHETYPE_RULES.find((rule) => rule.category === category);
}

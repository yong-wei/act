import type {
  PlatformConfidenceStatus,
  PlatformEvaluationStatus,
  PlatformReadinessStatus,
  PlatformSourceCoverageStatus,
  PlatformStatusPayload,
  PlatformStatusRoleScope,
} from '@/components/platform/platform-ui-contracts';
import {
  ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG,
  ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG,
  KONLING_LONG_TERM_MEMORY_FEATURE_FLAG,
  type AdaptiveBanditRerankResult,
  type AdaptiveExperimentAssignment,
  type AdaptiveOptimizationMetricName,
  type AdaptiveOptimizationMetricSummary,
  type AdaptiveOptimizationVariant,
  type LongTermMemoryGateResult,
} from '@/lib/adaptive-learning-optimization-experiments';
import type { TeacherResourceNodeOperationsReadiness } from '@/lib/teacher-resource-node-management';

export const ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG = 'ADAPTIVE_EXPERIMENT_OPERATIONS_UI_ENABLED';

export type AdaptiveExperimentOperationsRole = 'teacher' | 'admin' | 'audit';

export type AdaptiveExperimentOperationsFeatureFlag =
  | typeof ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG
  | typeof ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG
  | typeof ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG
  | typeof KONLING_LONG_TERM_MEMORY_FEATURE_FLAG;

export type AdaptiveExperimentOperationsPrerequisite =
  | 'stage-1-path-contracts'
  | 'konling-runtime-contracts'
  | 'teacher-governance-workspace'
  | 'privacy-audit'
  | 'evaluation-metrics'
  | 'resource-node-management';

export type AdaptiveExperimentOperationsPanelId =
  | 'stage-2-prerequisites'
  | 'experiment-assignment-health'
  | 'experiment-variant-outcomes'
  | `metric-${AdaptiveOptimizationMetricName}`
  | `metric-${AdaptiveOptimizationMetricName}:${AdaptiveOptimizationVariant}:${AdaptiveOptimizationMetricSummary['privacyAggregationLevel']}:${string}`
  | 'local-bandit-comparison'
  | 'long-term-memory-audit'
  | 'bulk-resource-node-mapping'
  | 'resource-node-policy-review'
  | 'resource-node-coverage-dashboard'
  | 'system-owned-issue-triage';

export type AdaptiveMemoryAuditKind = 'semantic-memory' | 'strategy-memory';

export interface AdaptiveExperimentOperationsPrerequisiteState {
  available: boolean;
  reason?: string;
}

export interface AdaptiveMemoryAuditEntry {
  id: string;
  kind: AdaptiveMemoryAuditKind;
  summary: string;
  privacyScope: PlatformStatusRoleScope;
  evidenceWindowHours?: number | null;
  auditOnlyRawAvailable?: boolean;
  rawMemoryContent?: unknown;
  rawDialogueText?: unknown;
  privateInterventionContent?: unknown;
}

export interface AdaptiveExperimentOperationsInput {
  role: AdaptiveExperimentOperationsRole;
  featureFlags: Partial<Record<AdaptiveExperimentOperationsFeatureFlag, boolean>>;
  prerequisites: Record<AdaptiveExperimentOperationsPrerequisite, AdaptiveExperimentOperationsPrerequisiteState>;
  assignments: readonly AdaptiveExperimentAssignment[];
  metricSummaries: readonly AdaptiveOptimizationMetricSummary[];
  bandit: AdaptiveBanditRerankResult | null;
  memoryGate: LongTermMemoryGateResult;
  memoryAuditEntries: readonly AdaptiveMemoryAuditEntry[];
  resourceNodeOperations: TeacherResourceNodeOperationsReadiness;
}

export interface AdaptiveExperimentOperationsPanel {
  id: AdaptiveExperimentOperationsPanelId;
  title: string;
  availability: 'enabled' | 'disabled' | 'unavailable';
  status: PlatformStatusPayload;
  metric: string;
  details: Array<{
    label: string;
    value: string;
    roleScope: PlatformStatusRoleScope;
    restricted?: boolean;
  }>;
  unavailableReasons?: readonly string[];
}

export interface AdaptiveMemoryAuditView {
  id: string;
  kind: AdaptiveMemoryAuditKind;
  summary: string;
  privacyScope: PlatformStatusRoleScope;
  evidenceWindowHours: number | null;
  rawPayloadVisible: boolean;
  redactionMarkers: readonly string[];
}

export interface AdaptiveExperimentOperationsWorkspace {
  role: AdaptiveExperimentOperationsRole;
  stage: 'stage-2';
  availability: 'enabled' | 'unavailable';
  unavailableReasons: readonly string[];
  panels: AdaptiveExperimentOperationsPanel[];
  deterministicBanditConstraints: readonly string[];
  memoryAudit: AdaptiveMemoryAuditView[];
  bulkActions: Array<{
    id: 'bulk-mapping' | 'policy-review' | 'coverage-dashboard' | 'system-owned-issue-triage';
    enabled: boolean;
    roleScope: PlatformStatusRoleScope;
    reason?: string;
  }>;
  status: PlatformStatusPayload;
}

export interface AdaptiveExperimentOperationsExport {
  generatedFor: 'adaptive-experiment-operations-ui';
  rows: Array<{
    metric: AdaptiveOptimizationMetricName;
    variant: AdaptiveOptimizationVariant;
    classId: string | null;
    cohortId: string | null;
    sampleCount: number;
    value: number | null;
    confidence: PlatformConfidenceStatus;
    completeness: 'missing' | 'partial' | 'complete';
    evidenceWindowHours: number | null;
    privacyAggregationLevel: AdaptiveOptimizationMetricSummary['privacyAggregationLevel'];
  }>;
  redactionMarkers: readonly string[];
}

export const ADAPTIVE_EXPERIMENT_REQUIRED_METRICS: AdaptiveOptimizationMetricName[] = [
  'path-adoption',
  'path-deviation',
  'correction-success',
  'explanation-click',
  'intervention-acceptance',
  'follow-through-48h',
  'learner-state-freshness',
  'source-coverage',
  'low-confidence-rate',
];

export const ADAPTIVE_EXPERIMENT_BANDIT_CONSTRAINTS = [
  'prerequisites',
  'privacy',
  'availability',
  'teacher-policy',
  'device',
  'time',
] as const;

const REQUIRED_FLAGS: AdaptiveExperimentOperationsFeatureFlag[] = [
  ADAPTIVE_EXPERIMENT_OPERATIONS_UI_FEATURE_FLAG,
  ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG,
];

const MEMORY_REDACTION_MARKERS = [
  'raw-memory-hidden',
  'raw-dialogue-hidden',
  'private-intervention-hidden',
] as const;

export function buildAdaptiveExperimentOperationsWorkspace(
  input: AdaptiveExperimentOperationsInput,
): AdaptiveExperimentOperationsWorkspace {
  const unavailableReasons = stage2UnavailableReasons(input);
  const availability = unavailableReasons.length === 0 ? 'enabled' : 'unavailable';
  const panels = [
    prerequisitePanel(input, unavailableReasons),
    assignmentHealthPanel(input, availability),
    variantOutcomePanel(input, availability),
    ...metricPanels(input, availability),
    banditPanel(input, availability),
    memoryPanel(input, availability),
    ...bulkResourceNodePanels(input, availability),
  ];
  const memoryRawPayloadAllowed = availability === 'enabled'
    && input.featureFlags[KONLING_LONG_TERM_MEMORY_FEATURE_FLAG] === true
    && input.memoryGate.enabled;
  const memoryAudit = input.memoryAuditEntries.map((entry) => memoryAuditView(entry, input.role, memoryRawPayloadAllowed));
  const bulkActions = bulkActionContracts(input, availability);

  return {
    role: input.role,
    stage: 'stage-2',
    availability,
    unavailableReasons,
    panels,
    deterministicBanditConstraints: ADAPTIVE_EXPERIMENT_BANDIT_CONSTRAINTS,
    memoryAudit,
    bulkActions,
    status: {
      id: 'adaptive-experiment-operations-stage-2',
      label: 'Stage 2 自适应实验运营',
      source: { domain: 'experiment', capability: 'adaptive-experiment-operations-ui' },
      summary: availability === 'enabled'
        ? 'Stage 2 实验运营界面已满足前置条件。'
        : 'Stage 2 实验运营界面仍受前置条件限制。',
      categories: {
        confidence: workspaceConfidence(input.metricSummaries),
        sourceCoverage: metricSourceCoverage(input.metricSummaries),
        privacy: workspacePrivacy(input),
        replay: input.metricSummaries.length > 0 ? 'ready' : 'missing',
        protocol: 'preview',
        evaluation: evaluationStatus(input.metricSummaries),
        readiness: availability === 'enabled' ? 'ready' : 'blocked',
        fallback: availability === 'enabled' ? 'none' : 'fallback-missing-context',
      },
      details: unavailableReasons.map((reason) => ({
        label: 'Stage 2 前置条件',
        value: reason,
        roleScope: 'admin-scoped',
      })),
    },
  };
}

export function buildAdaptiveExperimentOperationsExport(
  workspace: AdaptiveExperimentOperationsWorkspace,
): AdaptiveExperimentOperationsExport {
  return {
    generatedFor: 'adaptive-experiment-operations-ui',
    rows: workspace.panels
      .filter((panel) => panel.id.startsWith('metric-'))
      .map((panel) => metricExportRow(panel))
      .filter((row): row is AdaptiveExperimentOperationsExport['rows'][number] => row !== null),
    redactionMarkers: MEMORY_REDACTION_MARKERS,
  };
}

function stage2UnavailableReasons(input: AdaptiveExperimentOperationsInput): string[] {
  const disabledFlags = REQUIRED_FLAGS
    .filter((flag) => input.featureFlags[flag] !== true)
    .map((flag) => `feature-flag:${flag}`);
  const missingPrerequisites = Object.entries(input.prerequisites)
    .filter(([, state]) => !state.available)
    .map(([key, state]) => `prerequisite:${key}:${state.reason ?? 'missing'}`);
  return [...disabledFlags, ...missingPrerequisites];
}

function prerequisitePanel(
  input: AdaptiveExperimentOperationsInput,
  unavailableReasons: readonly string[],
): AdaptiveExperimentOperationsPanel {
  return panel({
    id: 'stage-2-prerequisites',
    title: 'Stage 2 前置条件',
    availability: unavailableReasons.length === 0 ? 'enabled' : 'unavailable',
    readiness: unavailableReasons.length === 0 ? 'ready' : 'blocked',
    metric: unavailableReasons.length === 0 ? 'ready' : `${unavailableReasons.length} blocked`,
    sourceCoverage: unavailableReasons.length === 0 ? 'complete' : 'missing',
    confidence: unavailableReasons.length === 0 ? 'high' : 'unknown',
    details: [
      ...REQUIRED_FLAGS.map((flag) => ({
        label: flag,
        value: input.featureFlags[flag] === true ? 'enabled' : 'disabled',
        roleScope: 'admin-scoped' as const,
      })),
      ...Object.entries(input.prerequisites).map(([key, state]) => ({
        label: key,
        value: state.available ? 'available' : state.reason ?? 'missing',
        roleScope: 'admin-scoped' as const,
      })),
    ],
    unavailableReasons,
  });
}

function assignmentHealthPanel(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel {
  const assigned = input.assignments.filter((assignment) => assignment.variant !== null).length;
  const excluded = input.assignments.length - assigned;
  return panel({
    id: 'experiment-assignment-health',
    title: '实验分配健康度',
    availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
    readiness: workspaceAvailability === 'enabled' && assigned > 0 ? 'ready' : 'blocked',
    metric: `${assigned}/${input.assignments.length}`,
    sourceCoverage: input.assignments.length > 0 ? 'complete' : 'missing',
    confidence: input.assignments.length >= 20 ? 'high' : input.assignments.length > 0 ? 'medium' : 'unknown',
    details: [
      { label: '已分配', value: String(assigned), roleScope: 'admin-scoped' },
      { label: '排除', value: String(excluded), roleScope: 'admin-scoped' },
      { label: '分层', value: assignmentStrata(input.assignments).join(', ') || 'none', roleScope: 'admin-scoped' },
      { label: '队列', value: assignmentCohorts(input.assignments).join(', ') || 'none', roleScope: 'admin-scoped' },
    ],
  });
}

function variantOutcomePanel(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel {
  const variants = new Set(input.metricSummaries.map((summary) => summary.variant));
  return panel({
    id: 'experiment-variant-outcomes',
    title: '实验变体结果',
    availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
    readiness: variants.size > 0 ? 'ready' : 'degraded',
    metric: `${variants.size} variants`,
    sourceCoverage: input.metricSummaries.length > 0 ? 'complete' : 'missing',
    confidence: workspaceConfidence(input.metricSummaries),
    details: Array.from(variants).map((variant) => ({
      label: variant,
      value: String(input.metricSummaries.filter((summary) => summary.variant === variant).length),
      roleScope: 'admin-scoped',
    })),
  });
}

function metricPanels(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel[] {
  return ADAPTIVE_EXPERIMENT_REQUIRED_METRICS.flatMap((metric) => {
    const summaries = input.metricSummaries.filter((summary) => summary.metric === metric);
    if (summaries.length === 0) {
      return [panel({
        id: `metric-${metric}`,
        title: metric,
        availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
        readiness: 'degraded',
        metric: 'missing',
        sourceCoverage: 'missing',
        confidence: 'unknown',
        details: [
          { label: 'variant', value: 'rules-graph-path', roleScope: 'admin-scoped' },
          { label: 'classId', value: '', roleScope: 'admin-scoped' },
          { label: 'cohortId', value: '', roleScope: 'admin-scoped' },
          { label: 'value', value: '', roleScope: 'admin-scoped' },
          { label: 'sampleCount', value: '0', roleScope: 'admin-scoped' },
          { label: 'confidence', value: 'unknown', roleScope: 'admin-scoped' },
          { label: 'completeness', value: 'missing', roleScope: 'admin-scoped' },
          { label: 'evidenceWindowHours', value: 'missing', roleScope: 'admin-scoped' },
          { label: 'privacyAggregationLevel', value: 'variant-aggregate', roleScope: 'admin-scoped' },
        ],
      })];
    }

    return summaries.map((summary) => panel({
      id: metricPanelId(summary),
      title: metric,
      availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
      readiness: summary.sampleCount > 0 ? 'ready' : 'degraded',
      metric: summary.sampleCount > 0 ? `${summary.sampleCount} samples` : 'missing',
      sourceCoverage: 'complete',
      confidence: summary.confidence,
      details: [
        { label: 'variant', value: summary.variant, roleScope: 'admin-scoped' },
        { label: 'classId', value: summary.classId ?? '', roleScope: 'admin-scoped' },
        { label: 'cohortId', value: summary.cohortId ?? '', roleScope: 'admin-scoped' },
        { label: 'value', value: String(summary.value ?? ''), roleScope: 'admin-scoped' },
        { label: 'sampleCount', value: String(summary.sampleCount), roleScope: 'admin-scoped' },
        { label: 'confidence', value: summary.confidence, roleScope: 'admin-scoped' },
        { label: 'completeness', value: summary.completeness, roleScope: 'admin-scoped' },
        { label: 'evidenceWindowHours', value: String(summary.evidenceWindowHours ?? 'missing'), roleScope: 'admin-scoped' },
        { label: 'privacyAggregationLevel', value: summary.privacyAggregationLevel, roleScope: 'admin-scoped' },
      ],
    }));
  });
}

function banditPanel(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel {
  const flagEnabled = input.featureFlags[ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG] === true;
  const readiness: PlatformReadinessStatus = workspaceAvailability !== 'enabled'
    ? 'blocked'
    : flagEnabled && input.bandit?.applied
      ? 'ready'
      : 'degraded';
  return panel({
    id: 'local-bandit-comparison',
    title: '本地 bandit 对比',
    availability: workspaceAvailability === 'enabled' && flagEnabled ? 'enabled' : 'disabled',
    readiness,
    metric: input.bandit?.reason ?? 'bandit-disabled',
    sourceCoverage: input.bandit ? 'complete' : 'missing',
    confidence: input.bandit?.applied ? 'medium' : 'unknown',
    details: [
      { label: '策略族', value: input.bandit?.policyFamily ?? 'rules-plus-graph-bandit', roleScope: 'admin-scoped' },
      { label: '已应用', value: String(input.bandit?.applied ?? false), roleScope: 'admin-scoped' },
      { label: '约束先行', value: ADAPTIVE_EXPERIMENT_BANDIT_CONSTRAINTS.join(', '), roleScope: 'admin-scoped' },
      { label: '被拒候选', value: String(input.bandit?.rejected.length ?? 0), roleScope: 'admin-scoped' },
    ],
    unavailableReasons: flagEnabled ? [] : [`feature-flag:${ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG}`],
  });
}

function memoryPanel(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel {
  const memoryFlagEnabled = input.featureFlags[KONLING_LONG_TERM_MEMORY_FEATURE_FLAG] === true;
  const enabled = workspaceAvailability === 'enabled' && memoryFlagEnabled && input.memoryGate.enabled;
  const unavailableReasons = [
    ...input.memoryGate.reasons,
    ...(memoryFlagEnabled ? [] : [`feature-flag:${KONLING_LONG_TERM_MEMORY_FEATURE_FLAG}`]),
  ];
  return panel({
    id: 'long-term-memory-audit',
    title: '长程记忆审计',
    availability: workspaceAvailability === 'enabled' ? (enabled ? 'enabled' : 'disabled') : 'unavailable',
    readiness: enabled ? 'ready' : 'blocked',
    metric: `${input.memoryAuditEntries.length} entries`,
    sourceCoverage: input.memoryAuditEntries.length > 0 ? 'complete' : 'missing',
    confidence: enabled ? 'medium' : 'unknown',
    privacy: 'restricted',
    details: [
      { label: '语义记忆', value: String(input.memoryGate.semanticMemoryEnabled), roleScope: 'audit-only', restricted: true },
      { label: '策略记忆', value: String(input.memoryGate.strategyMemoryEnabled), roleScope: 'audit-only', restricted: true },
      { label: '回滚开关', value: input.memoryGate.rollbackFeatureFlag, roleScope: 'admin-scoped' },
      { label: '阻塞原因', value: input.memoryGate.reasons.join(', ') || 'none', roleScope: 'admin-scoped' },
    ],
    unavailableReasons,
  });
}

function bulkResourceNodePanels(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsPanel[] {
  const readiness = input.resourceNodeOperations;
  const mappingEnabled = workspaceAvailability === 'enabled' && readiness.bulkMappingEnabled;
  return [
    panel({
      id: 'bulk-resource-node-mapping',
      title: 'ResourceNode 批量映射',
      availability: mappingEnabled ? 'enabled' : 'disabled',
      readiness: mappingEnabled ? 'ready' : 'blocked',
      metric: String(readiness.coverage.mappedNodes),
      sourceCoverage: readiness.coverage.totalNodes > 0 ? 'partial' : 'missing',
      confidence: 'medium',
      details: [
        { label: '总节点', value: String(readiness.coverage.totalNodes), roleScope: 'teacher-scoped' },
        { label: '已映射', value: String(readiness.coverage.mappedNodes), roleScope: 'teacher-scoped' },
        { label: '批量启用', value: String(readiness.bulkMappingEnabled), roleScope: 'admin-scoped' },
      ],
    }),
    panel({
      id: 'resource-node-policy-review',
      title: 'ResourceNode 策略复核',
      availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
      readiness: readiness.policyReviewRequiredCount > 0 ? 'degraded' : 'ready',
      metric: String(readiness.policyReviewRequiredCount),
      sourceCoverage: readiness.coverage.totalNodes > 0 ? 'partial' : 'missing',
      confidence: 'medium',
      details: [
        { label: '需复核', value: String(readiness.policyReviewRequiredCount), roleScope: 'teacher-scoped' },
      ],
    }),
    panel({
      id: 'resource-node-coverage-dashboard',
      title: 'ResourceNode 覆盖看板',
      availability: workspaceAvailability === 'enabled' ? 'enabled' : 'unavailable',
      readiness: readiness.coverage.coverageRatio > 0 ? 'ready' : 'degraded',
      metric: String(readiness.coverage.coverageRatio),
      sourceCoverage: readiness.coverage.totalNodes > 0 ? 'partial' : 'missing',
      confidence: 'medium',
      details: [
        { label: '路径可用节点', value: String(readiness.coverage.pathEligibleNodes), roleScope: 'teacher-scoped' },
        { label: '覆盖率', value: String(readiness.coverage.coverageRatio), roleScope: 'teacher-scoped' },
      ],
    }),
    panel({
      id: 'system-owned-issue-triage',
      title: '系统问题分诊',
      availability: workspaceAvailability === 'enabled'
        ? (input.role === 'admin' || input.role === 'audit' ? 'enabled' : 'disabled')
        : 'unavailable',
      readiness: workspaceAvailability === 'enabled'
        ? (readiness.systemIssues.length > 0 ? 'degraded' : 'ready')
        : 'blocked',
      metric: String(readiness.systemIssues.length),
      sourceCoverage: readiness.systemIssues.length > 0 ? 'partial' : 'complete',
      confidence: 'medium',
      privacy: input.role === 'teacher' ? 'restricted' : 'classroom',
      details: readiness.systemIssues.map((issue) => ({
        label: issue.code,
        value: issue.message,
        roleScope: 'admin-scoped',
        restricted: input.role === 'teacher',
      })),
    }),
  ];
}

function panel(input: {
  id: AdaptiveExperimentOperationsPanelId;
  title: string;
  availability: AdaptiveExperimentOperationsPanel['availability'];
  readiness: PlatformReadinessStatus;
  metric: string;
  sourceCoverage: PlatformSourceCoverageStatus;
  confidence: PlatformConfidenceStatus;
  details: AdaptiveExperimentOperationsPanel['details'];
  privacy?: 'public' | 'classroom' | 'restricted' | 'private';
  evaluation?: PlatformEvaluationStatus;
  unavailableReasons?: readonly string[];
}): AdaptiveExperimentOperationsPanel {
  return {
    id: input.id,
    title: input.title,
    availability: input.availability,
    metric: input.metric,
    details: input.details,
    unavailableReasons: input.unavailableReasons,
    status: {
      id: `adaptive-experiment-operations-${input.id}`,
      label: input.title,
      source: { domain: 'experiment', capability: 'adaptive-experiment-operations-ui' },
      categories: {
        confidence: input.confidence,
        sourceCoverage: input.sourceCoverage,
        privacy: input.privacy ?? (input.details.some((detail) => detail.restricted) ? 'restricted' : 'classroom'),
        replay: input.sourceCoverage === 'missing' ? 'missing' : 'ready',
        protocol: 'preview',
        evaluation: input.evaluation ?? 'preview',
        readiness: input.readiness,
        fallback: input.availability === 'unavailable' ? 'fallback-missing-context' : 'none',
      },
    },
  };
}

function memoryAuditView(
  entry: AdaptiveMemoryAuditEntry,
  role: AdaptiveExperimentOperationsRole,
  rawPayloadAllowed: boolean,
): AdaptiveMemoryAuditView {
  return {
    id: entry.id,
    kind: entry.kind,
    summary: entry.summary,
    privacyScope: entry.privacyScope,
    evidenceWindowHours: entry.evidenceWindowHours ?? null,
    rawPayloadVisible: rawPayloadAllowed && role === 'audit' && entry.auditOnlyRawAvailable === true,
    redactionMarkers: MEMORY_REDACTION_MARKERS,
  };
}

function bulkActionContracts(
  input: AdaptiveExperimentOperationsInput,
  workspaceAvailability: AdaptiveExperimentOperationsWorkspace['availability'],
): AdaptiveExperimentOperationsWorkspace['bulkActions'] {
  const bulkEnabled = workspaceAvailability === 'enabled' && input.resourceNodeOperations.bulkMappingEnabled;
  return [
    {
      id: 'bulk-mapping',
      enabled: bulkEnabled && (input.role === 'teacher' || input.role === 'admin'),
      roleScope: 'teacher-scoped',
      reason: bulkEnabled ? undefined : 'stage-2-bulk-mapping-disabled',
    },
    {
      id: 'policy-review',
      enabled: workspaceAvailability === 'enabled',
      roleScope: 'teacher-scoped',
    },
    {
      id: 'coverage-dashboard',
      enabled: workspaceAvailability === 'enabled',
      roleScope: 'teacher-scoped',
    },
    {
      id: 'system-owned-issue-triage',
      enabled: workspaceAvailability === 'enabled' && (input.role === 'admin' || input.role === 'audit'),
      roleScope: 'admin-scoped',
      reason: input.role === 'teacher' ? 'admin-or-audit-required' : undefined,
    },
  ];
}

function metricExportRow(
  panel: AdaptiveExperimentOperationsPanel,
): AdaptiveExperimentOperationsExport['rows'][number] | null {
  const metric = panel.id.replace(/^metric-/, '').split(':')[0] as AdaptiveOptimizationMetricName;
  if (!ADAPTIVE_EXPERIMENT_REQUIRED_METRICS.includes(metric)) return null;
  const detailValue = (label: string) => panel.details.find((detail) => detail.label === label)?.value;
  return {
    metric,
    variant: (detailValue('variant') as AdaptiveOptimizationVariant | undefined) ?? 'rules-graph-path',
    classId: detailValue('classId') || null,
    cohortId: detailValue('cohortId') || null,
    sampleCount: Number(detailValue('sampleCount') ?? 0),
    value: Number.isFinite(Number(detailValue('value'))) ? Number(detailValue('value')) : null,
    confidence: (detailValue('confidence') as PlatformConfidenceStatus | undefined) ?? 'unknown',
    completeness: (detailValue('completeness') as 'missing' | 'partial' | 'complete' | undefined) ?? 'missing',
    evidenceWindowHours: Number.isFinite(Number(detailValue('evidenceWindowHours')))
      ? Number(detailValue('evidenceWindowHours'))
      : null,
    privacyAggregationLevel: (
      detailValue('privacyAggregationLevel') as AdaptiveOptimizationMetricSummary['privacyAggregationLevel'] | undefined
    ) ?? 'variant-aggregate',
  };
}

function metricPanelId(summary: AdaptiveOptimizationMetricSummary): AdaptiveExperimentOperationsPanelId {
  return [
    `metric-${summary.metric}`,
    summary.variant,
    summary.privacyAggregationLevel,
    summary.classId ?? summary.cohortId ?? 'all',
  ].join(':') as AdaptiveExperimentOperationsPanelId;
}

function assignmentStrata(assignments: readonly AdaptiveExperimentAssignment[]): string[] {
  return Array.from(new Set(assignments.map((assignment) => assignment.initialAbilityStratum))).sort();
}

function assignmentCohorts(assignments: readonly AdaptiveExperimentAssignment[]): string[] {
  return Array.from(new Set(assignments.map((assignment) => assignment.cohortId).filter((cohort): cohort is string => Boolean(cohort)))).sort();
}

function weakestConfidence(summaries: readonly AdaptiveOptimizationMetricSummary[]): PlatformConfidenceStatus {
  if (summaries.some((summary) => summary.confidence === 'low')) return 'low';
  if (summaries.some((summary) => summary.confidence === 'medium')) return 'medium';
  return summaries.length > 0 ? 'high' : 'unknown';
}

function workspaceConfidence(summaries: readonly AdaptiveOptimizationMetricSummary[]): PlatformConfidenceStatus {
  if (summaries.length === 0) return 'unknown';
  return weakestConfidence(summaries);
}

function metricSourceCoverage(summaries: readonly AdaptiveOptimizationMetricSummary[]): PlatformSourceCoverageStatus {
  if (summaries.length === 0) return 'missing';
  if (ADAPTIVE_EXPERIMENT_REQUIRED_METRICS.every((metric) => summaries.some((summary) => summary.metric === metric))) {
    return 'complete';
  }
  return 'partial';
}

function workspacePrivacy(input: AdaptiveExperimentOperationsInput): 'classroom' | 'restricted' {
  return input.memoryAuditEntries.some((entry) => entry.privacyScope !== 'student-visible') ? 'restricted' : 'classroom';
}

function evaluationStatus(summaries: readonly AdaptiveOptimizationMetricSummary[]): PlatformEvaluationStatus {
  return summaries.length > 0 ? 'preview' : 'not-evaluated';
}

import type {
  AdaptiveLearningPathAlternative,
  AdaptiveLearningPathFeedbackEvent,
  AdaptiveLearningPathPlan,
} from '@/features/personalization/path-planning/public-api';

export const ADAPTIVE_OPTIMIZATION_EXPERIMENTS_FEATURE_FLAG = 'ADAPTIVE_OPTIMIZATION_EXPERIMENTS_ENABLED';
export const ADAPTIVE_BANDIT_RERANKING_FEATURE_FLAG = 'ADAPTIVE_BANDIT_RERANKING_ENABLED';
export const KONLING_LONG_TERM_MEMORY_FEATURE_FLAG = 'KONLING_LONG_TERM_MEMORY_ENABLED';

export type AdaptiveOptimizationVariant =
  | 'current-recommendation-cards'
  | 'rules-graph-path'
  | 'rules-graph-bandit'
  | 'rules-graph-bandit-konling';

export type AdaptiveOptimizationMetricName =
  | 'path-adoption'
  | 'path-deviation'
  | 'correction-success'
  | 'explanation-click'
  | 'intervention-acceptance'
  | 'follow-through-48h'
  | 'learner-state-freshness'
  | 'source-coverage'
  | 'low-confidence-rate';

export interface AdaptiveBanditFeedbackSummary {
  nodeId: string;
  impressions: number;
  positiveOutcomes: number;
  negativeOutcomes?: number;
  lastOutcomeAt?: string | null;
}

export interface AdaptiveBanditRerankInput {
  plan: AdaptiveLearningPathPlan;
  enabled: boolean;
  learnerContext?: {
    abilityScore?: number | null;
    confidenceScore?: number | null;
    preferredModalities?: string[];
  };
  feedbackHistory?: AdaptiveBanditFeedbackSummary[];
}

export interface AdaptiveBanditRerankResult {
  policyFamily: 'rules-plus-graph-bandit';
  applied: boolean;
  reason: string;
  alternatives: AdaptiveLearningPathAlternative[];
  rejected: Array<{ nodeId: string; reason: string }>;
}

export interface AdaptiveExperimentAssignmentInput {
  experimentId: string;
  studentId: string;
  classId?: string | null;
  cohortId?: string | null;
  initialAbilityScore?: number | null;
  variants?: AdaptiveOptimizationVariant[];
  eligible: boolean;
  eligibilityReason?: string;
  exclusionReason?: string | null;
  assignedAt?: Date;
}

export interface AdaptiveExperimentAssignment {
  experimentId: string;
  studentId: string;
  classId: string | null;
  cohortId: string | null;
  initialAbilityStratum: 'unknown' | 'low' | 'medium' | 'high';
  variant: AdaptiveOptimizationVariant | null;
  eligible: boolean;
  eligibilityReason: string;
  exclusionReason: string | null;
  assignedAt: string;
  assignmentKey: string;
}

export interface AdaptiveOptimizationMetricEvent {
  metric: AdaptiveOptimizationMetricName;
  variant: AdaptiveOptimizationVariant;
  classId?: string | null;
  cohortId?: string | null;
  value: number | boolean;
  evidenceWindowHours?: number;
  completeness?: number | null;
  confidence?: number | null;
  sampleWeight?: number;
  rawAnswerBody?: unknown;
  privateDialogueText?: unknown;
  hiddenArenaEvaluationInternals?: unknown;
  rawTrace?: unknown;
}

export interface AdaptiveOptimizationMetricSummary {
  metric: AdaptiveOptimizationMetricName;
  variant: AdaptiveOptimizationVariant;
  classId: string | null;
  cohortId: string | null;
  sampleCount: number;
  value: number | null;
  confidence: 'low' | 'medium' | 'high';
  completeness: 'missing' | 'partial' | 'complete';
  evidenceWindowHours: number | null;
  privacyAggregationLevel: 'variant-aggregate' | 'class-aggregate' | 'cohort-aggregate';
}

export interface LongTermMemoryGateInput {
  semanticMemoryRequested: boolean;
  strategyMemoryRequested: boolean;
  privacyAuditCovered: boolean;
  stage1OutcomesStable: boolean;
  persistedInterventionOutcomeCount: number;
  evaluationMetricsAvailable: boolean;
  featureFlagEnabled: boolean;
}

export interface LongTermMemoryGateResult {
  enabled: boolean;
  semanticMemoryEnabled: boolean;
  strategyMemoryEnabled: boolean;
  rollbackFeatureFlag: typeof KONLING_LONG_TERM_MEMORY_FEATURE_FLAG;
  reasons: string[];
}

const DEFAULT_VARIANTS: AdaptiveOptimizationVariant[] = [
  'current-recommendation-cards',
  'rules-graph-path',
  'rules-graph-bandit',
  'rules-graph-bandit-konling',
];

export function rerankAdaptivePathAlternativesWithBandit(
  input: AdaptiveBanditRerankInput,
): AdaptiveBanditRerankResult {
  const deterministicAlternatives = [...input.plan.alternatives];
  if (!input.enabled) {
    return {
      policyFamily: 'rules-plus-graph-bandit',
      applied: false,
      reason: 'bandit-disabled',
      alternatives: deterministicAlternatives,
      rejected: [],
    };
  }
  if (input.plan.status !== 'ready' || input.plan.mainPath.length === 0) {
    return {
      policyFamily: 'rules-plus-graph-bandit',
      applied: false,
      reason: 'feasible-path-required',
      alternatives: deterministicAlternatives,
      rejected: [],
    };
  }

  const feedbackByNode = new Map((input.feedbackHistory ?? []).map((item) => [item.nodeId, item]));
  const rejected: Array<{ nodeId: string; reason: string }> = [];
  const rerankableCandidates = deterministicAlternatives.filter((alternative) => {
    if (alternative.blocked) {
      rejected.push({ nodeId: alternative.nodeId, reason: 'blocked-alternative' });
      return false;
    }
    if (alternative.nodeIds.length === 0) {
      rejected.push({ nodeId: alternative.nodeId, reason: 'empty-alternative-chain' });
      return false;
    }
    return true;
  });

  if (rerankableCandidates.length <= 1) {
    return {
      policyFamily: 'rules-plus-graph-bandit',
      applied: false,
      reason: 'insufficient-local-alternatives',
      alternatives: deterministicAlternatives,
      rejected,
    };
  }

  const rerankable = rerankableCandidates
    .map((alternative) => ({
      alternative,
      banditScore: round(alternative.score + banditReward(feedbackByNode.get(alternative.nodeId), input.learnerContext), 4),
    }))
    .sort((left, right) => right.banditScore - left.banditScore || left.alternative.nodeId.localeCompare(right.alternative.nodeId))
    .map(({ alternative, banditScore }) => ({
      ...alternative,
      score: banditScore,
      reasonCodes: unique([...alternative.reasonCodes, 'contextual-bandit-local-rerank']),
    }));

  return {
    policyFamily: 'rules-plus-graph-bandit',
    applied: true,
    reason: 'local-alternatives-reranked',
    alternatives: [
      ...rerankable,
      ...deterministicAlternatives.filter((alternative) => alternative.blocked),
    ],
    rejected,
  };
}

export function assignAdaptiveOptimizationExperiment(
  input: AdaptiveExperimentAssignmentInput,
): AdaptiveExperimentAssignment {
  const variants = input.variants?.length ? input.variants : DEFAULT_VARIANTS;
  const initialAbilityStratum = abilityStratum(input.initialAbilityScore);
  const assignedAt = (input.assignedAt ?? new Date()).toISOString();
  const stratumKey = [
    input.experimentId,
    input.classId ?? 'no-class',
    input.cohortId ?? 'no-cohort',
    initialAbilityStratum,
    input.studentId,
  ].join(':');
  const variant = input.eligible
    ? variants[stableHash(stratumKey) % variants.length]
    : null;

  return {
    experimentId: input.experimentId,
    studentId: input.studentId,
    classId: input.classId ?? null,
    cohortId: input.cohortId ?? null,
    initialAbilityStratum,
    variant,
    eligible: input.eligible,
    eligibilityReason: input.eligibilityReason ?? (input.eligible ? 'eligible' : 'not-eligible'),
    exclusionReason: input.eligible ? null : input.exclusionReason ?? 'eligibility-filtered',
    assignedAt,
    assignmentKey: stratumKey,
  };
}

export function summarizeAdaptiveOptimizationMetrics(
  events: readonly AdaptiveOptimizationMetricEvent[],
  options: { aggregationLevel?: 'variant-aggregate' | 'class-aggregate' | 'cohort-aggregate' } = {},
): AdaptiveOptimizationMetricSummary[] {
  const aggregationLevel = options.aggregationLevel ?? 'variant-aggregate';
  const groups = new Map<string, AdaptiveOptimizationMetricEvent[]>();
  for (const event of events) {
    const key = metricGroupKey(event, aggregationLevel);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return Array.from(groups.entries())
    .map(([, items]) => {
      const first = items[0];
      const sampleCount = items.reduce((sum, item) => sum + (item.sampleWeight ?? 1), 0);
      const numericValues = items.map((item) => typeof item.value === 'boolean' ? (item.value ? 1 : 0) : item.value);
      const value = sampleCount > 0
        ? round(numericValues.reduce((sum, valueItem, index) => sum + valueItem * (items[index].sampleWeight ?? 1), 0) / sampleCount, 4)
        : null;
      const averageCompleteness = average(items.map((item) => item.completeness ?? 0));
      const averageConfidence = average(items.map((item) => item.confidence ?? averageCompleteness));
      return {
        metric: first.metric,
        variant: first.variant,
        classId: aggregationLevel === 'class-aggregate' ? first.classId ?? null : null,
        cohortId: aggregationLevel === 'cohort-aggregate' ? first.cohortId ?? null : null,
        sampleCount,
        value,
        confidence: confidenceMarker(averageConfidence, sampleCount),
        completeness: completenessMarker(averageCompleteness, sampleCount),
        evidenceWindowHours: maxOrNull(items.map((item) => item.evidenceWindowHours)),
        privacyAggregationLevel: aggregationLevel,
      };
    })
    .sort((left, right) =>
      left.metric.localeCompare(right.metric) ||
      left.variant.localeCompare(right.variant) ||
      String(left.classId ?? '').localeCompare(String(right.classId ?? '')) ||
      String(left.cohortId ?? '').localeCompare(String(right.cohortId ?? ''))
    );
}

export function sanitizeAdaptiveOptimizationExport(summaries: readonly AdaptiveOptimizationMetricSummary[]) {
  return summaries.map((summary) => ({
    metric: summary.metric,
    variant: summary.variant,
    classId: summary.classId,
    cohortId: summary.cohortId,
    sampleCount: summary.sampleCount,
    value: summary.value,
    confidence: summary.confidence,
    completeness: summary.completeness,
    evidenceWindowHours: summary.evidenceWindowHours,
    privacyAggregationLevel: summary.privacyAggregationLevel,
  }));
}

export function evaluateLongTermKonlingMemoryGate(input: LongTermMemoryGateInput): LongTermMemoryGateResult {
  const reasons = [
    input.featureFlagEnabled ? null : 'feature-flag-disabled',
    input.privacyAuditCovered ? null : 'privacy-audit-missing',
    input.stage1OutcomesStable ? null : 'stage-1-outcomes-not-stable',
    input.persistedInterventionOutcomeCount > 0 ? null : 'intervention-outcomes-missing',
    input.evaluationMetricsAvailable ? null : 'evaluation-metrics-missing',
  ].filter((item): item is string => Boolean(item));
  const enabled = reasons.length === 0;

  return {
    enabled,
    semanticMemoryEnabled: enabled && input.semanticMemoryRequested,
    strategyMemoryEnabled: enabled && input.strategyMemoryRequested,
    rollbackFeatureFlag: KONLING_LONG_TERM_MEMORY_FEATURE_FLAG,
    reasons,
  };
}

export function summarizePathFeedbackMetrics(
  plan: AdaptiveLearningPathPlan,
): AdaptiveOptimizationMetricEvent[] {
  return plan.feedbackEvents.map((event) => pathFeedbackToMetric(plan, event)).filter((item): item is AdaptiveOptimizationMetricEvent => Boolean(item));
}

function pathFeedbackToMetric(
  plan: AdaptiveLearningPathPlan,
  event: AdaptiveLearningPathFeedbackEvent,
): AdaptiveOptimizationMetricEvent | null {
  const base = {
    variant: 'rules-graph-path' as const,
    evidenceWindowHours: 48,
    completeness: plan.confidence.sourceCoverage,
    confidence: plan.confidence.score,
  };
  if (event.type === 'adoption') return { ...base, metric: 'path-adoption', value: true };
  if (event.type === 'deviation') return { ...base, metric: 'path-deviation', value: true };
  if (event.type === 'correction-success') return { ...base, metric: 'correction-success', value: true };
  if (event.type === 'explanation-click') return { ...base, metric: 'explanation-click', value: true };
  return null;
}

function metricGroupKey(
  event: AdaptiveOptimizationMetricEvent,
  aggregationLevel: AdaptiveOptimizationMetricSummary['privacyAggregationLevel'],
): string {
  const scopeKey = aggregationLevel === 'class-aggregate'
    ? event.classId ?? 'unknown-class'
    : aggregationLevel === 'cohort-aggregate'
      ? event.cohortId ?? 'unknown-cohort'
      : 'all';
  return `${event.metric}:${event.variant}:${aggregationLevel}:${scopeKey}`;
}

function banditReward(
  feedback: AdaptiveBanditFeedbackSummary | undefined,
  learnerContext: AdaptiveBanditRerankInput['learnerContext'],
): number {
  if (!feedback || feedback.impressions <= 0) return 0;
  const total = feedback.positiveOutcomes + (feedback.negativeOutcomes ?? 0);
  const empiricalReward = total > 0 ? feedback.positiveOutcomes / total : feedback.positiveOutcomes / feedback.impressions;
  const confidenceWeight = learnerContext?.confidenceScore ?? 0.5;
  return empiricalReward * Math.max(0.1, Math.min(1, confidenceWeight));
}

function abilityStratum(score: number | null | undefined): AdaptiveExperimentAssignment['initialAbilityStratum'] {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'unknown';
  if (score < 0.4) return 'low';
  if (score < 0.75) return 'medium';
  return 'high';
}

function confidenceMarker(score: number, sampleCount: number): AdaptiveOptimizationMetricSummary['confidence'] {
  if (sampleCount < 5 || score < 0.4) return 'low';
  if (sampleCount < 20 || score < 0.75) return 'medium';
  return 'high';
}

function completenessMarker(score: number, sampleCount: number): AdaptiveOptimizationMetricSummary['completeness'] {
  if (sampleCount === 0) return 'missing';
  if (score < 0.8) return 'partial';
  return 'complete';
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxOrNull(values: Array<number | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : null;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

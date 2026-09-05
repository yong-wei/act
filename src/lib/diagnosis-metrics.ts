import { createHash } from 'node:crypto';

import { z } from 'zod';

import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  buildKnowledgeNodeWeaknessStats,
  governedInputSchema,
  weaknessEligibility,
  type GovernedDiagnosisInput,
} from '@/lib/diagnosis-governed-input';
import { CURRENT_RISK_FLAG_TYPES, type CurrentRiskFlagType, type RiskFlagSeverity } from '@/lib/risk-scanner';

/**
 * 班级诊断报告指标快照（Issue #1963）。
 *
 * 指标由服务端在生成任务冻结的 governed input 与 evidenceCutoff 内确定性
 * 计算；模型输出只写报告文字，永不生成或修改本模块产出的指标值。缺失
 * 维度保留 unavailable/null，不补零，不从报告摘要反推。
 */
export const DIAGNOSIS_METRIC_SCHEMA_VERSION = 'diagnosis-metric-snapshot.v1';
export const DIAGNOSIS_METRIC_COMPUTATION_VERSION = 'class-metrics.v1';
/** 证据覆盖口径标识：成员集合来自任务冻结的班级名册，画像取 cutoff 内最新 native 快照。 */
export const DIAGNOSIS_METRIC_COVERAGE_BASIS = 'class-roster@v1';

const METRIC_ROUND_DIGITS = 2;

const metricAvailabilitySchema = z.enum(['available', 'unavailable']);

const abilityDimensionMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  availability: metricAvailabilitySchema,
  mean: z.number().nullable(),
  averageConfidence: z.number().nullable(),
  includedStudents: z.number().int().nonnegative(),
  missingStudents: z.number().int().nonnegative(),
}).strict();

const scoreOutcomeMetricSchema = z.object({
  availability: metricAvailabilitySchema,
  mean: z.number().nullable(),
  includedStudents: z.number().int().nonnegative(),
  missingStudents: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  scoredCount: z.number().int().nonnegative(),
}).strict();

const riskDistributionMetricSchema = z.object({
  availability: metricAvailabilitySchema,
  flaggedStudents: z.number().int().nonnegative(),
  byType: z.object({
    stagnation: z.number().int().nonnegative(),
    constraint: z.number().int().nonnegative(),
    cross_domain: z.number().int().nonnegative(),
  }).strict(),
  bySeverity: z.object({
    low: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
  }).strict(),
}).strict();

const weakKnowledgePointMetricSchema = z.object({
  nodeId: z.string().min(1),
  weakStudentCount: z.number().int().nonnegative(),
  coveredStudentCount: z.number().int().nonnegative(),
  minimumWeakStudents: z.number().int().nonnegative(),
  eligible: z.boolean(),
}).strict();

export const diagnosisClassMetricDataSchema = z.object({
  memberCount: z.number().int().nonnegative(),
  coverageBasis: z.string().min(1),
  abilityDimensions: z.array(abilityDimensionMetricSchema),
  assignmentOutcomes: scoreOutcomeMetricSchema,
  assessmentOutcomes: scoreOutcomeMetricSchema,
  riskDistribution: riskDistributionMetricSchema,
  weakKnowledgePoints: z.array(weakKnowledgePointMetricSchema),
}).strict();

export type DiagnosisClassMetricData = z.output<typeof diagnosisClassMetricDataSchema>;

export function parseGovernedDiagnosisInput(value: unknown): GovernedDiagnosisInput {
  return governedInputSchema.parse(value);
}

/** 成员集合身份指纹：排序去重 learner id 集合的确定性哈希，仅用于相等性比较，不还原个体。 */
export function computeMemberSetFingerprint(memberUserIds: readonly string[]): string {
  const ids = [...new Set(memberUserIds)].sort();
  return createHash('sha256').update(ids.join('\n'), 'utf8').digest('hex');
}

export interface ClassDiagnosisPortraitDimension {
  id: string;
  score: number;
  confidence: number;
}

export interface ClassDiagnosisMetricsSource {
  /** 任务冻结的班级成员 learner id 列表（governed input 的 studentIds）。 */
  memberUserIds: readonly string[];
  /** 任务冻结的受治理输入（作业/测评/风险/知识点证据）。 */
  governed: GovernedDiagnosisInput;
  /** 每个成员在 evidenceCutoff 内最新的 native portrait v2 七维投影。 */
  portraits: ReadonlyMap<string, ReadonlyArray<ClassDiagnosisPortraitDimension>>;
}

function roundMetric(value: number): number {
  return Math.round(value * 10 ** METRIC_ROUND_DIGITS) / 10 ** METRIC_ROUND_DIGITS;
}

function meanOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function abilityDimensionMetrics(
  memberUserIds: readonly string[],
  portraits: ReadonlyMap<string, ReadonlyArray<ClassDiagnosisPortraitDimension>>,
) {
  return PORTRAIT_V2_DIMENSIONS.map((dimension) => {
    const scores: number[] = [];
    const confidences: number[] = [];
    for (const userId of memberUserIds) {
      const state = portraits.get(userId)?.find((entry) => entry.id === dimension.id);
      if (!state || !Number.isFinite(state.score) || !Number.isFinite(state.confidence)) continue;
      scores.push(state.score);
      confidences.push(state.confidence);
    }
    return {
      id: dimension.id,
      label: dimension.label,
      availability: scores.length > 0 ? 'available' as const : 'unavailable' as const,
      mean: meanOf(scores),
      averageConfidence: meanOf(confidences),
      includedStudents: scores.length,
      missingStudents: memberUserIds.length - scores.length,
    };
  });
}

function scoreOutcomeMetrics(
  memberCount: number,
  rows: ReadonlyArray<{ userId: string; scorePercent: number }>,
): z.output<typeof scoreOutcomeMetricSchema> {
  const scored = rows.filter((row) => Number.isFinite(row.scorePercent));
  const includedStudents = new Set(scored.map((row) => row.userId)).size;
  return {
    availability: scored.length > 0 ? 'available' as const : 'unavailable' as const,
    mean: meanOf(scored.map((row) => row.scorePercent)),
    includedStudents,
    missingStudents: Math.max(memberCount - includedStudents, 0),
    evidenceCount: rows.length,
    scoredCount: scored.length,
  };
}

function riskDistributionMetrics(
  memberCount: number,
  riskFlags: ReadonlyArray<{ userId: string; type: string; severity: string }>,
): z.output<typeof riskDistributionMetricSchema> {
  const byType: Record<CurrentRiskFlagType, number> = { stagnation: 0, constraint: 0, cross_domain: 0 };
  const bySeverity: Record<RiskFlagSeverity, number> = { low: 0, medium: 0, high: 0 };
  const flaggedStudents = new Set<string>();
  for (const flag of riskFlags) {
    if (!(CURRENT_RISK_FLAG_TYPES as readonly string[]).includes(flag.type)) continue;
    byType[flag.type as CurrentRiskFlagType] += 1;
    if (flag.severity === 'low' || flag.severity === 'medium' || flag.severity === 'high') {
      bySeverity[flag.severity] += 1;
    }
    flaggedStudents.add(flag.userId);
  }
  return {
    availability: memberCount > 0 ? 'available' as const : 'unavailable' as const,
    flaggedStudents: flaggedStudents.size,
    byType,
    bySeverity,
  };
}

function weakKnowledgePointMetrics(
  knowledgeProgress: ReadonlyArray<{ userId: string; nodeId: string; status: string; progress: number }>,
) {
  const stats = buildKnowledgeNodeWeaknessStats(knowledgeProgress);
  return [...stats.entries()]
    .map(([nodeId, stat]) => ({
      nodeId,
      weakStudentCount: stat.weakStudents.size,
      coveredStudentCount: stat.coveredStudents.size,
      ...weaknessEligibility(stat, null),
    }))
    .filter((entry) => entry.eligible)
    .sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
}

/**
 * 纯函数：同一输入必得同一输出（确定性），无 IO、无时钟、无随机源。
 * 作业成绩口径与 provider 一致（score/totalPoints 百分比），测评成绩沿用
 * governed input 冻结的原始分值口径。
 */
export function computeClassDiagnosisMetrics(source: ClassDiagnosisMetricsSource): DiagnosisClassMetricData {
  const memberUserIds = [...new Set(source.memberUserIds)].sort();
  const assignments = (source.governed.assignmentSubmissions ?? []).map((row) => ({
    userId: row.userId,
    scorePercent: roundMetric((row.score / row.totalPoints) * 100),
  }));
  const assessments = (source.governed.assessmentSessions ?? []).map((row) => ({
    userId: row.userId,
    scorePercent: roundMetric(row.score),
  }));
  return {
    memberCount: memberUserIds.length,
    coverageBasis: DIAGNOSIS_METRIC_COVERAGE_BASIS,
    abilityDimensions: abilityDimensionMetrics(memberUserIds, source.portraits),
    assignmentOutcomes: scoreOutcomeMetrics(memberUserIds.length, assignments),
    assessmentOutcomes: scoreOutcomeMetrics(memberUserIds.length, assessments),
    riskDistribution: riskDistributionMetrics(memberUserIds.length, source.governed.riskFlags),
    weakKnowledgePoints: weakKnowledgePointMetrics(source.governed.knowledgeProgress),
  };
}

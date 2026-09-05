import { createHash } from 'node:crypto';

import { PORTRAIT_V2_DIMENSIONS } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  buildKnowledgeNodeWeaknessStats,
  governedInputSchema,
  weaknessEligibility,
  type GovernedDiagnosisInput,
} from '@/lib/diagnosis-governed-input';
import { CURRENT_RISK_FLAG_TYPES, type CurrentRiskFlagType, type RiskFlagSeverity } from '@/lib/risk-scanner';

/**
 * 班级诊断报告指标快照的服务端计算（Issue #1963）。
 *
 * 指标由服务端在生成任务冻结的 governed input 与 evidenceCutoff 内确定性
 * 计算；模型输出只写报告文字，永不生成或修改本模块产出的指标值。缺失
 * 维度保留 unavailable/null，不补零，不从报告摘要反推。
 *
 * JSON 合同（schema 与类型）在 diagnosis-metric-schema.ts——该模块被
 * 客户端投影加载，本模块含 Node 内置加密依赖，绝不能进入客户端依赖图。
 */
import {
  DIAGNOSIS_METRIC_COMPUTATION_VERSION,
  DIAGNOSIS_METRIC_COVERAGE_BASIS,
  DIAGNOSIS_METRIC_SCHEMA_VERSION,
  diagnosisClassMetricDataSchema,
  type DiagnosisClassMetricData,
} from '@/lib/diagnosis-metric-schema';

export {
  DIAGNOSIS_METRIC_COMPUTATION_VERSION,
  DIAGNOSIS_METRIC_COVERAGE_BASIS,
  DIAGNOSIS_METRIC_SCHEMA_VERSION,
  diagnosisClassMetricDataSchema,
} from '@/lib/diagnosis-metric-schema';
export type { DiagnosisClassMetricData } from '@/lib/diagnosis-metric-schema';

const METRIC_ROUND_DIGITS = 2;

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
): DiagnosisClassMetricData['assignmentOutcomes'] {
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
): DiagnosisClassMetricData['riskDistribution'] {
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

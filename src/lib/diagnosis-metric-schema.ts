import { z } from 'zod';

/**
 * 班级诊断指标快照的 JSON 合同（Issue #1963）。
 *
 * 仅依赖 zod：该模块被教师端客户端投影（project-report-evolution）
 * 加载，绝不能引入 Node 内置加密模块、Prisma 或其他服务端依赖；指标
 * 计算与指纹逻辑留在服务端模块 diagnosis-metrics.ts。
 */
export const DIAGNOSIS_METRIC_SCHEMA_VERSION = 'diagnosis-metric-snapshot.v1';
export const DIAGNOSIS_METRIC_COMPUTATION_VERSION = 'class-metrics.v1';
/** 证据覆盖口径标识：成员集合来自任务冻结的班级名册，画像取 cutoff 内最新 native 快照。 */
export const DIAGNOSIS_METRIC_COVERAGE_BASIS = 'class-roster@v1';

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

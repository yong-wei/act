import { z } from 'zod';

/**
 * 诊断受治理输入（governed input）与知识点薄弱判定口径的唯一真源
 * （Issue #1963 自 provider 下沉为轻量共享模块，仅依赖 zod）。
 *
 * 下沉动机：指标快照计算（diagnosis-metrics）与报告持久化边界需要
 * 复用与 provider 完全一致的 schema 与薄弱阈值，但不能把 AI provider
 * 运行时依赖拖进持久化依赖图，也不能形成 persistence → provider →
 * generation → persistence 的循环引用。本模块不得引入运行时或 AI
 * 相关依赖。
 */
export const DIAGNOSIS_WEAK_PROGRESS_THRESHOLD = 40;
export const DIAGNOSIS_WEAK_MIN_STUDENTS = 3;
export const DIAGNOSIS_WEAK_MIN_STUDENT_RATIO = 0.2;

export const governedInputSchema = z.object({
  schemaVersion: z.literal('teacher-diagnosis-governed-input.v1'),
  classId: z.string(),
  studentIds: z.array(z.string()),
  assignmentSubmissions: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    assignmentRevisionId: z.string(),
    contentHash: z.string(),
    score: z.number(),
    totalPoints: z.number().positive(),
    reviewedAt: z.string(),
  })).optional(),
  assessmentSessions: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    assessmentId: z.string(),
    contentDigest: z.string(),
    itemCount: z.number().int().positive(),
    correctCount: z.number().int().nonnegative(),
    score: z.number(),
    completedAt: z.string(),
  })).optional(),
  riskFlags: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    type: z.string(),
    severity: z.string(),
    description: z.string(),
    evidenceSummary: z.record(z.string(), z.unknown()),
    triggeredAt: z.string(),
    observedAt: z.string(),
  })),
  competencySnapshots: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    snapshotAt: z.string(),
    // portrait-v2-legacy-compatibility-adapter: validate frozen non-sovereign provider input.
    competencyVector: z.record(z.string(), z.unknown()),
    calculationVersion: z.string(),
  })),
  knowledgeProgress: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    nodeId: z.string(),
    status: z.string(),
    progress: z.number(),
    timeSpent: z.number(),
    lastVisited: z.string(),
  })),
}).strict();

export type GovernedInput = z.infer<typeof governedInputSchema>;
export type GovernedDiagnosisInput = GovernedInput;

export type DiagnosisNodeWeaknessStats = ReadonlyMap<string, {
  coveredStudents: ReadonlySet<string>;
  weakStudents: ReadonlySet<string>;
}>;

function isWeakProgressRow(row: { status: string; progress: number }): boolean {
  return row.status === 'NOT_STARTED'
    || (row.progress < DIAGNOSIS_WEAK_PROGRESS_THRESHOLD && row.status !== 'COMPLETED');
}

/**
 * 节点薄弱资格的唯一判定真源（Issue #1728）：按诊断 scope 类型选择规则——
 * 学生诊断（targetStudentId 存在）要求目标学生该节点行本身弱势；班级诊断
 * 要求弱势学生数达到班级门槛，与班级实际人数无关（单人班级的班级级诊断
 * 同样受 max(3, 20%) 约束，fail-closed 而非降级为单学生规则）。
 */
export function weaknessEligibility(
  stat: { coveredStudents: ReadonlySet<string>; weakStudents: ReadonlySet<string> },
  targetStudentId: string | null | undefined,
) {
  const minimumWeakStudents = Math.max(
    DIAGNOSIS_WEAK_MIN_STUDENTS,
    Math.ceil(DIAGNOSIS_WEAK_MIN_STUDENT_RATIO * stat.coveredStudents.size),
  );
  const eligible = targetStudentId
    ? stat.weakStudents.has(targetStudentId)
    : stat.weakStudents.size >= minimumWeakStudents;
  return { minimumWeakStudents, eligible };
}

export function buildKnowledgeNodeWeaknessStats(
  knowledgeProgress: ReadonlyArray<{ userId: string; nodeId: string; status: string; progress: number }>,
): DiagnosisNodeWeaknessStats {
  const stats = new Map<string, { coveredStudents: Set<string>; weakStudents: Set<string> }>();
  for (const row of knowledgeProgress) {
    if (row.nodeId.length === 0) continue;
    const entry = stats.get(row.nodeId) ?? { coveredStudents: new Set<string>(), weakStudents: new Set<string>() };
    entry.coveredStudents.add(row.userId);
    if (isWeakProgressRow(row)) {
      entry.weakStudents.add(row.userId);
    }
    stats.set(row.nodeId, entry);
  }
  return stats;
}

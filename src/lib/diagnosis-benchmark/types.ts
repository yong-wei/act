/**
 * 学情诊断准确性回归评测（Issue #1729）：版本化基准场景与真值类型。
 *
 * 基准集只包含合成数据：学生、分数与进度均由场景参数确定性生成，
 * 不含真实学生身份、原始答案或私密对话。
 */

export interface DiagnosisBenchmarkWeaknessInjection {
  /** 注入弱势的节点（同时构成场景真值）。 */
  nodeId: string;
  /** 该节点上处于绝对弱势的仿真学生数。 */
  weakStudents: number;
  /** 是否为该场景的首要薄弱节点。 */
  primary?: boolean;
}

export interface DiagnosisBenchmarkAllowedConclusionBoundary {
  /** 数据覆盖不足或证据冲突时，报告必须携带 limitations。 */
  requireLimitations: boolean;
  /** 报告允许的最高置信档。 */
  maxConfidence: 'high' | 'medium' | 'low' | 'unavailable';
}

export interface DiagnosisBenchmarkScenario {
  id: string;
  scenarioVersion: string;
  seed: number;
  description: string;
  studentCount: number;
  nodeCount: number;
  /** 弱势注入计划；空数组即健康班级（真值为无薄弱节点）。 */
  weaknessInjection: DiagnosisBenchmarkWeaknessInjection[];
  /** 知识进度行覆盖率（1 = 全覆盖，0.7 = 30% 缺失）。 */
  progressCoverage: number;
  /** 是否注入作业高分与测评低分的证据冲突。 */
  assignmentAssessmentConflict: boolean;
  allowedConclusionBoundary: DiagnosisBenchmarkAllowedConclusionBoundary;
}

export interface DiagnosisBenchmarkGroundTruth {
  scenarioId: string;
  scenarioVersion: string;
  trueWeakNodes: string[];
  primaryWeakNode: string | null;
  /** 场景实际的知识进度行覆盖率。 */
  actualProgressCoverage: number;
  assignmentAssessmentConflict: boolean;
}

/** 评测治理输入（与生产 governedInput 同构的最小字段集）。 */
export interface DiagnosisBenchmarkGovernedInput {
  schemaVersion: 'teacher-diagnosis-governed-input.v1';
  classId: string;
  studentIds: string[];
  assignmentSubmissions?: Array<{
    id: string;
    userId: string;
    assignmentRevisionId: string;
    contentHash: string;
    score: number;
    totalPoints: number;
    reviewedAt: string;
  }>;
  assessmentSessions?: Array<{
    id: string;
    userId: string;
    assessmentId: string;
    contentDigest: string;
    itemCount: number;
    correctCount: number;
    score: number;
    completedAt: string;
  }>;
  riskFlags: [];
  competencySnapshots: [];
  knowledgeProgress: Array<{
    id: string;
    userId: string;
    nodeId: string;
    status: string;
    progress: number;
    timeSpent: number;
    lastVisited: string;
  }>;
}

export type DiagnosisBenchmarkReplicateStatus =
  | 'ok'
  | 'calibration-rejected'
  | 'generation-failed';

/** 单次重复评测的解析结果（治理重放之后）。 */
export interface DiagnosisBenchmarkReplicateEvaluation {
  scenarioId: string;
  replicate: number;
  status: DiagnosisBenchmarkReplicateStatus;
  /** 报告为薄弱的知识节点集合（带 knowledgeNodeId 的 findings）。 */
  reportedNodes: string[];
  /** 报告的首要薄弱节点（首个知识点 finding）。 */
  primaryReportedNode: string | null;
  chineseCompliant: boolean;
  evidenceRefsValid: boolean;
  attributionValid: boolean;
  coverageClaimAccurate: boolean;
  durationMs: number;
  /** 拒绝原因或生成失败原因（阈值失败明细使用）。 */
  failureReason?: string;
}

export interface DiagnosisBenchmarkScenarioMetrics {
  scenarioId: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  exactMatchRate: number;
  primaryHitRate: number | null;
  /** 健康场景：被报告节点数 / 全部节点数（跨重复平均）。 */
  healthyFalsePositiveRate: number | null;
  chineseComplianceRate: number;
  evidenceReferenceValidityRate: number;
  attributionValidityRate: number;
  coverageClaimAccuracyRate: number;
  generationSuccessRate: number;
  replicateCount: number;
}

export interface DiagnosisBenchmarkAggregateMetrics {
  microPrecision: number | null;
  microRecall: number | null;
  microF1: number | null;
  macroF1: number | null;
  exactMatchRate: number;
  primaryHitRate: number | null;
  healthyFalsePositiveRate: number | null;
  chineseComplianceRate: number;
  evidenceReferenceValidityRate: number;
  attributionValidityRate: number;
  coverageClaimAccuracyRate: number;
  generationSuccessRate: number;
  scenarioCount: number;
  /** 重复运行稳定性（Issue #1729）：场景宏 F1 的离散程度与最差值。 */
  replicateDispersion: { macroF1Stdev: number | null; macroF1Worst: number | null };
}

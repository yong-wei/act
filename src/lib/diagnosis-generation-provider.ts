import { createHash } from 'node:crypto';

import { type Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  DiagnosisGenerationOutputValidationError,
  DIAGNOSIS_PROVIDER_GENERATION_WINDOW_MS,
} from '@/lib/diagnosis-generation';
import {
  diagnosisReportBodySchema,
  type DiagnosisReportBody,
} from '@/lib/diagnosis-persistence';
import { digestDiagnosisGovernedInput } from '@/lib/diagnosis-generation-preflight';
import {
  getOrCreateKonlingAgentSession,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { SmartLessonPlanError } from '@/lib/smart-lesson-plan/domain';
import {
  resolveSmartLessonStructuredProvider,
  TextJsonFallbackOutputError,
} from '@/lib/smart-lesson-plan/provider-runtime';

const DIAGNOSIS_TOOLS = [
  'get_class_assignment_outcomes',
  'get_class_assessment_outcomes',
  'get_student_risk_flags',
  'get_class_competency_summary',
  'get_student_knowledge_progress',
] as const;

const MAX_PROVIDER_OUTCOME_ROWS = 24;
const MAX_PROVIDER_RISK_ROWS = 24;
const MAX_PROVIDER_EVIDENCE_REFS = 24;
const MAX_PROVIDER_PROGRESS_EVIDENCE_REFS = 6;
const DIAGNOSIS_PROVIDER_MAX_OUTPUT_TOKENS = 2_400;
const DIAGNOSIS_PROVIDER_MAX_SUMMARY_LENGTH = 1_000;
const DIAGNOSIS_PROVIDER_MAX_FINDINGS = 6;
const DIAGNOSIS_PROVIDER_MAX_FINDING_SUMMARY_LENGTH = 280;
const DIAGNOSIS_PROVIDER_MAX_EVIDENCE_REFS = 16;
// 薄弱判定校准（Issue #1728）：弱势行的绝对分界与最小证据规模。
const DIAGNOSIS_WEAK_PROGRESS_THRESHOLD = 40;
const DIAGNOSIS_WEAK_MIN_STUDENTS = 3;
const DIAGNOSIS_WEAK_MIN_STUDENT_RATIO = 0.2;

const governedInputSchema = z.object({
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

export class DiagnosisGenerationValidationError extends Error {
  readonly retryable = false;

  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'DiagnosisGenerationValidationError';
  }
}

export class DiagnosisGenerationProviderEmptyOutputError extends Error {
  constructor() {
    super('诊断模型未返回可用的结构化结果。');
    this.name = 'DiagnosisGenerationProviderEmptyOutputError';
  }
}

export class DiagnosisGenerationProviderLanguageError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型返回的报告内容不是简体中文。');
    this.name = 'DiagnosisGenerationProviderLanguageError';
    this.violations = violations;
  }
}

export class DiagnosisGenerationFindingAttributionError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型返回的知识点发现缺少与受治理证据一致的知识节点归因。');
    this.name = 'DiagnosisGenerationFindingAttributionError';
    this.violations = violations;
  }
}

export class DiagnosisFindingCalibrationError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型返回的知识点薄弱判定未满足最小绝对弱势证据或覆盖降级约束。');
    this.name = 'DiagnosisFindingCalibrationError';
    this.violations = violations;
  }
}

export function buildKnowledgeNodeByEvidenceRef(
  knowledgeProgress: ReadonlyArray<{ id: string; nodeId: string }>,
) {
  const nodeByEvidenceRef = new Map<string, string>();
  for (const row of knowledgeProgress) {
    if (row.nodeId.length > 0) {
      nodeByEvidenceRef.set(`knowledge-progress:${row.id}`, row.nodeId);
    }
  }
  return nodeByEvidenceRef;
}

/**
 * 知识节点归因契约（Issue #1712）：归因义务仅适用于引用 knowledge-progress 证据的发现
 * （与投影层 findingRequiresKnowledgeNodeAttribution 语义一致，非知识发现整体豁免）。
 * 引用行横跨多个节点时发现本身归因歧义，无论是否已填节点一律拒绝；
 * 能唯一解析的漏填就地回填；未知节点、与唯一引用证据不一致则拒绝。
 * 由 worker 按模型行为缺陷重试。返回违例字段列表，回填直接修改 findings。
 */
export function enforceDiagnosisFindingNodeAttribution(
  findings: Array<{ knowledgeNodeId?: string; evidenceRefs: ReadonlyArray<string> }>,
  nodeByEvidenceRef: ReadonlyMap<string, string>,
) {
  const governedNodes = new Set(nodeByEvidenceRef.values());
  const violations: string[] = [];
  findings.forEach((finding, index) => {
    const citesKnowledgeProgress = finding.evidenceRefs.some((ref) => ref.startsWith('knowledge-progress:'));
    if (!citesKnowledgeProgress) return;
    const citedNodes = new Set<string>();
    for (const reference of finding.evidenceRefs) {
      const node = nodeByEvidenceRef.get(reference);
      if (node) citedNodes.add(node);
    }
    if (citedNodes.size > 1) {
      violations.push(`findings[${index}].knowledgeNodeId`);
      return;
    }
    if (finding.knowledgeNodeId) {
      const singleCitedNode = citedNodes.size === 1 ? [...citedNodes][0] : null;
      if (citedNodes.size === 0
        || (singleCitedNode !== null && singleCitedNode !== finding.knowledgeNodeId)
        || !governedNodes.has(finding.knowledgeNodeId)) {
        violations.push(`findings[${index}].knowledgeNodeId`);
      }
      return;
    }
    if (citedNodes.size === 1) {
      finding.knowledgeNodeId = [...citedNodes][0];
    }
  });
  return violations;
}

export type DiagnosisNodeWeaknessStats = ReadonlyMap<string, {
  coveredStudents: ReadonlySet<string>;
  weakStudents: ReadonlySet<string>;
}>;

function isWeakProgressRow(row: { status: string; progress: number }): boolean {
  return row.status === 'NOT_STARTED'
    || (row.progress < DIAGNOSIS_WEAK_PROGRESS_THRESHOLD && row.status !== 'COMPLETED');
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

/**
 * 薄弱判定校准契约（Issue #1728）：知识点发现（引用 knowledge-progress 证据，
 * 与归因门同语义）必须锚定满足最小绝对弱势证据的节点——弱势行为
 * NOT_STARTED 或进度低于阈值且未完成；班级诊断按节点弱势学生数
 * ≥ max(下限, 有进度记录学生的比例阈值) 判定，学生诊断要求目标学生
 * 该节点行本身弱势。锚定节点的进度覆盖不足全体被诊断学生时，报告
 * 不得给出 high 置信且必须携带 limitations。违例按模型行为缺陷交由
 * worker 重试，返回违例字段列表。
 */
export function enforceDiagnosisFindingCalibration(
  findings: ReadonlyArray<{
    knowledgeNodeId?: string;
    evidenceRefs: ReadonlyArray<string>;
  }>,
  reportConfidence: string,
  reportLimitations: ReadonlyArray<string>,
  nodeByEvidenceRef: ReadonlyMap<string, string>,
  weaknessStats: DiagnosisNodeWeaknessStats,
  diagnosedStudentIds: ReadonlyArray<string>,
) {
  const violations: string[] = [];
  let coverageGap = false;
  const diagnosedStudentSet = new Set(diagnosedStudentIds);
  findings.forEach((finding, index) => {
    const citesKnowledgeProgress = finding.evidenceRefs.some((ref) => ref.startsWith('knowledge-progress:'));
    if (!citesKnowledgeProgress) return;
    const anchorCandidates = new Set<string>();
    if (finding.knowledgeNodeId) {
      anchorCandidates.add(finding.knowledgeNodeId);
    }
    for (const reference of finding.evidenceRefs) {
      const node = nodeByEvidenceRef.get(reference);
      if (node) anchorCandidates.add(node);
    }
    if (anchorCandidates.size !== 1) {
      // 归因门已拒绝跨节点/不可解析归因；此处不重复归因裁决。
      return;
    }
    const nodeId = [...anchorCandidates][0];
    const stat = weaknessStats.get(nodeId);
    if (!stat) {
      violations.push(`findings[${index}]`);
      return;
    }
    if (stat.coveredStudents.size < diagnosedStudentSet.size) {
      coverageGap = true;
    }
    const minWeakStudents = Math.max(
      DIAGNOSIS_WEAK_MIN_STUDENTS,
      Math.ceil(DIAGNOSIS_WEAK_MIN_STUDENT_RATIO * stat.coveredStudents.size),
    );
    const qualifies = diagnosedStudentSet.size === 1
      ? [...diagnosedStudentSet].every((studentId) => stat.weakStudents.has(studentId))
      : stat.weakStudents.size >= minWeakStudents;
    if (!qualifies) {
      violations.push(`findings[${index}]`);
    }
  });
  if (coverageGap) {
    if (reportConfidence === 'high') {
      violations.push('confidence');
    }
    if (reportLimitations.length === 0) {
      violations.push('limitations');
    }
  }
  return violations;
}

export type DiagnosisReportLanguageSurface = {
  summary: string;
  findings: ReadonlyArray<{ title: string; summary?: string }>;
  limitations: ReadonlyArray<string>;
};

const DIAGNOSIS_CJK_PATTERN = /[\u4e00-\u9fff]/;
const DIAGNOSIS_LATIN_PATTERN = /[A-Za-z]/;
// 假名（ひらがな/カタカナ）出现即判定非简体中文。
const DIAGNOSIS_KANA_PATTERN = /[\u3040-\u30ff]/;
// 高频繁体专用字黑名单（简化字对应不同码点）：U+4E00–U+9FFF 同时覆盖繁体与日文汉字，
// 仅凭 CJK 计数无法区分简体；该黑名单在不引入映射库的前提下确定性拒绝
// 明显的繁体/日文回归（例如"課程學習進度良好"）。生僻繁体字混排存在理论绕过空间，
// 见 change design 残余披露。
const DIAGNOSIS_TRADITIONAL_ONLY_CHARS = [
  '們個來對時會點於從說話學習課業進語讀寫開關門東樂體無為後發經過還這麼',
  '風險標誌見聽認識質氣醫藥題請謝論議訊資費買賣務動極構樣機權歷歸當複補',
  '覺觀親聯腦舊國圖壓縮優眾傳傷參雙誤誰護讓變靈顯響頻顧飛養餘驗驚龍專練',
  '總織續紅純級紀統網維線遠適選遲錯鍵鎮難電頁頂願類飯館鬧麥賽據證擔擊齣',
].join('');
const DIAGNOSIS_TRADITIONAL_ONLY_PATTERN = new RegExp(`[${DIAGNOSIS_TRADITIONAL_ONLY_CHARS}]`);

export function isSimplifiedChineseNaturalLanguageText(value: string) {
  const cjkCount = value.match(new RegExp(DIAGNOSIS_CJK_PATTERN.source, 'gu'))?.length ?? 0;
  if (cjkCount === 0) return false;
  if (DIAGNOSIS_KANA_PATTERN.test(value)) return false;
  if (DIAGNOSIS_TRADITIONAL_ONLY_PATTERN.test(value)) return false;
  const latinCount = value.match(new RegExp(DIAGNOSIS_LATIN_PATTERN.source, 'g'))?.length ?? 0;
  return cjkCount >= latinCount;
}

export function validateDiagnosisReportBodyLanguage(reportBody: DiagnosisReportLanguageSurface) {
  const violations: string[] = [];
  if (!isSimplifiedChineseNaturalLanguageText(reportBody.summary)) {
    violations.push('summary');
  }
  reportBody.findings.forEach((finding, index) => {
    if (!isSimplifiedChineseNaturalLanguageText(finding.title)) {
      violations.push(`findings[${index}].title`);
    }
    if (finding.summary && !isSimplifiedChineseNaturalLanguageText(finding.summary)) {
      violations.push(`findings[${index}].summary`);
    }
  });
  reportBody.limitations.forEach((limitation, index) => {
    if (!isSimplifiedChineseNaturalLanguageText(limitation)) {
      violations.push(`limitations[${index}]`);
    }
  });
  return violations;
}

const diagnosisProviderEvidenceRefSchema = z.string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^(assignment-submission|adaptive-assessment-session|student-risk-flag|student-competency-snapshot|knowledge-progress):[A-Za-z0-9._:-]+$/);

const diagnosisProviderFindingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(DIAGNOSIS_PROVIDER_MAX_FINDING_SUMMARY_LENGTH).optional(),
  knowledgeNodeId: z.string().trim().min(1).max(200).optional(),
  riskType: z.enum(['stagnation', 'constraint', 'cross_domain']).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  evidenceRefs: z.array(diagnosisProviderEvidenceRefSchema).max(6).default([]),
  confidence: z.enum(['high', 'medium', 'low', 'unavailable']).optional(),
}).strict();

const diagnosisProviderOutcomeCoverageSchema = z.object({
  availability: z.literal('available'),
  includedStudents: z.number().int().nonnegative(),
  missingStudents: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  scoredCount: z.number().int().nonnegative(),
}).strict();

const diagnosisProviderReportBodySchema = z.object({
  summary: z.string().trim().min(1).max(DIAGNOSIS_PROVIDER_MAX_SUMMARY_LENGTH),
  findings: z.array(diagnosisProviderFindingSchema).max(DIAGNOSIS_PROVIDER_MAX_FINDINGS).default([]),
  evidenceRefs: z.array(diagnosisProviderEvidenceRefSchema).min(1).max(DIAGNOSIS_PROVIDER_MAX_EVIDENCE_REFS),
  evidenceCutoff: z.string().datetime({ offset: true }),
  sourceCoverage: z.object({
    classMembers: z.number().int().nonnegative().optional(),
    includedStudents: z.number().int().nonnegative().optional(),
    progressRows: z.number().int().nonnegative().optional(),
    coverage: z.number().min(0).max(1).optional(),
    assignment: diagnosisProviderOutcomeCoverageSchema.optional(),
    assessment: diagnosisProviderOutcomeCoverageSchema.optional(),
  }).strict().refine(
    (coverage) => Object.keys(coverage).length > 0,
    'source coverage must contain at least one governed metric',
  ),
  confidence: z.enum(['high', 'medium', 'low', 'unavailable']),
  limitations: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
}).strict();

export async function generateGovernedDiagnosisReport(
  db: PrismaClient,
  input: {
    jobId: string;
    attemptId: string;
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    evidenceCutoff: Date;
    generatorVersion: string;
    governedInput: Prisma.JsonValue | null;
    inputDigest: string | null;
  },
) {
  const governedInput = governedInputSchema.safeParse(input.governedInput);
  if (!governedInput.success || !input.inputDigest) {
    throw new DiagnosisGenerationValidationError('diagnosis-governed-input-invalid');
  }
  const actualDigest = digestDiagnosisGovernedInput(governedInput.data);
  if (actualDigest !== input.inputDigest) {
    throw new DiagnosisGenerationValidationError('diagnosis-governed-input-digest-mismatch');
  }
  if (governedInput.data.classId !== input.classId) {
    throw new DiagnosisGenerationValidationError('diagnosis-governed-input-scope-mismatch');
  }
  if (input.targetStudentId && (
    governedInput.data.studentIds.length !== 1
    || governedInput.data.studentIds[0] !== input.targetStudentId
  )) {
    throw new DiagnosisGenerationValidationError('diagnosis-governed-input-scope-mismatch');
  }
  const scopeResult = await verifyKonlingRuntimeScope(db, {
    authenticatedUserId: input.teacherId,
    role: 'TEACHER',
    targetUserId: input.targetStudentId ?? input.teacherId,
    classId: input.classId,
    courseId: 'teacher-diagnosis',
    pageId: 'teacher-dashboard-diagnosis',
    teachingAssistantModeId: 'teacher-diagnosis',
    evidenceCutoff: input.evidenceCutoff.toISOString(),
  });
  if (!scopeResult.ok) {
    throw new DiagnosisGenerationValidationError('diagnosis-scope-invalid', scopeResult.error);
  }
  const scope = scopeResult.scope;
  const agentSession = await getOrCreateKonlingAgentSession(db, {
    scope,
    phase: 'teacher-diagnosis-generation',
    status: 'running',
    state: {
      diagnosisGenerationJobId: input.jobId,
      diagnosisGenerationAttemptId: input.attemptId,
      evidenceCutoff: input.evidenceCutoff.toISOString(),
      generatorVersion: input.generatorVersion,
    },
    permittedTools: [...DIAGNOSIS_TOOLS],
  });
  const learnerAliasFor = createReportLearnerAliasResolver(input.attemptId);
  const assignments = projectFrozenAssignments(governedInput.data, learnerAliasFor);
  const assessments = projectFrozenAssessments(governedInput.data, learnerAliasFor);
  const riskFlags = projectFrozenRiskFlags(governedInput.data, learnerAliasFor);
  const competency = input.targetStudentId ? null : projectFrozenCompetency(governedInput.data);
  const knowledgeProgress = projectFrozenKnowledgeProgress(governedInput.data, learnerAliasFor);
  const toolAudit = [
    auditToolResult('get_class_assignment_outcomes', assignments),
    auditToolResult('get_class_assessment_outcomes', assessments),
    auditToolResult('get_student_risk_flags', riskFlags),
    ...(competency ? [auditToolResult('get_class_competency_summary', competency)] : []),
    auditToolResult('get_student_knowledge_progress', knowledgeProgress),
  ];
  const observedRefs = new Set(toolAudit.flatMap((entry) => entry.evidenceRefs));
  if (observedRefs.size === 0) {
    throw new DiagnosisGenerationValidationError('diagnosis-evidence-unavailable');
  }
  const providerToolResults = {
    assignments: compactAssignmentsForProvider(assignments),
    assessments: compactAssessmentsForProvider(assessments),
    riskFlags: compactRiskFlagsForProvider(riskFlags),
    competency: competency ? compactCompetencyForProvider(competency) : null,
    knowledgeProgress: compactKnowledgeProgressForProvider(knowledgeProgress),
  };

  const provider = await resolveSmartLessonStructuredProvider();
  let generated;
  try {
    generated = await provider.generate({
      schema: diagnosisProviderReportBodySchema,
      schemaVersion: 'teacher-diagnosis-report-body.v1',
      promptVersion: input.generatorVersion,
      system: [
        '你是教师学情诊断生成器，只能依据给定的受治理工具结果生成结构化报告。',
        '所有面向教师的自然语言内容（summary、findings 标题与说明、limitations 说明）必须使用简体中文；不得输出英文分析段落。',
        'findings 中引用 knowledge-progress 证据的知识点发现必须携带与引用证据一致的有效 knowledgeNodeId；总体风险、成绩分布等非知识点发现不需要 knowledgeNodeId。',
        '不得创建输入中不存在的 evidenceRefs；不得推断学生身份或输出原始证据。',
        '无法确定知识节点 ID 时，必须省略 findings[].knowledgeNodeId；不得输出空字符串、null 或编造 ID。',
        '知识点薄弱判定必须锚定绝对弱势证据：只有该节点上存在长期未开始（NOT_STARTED）或进度低于 40 且未完成的学生时，才可判为薄弱；班级诊断时弱势学生不足 max(3, 有进度记录学生的 20%) 的节点不得判为薄弱。',
        '仅凭班级内相对较低、但仍处于正常范围（已完成或进度不低于 40）的排序位置，不得把节点判为薄弱；"学完但整体测评不理想"等班级整体问题用不带 knowledgeNodeId 的总体发现表达。',
        '全部知识节点均处于正常范围时，findings 应为空或只含非知识点发现，并在 summary 明确说明未发现明确薄弱节点；不得为了生成结论而强制选取最低节点。',
        '作业与测评证据冲突时不得单方面下强结论：写入 limitations 并降低 confidence；知识进度数据缺失影响判定时，必须在 limitations 说明覆盖情况。',
        '逐人结果仅为确定性代表样本；聚合指标和 sourceCoverage 覆盖完整固定证据。',
        '报告摘要不超过 1000 字符，最多 6 条 findings；每条摘要不超过 280 字符。',
        'evidenceRefs 总数不超过 16，每条 finding 最多引用 6 条；不得罗列逐个学生或逐条证据。',
        `evidenceCutoff 必须严格等于 ${input.evidenceCutoff.toISOString()}。`,
      ].join('\n'),
      prompt: JSON.stringify({
        scope: input.targetStudentId
          ? { type: 'student', classId: input.classId, learnerAlias: learnerAliasFor(input.targetStudentId) }
          : { type: 'class', classId: input.classId },
        evidenceCutoff: input.evidenceCutoff.toISOString(),
        governedToolResults: providerToolResults,
      }),
      idempotencyKey: input.attemptId,
      maxOutputTokens: DIAGNOSIS_PROVIDER_MAX_OUTPUT_TOKENS,
      deferValidation: true,
      fallbackToTextJson: true,
      timeoutMs: DIAGNOSIS_PROVIDER_GENERATION_WINDOW_MS,
    });
  } catch (error) {
    if (
      error instanceof TextJsonFallbackOutputError
      || (error instanceof SmartLessonPlanError && error.code === 'advisory-provider-timeout')
    ) {
      throw new DiagnosisGenerationProviderEmptyOutputError();
    }
    throw error;
  }
  if (generated.usedTextJsonFallback) {
    const parsedFallback = diagnosisProviderReportBodySchema.safeParse(generated.output);
    if (!parsedFallback.success) {
      throw new DiagnosisGenerationProviderEmptyOutputError();
    }
  }
  const parsedReportBody = diagnosisReportBodySchema.safeParse(generated.output);
  if (!parsedReportBody.success) {
    if (generated.usedTextJsonFallback) {
      throw new DiagnosisGenerationProviderEmptyOutputError();
    }
    throw new DiagnosisGenerationOutputValidationError(parsedReportBody.error);
  }
  const reportBody = {
    ...parsedReportBody.data,
    sourceCoverage: {
      ...parsedReportBody.data.sourceCoverage,
      assignment: assignments.sourceCoverage,
      assessment: assessments.sourceCoverage,
    },
  } as DiagnosisReportBody;
  if (reportBody.evidenceCutoff !== input.evidenceCutoff.toISOString()) {
    throw new DiagnosisGenerationValidationError('diagnosis-evidence-cutoff-mismatch');
  }
  // 语言契约：英文等非中文输出按"模型行为缺陷"处理，交给既有重试预算，
  // 不得作为成功报告持久化（Issue #1711）。
  const languageViolations = validateDiagnosisReportBodyLanguage(reportBody);
  if (languageViolations.length > 0) {
    throw new DiagnosisGenerationProviderLanguageError(languageViolations);
  }
  const citedRefs = [
    ...reportBody.evidenceRefs,
    ...reportBody.findings.flatMap((finding) => finding.evidenceRefs),
  ];
  if (citedRefs.some((ref) => !observedRefs.has(ref))) {
    throw new DiagnosisGenerationValidationError('diagnosis-unobserved-evidence-reference');
  }
  // 知识节点归因契约（Issue #1712）：可唯一解析的漏填就地回填，
  // 歧义/未知/不一致节点按模型行为缺陷拒绝重试，不得持久化。
  const knowledgeNodeByEvidenceRef = buildKnowledgeNodeByEvidenceRef(governedInput.data.knowledgeProgress);
  const attributionViolations = enforceDiagnosisFindingNodeAttribution(reportBody.findings, knowledgeNodeByEvidenceRef);
  if (attributionViolations.length > 0) {
    throw new DiagnosisGenerationFindingAttributionError(attributionViolations);
  }
  // 薄弱判定校准契约（Issue #1728）：不满足最小绝对弱势证据的知识点
  // 薄弱判定与覆盖不足未降级的报告按模型行为缺陷拒绝重试，不得持久化。
  const weaknessStats = buildKnowledgeNodeWeaknessStats(governedInput.data.knowledgeProgress);
  const calibrationViolations = enforceDiagnosisFindingCalibration(
    reportBody.findings,
    reportBody.confidence,
    reportBody.limitations,
    knowledgeNodeByEvidenceRef,
    weaknessStats,
    governedInput.data.studentIds,
  );
  if (calibrationViolations.length > 0) {
    throw new DiagnosisFindingCalibrationError(calibrationViolations);
  }
  return {
    reportBody,
    agentSessionId: agentSession.id,
    providerResponseId: generated.normalizedResponseId,
    toolAudit,
  };
}

type GovernedInput = z.infer<typeof governedInputSchema>;

function projectFrozenAssignments(
  input: GovernedInput,
  learnerAliasFor: (userId: string) => string,
) {
  const assignments = (input.assignmentSubmissions ?? []).map((row) => ({
    learnerAlias: learnerAliasFor(row.userId),
    assignmentRevisionId: row.assignmentRevisionId,
    contentHash: row.contentHash,
    score: row.score,
    totalPoints: row.totalPoints,
    scorePercent: normalizeAssignmentScore(row.score, row.totalPoints),
    reviewedAt: row.reviewedAt,
    evidenceRefs: [`assignment-submission:${row.id}`],
  }));
  return {
    classId: input.classId,
    assignments,
    evidenceRefs: assignments.flatMap((row) => row.evidenceRefs),
    sourceCoverage: sourceCoverage(input.studentIds, assignments),
    confidence: assignments.length > 0 ? 'high' : 'unavailable',
    limitations: assignments.length > 0 ? [] : ['no-reviewed-assignment-outcomes'],
    privacyClass: 'teacher-scoped',
  };
}

function projectFrozenAssessments(
  input: GovernedInput,
  learnerAliasFor: (userId: string) => string,
) {
  const assessments = (input.assessmentSessions ?? []).map((row) => ({
    learnerAlias: learnerAliasFor(row.userId),
    assessmentId: row.assessmentId,
    contentDigest: row.contentDigest,
    itemCount: row.itemCount,
    correctCount: row.correctCount,
    score: row.score,
    completedAt: row.completedAt,
    evidenceRefs: [`adaptive-assessment-session:${row.id}`],
  }));
  return {
    classId: input.classId,
    assessments,
    evidenceRefs: assessments.flatMap((row) => row.evidenceRefs),
    sourceCoverage: sourceCoverage(input.studentIds, assessments),
    confidence: assessments.length > 0 ? 'high' : 'unavailable',
    limitations: assessments.length > 0 ? [] : ['no-class-assessment-outcomes'],
    privacyClass: 'teacher-scoped',
  };
}

function sourceCoverage(
  studentIds: string[],
  rows: Array<{ learnerAlias: string; score: number }>,
) {
  const includedStudents = new Set(rows.map((row) => row.learnerAlias)).size;
  return {
    availability: 'available' as const,
    includedStudents,
    missingStudents: Math.max(studentIds.length - includedStudents, 0),
    evidenceCount: rows.length,
    scoredCount: rows.filter((row) => Number.isFinite(row.score)).length,
  };
}

function createReportLearnerAliasResolver(attemptId: string) {
  const aliases = new Map<string, string>();
  const reportPrefix = createHash('sha256').update(attemptId).digest('hex').slice(0, 12);

  return (userId: string) => {
    const existing = aliases.get(userId);
    if (existing) return existing;
    const alias = `learner-${reportPrefix}-${aliases.size + 1}`;
    aliases.set(userId, alias);
    return alias;
  };
}

function projectFrozenRiskFlags(
  input: GovernedInput,
  learnerAliasFor: (userId: string) => string,
) {
  const flags = input.riskFlags.map((row) => ({
    learnerAlias: learnerAliasFor(row.userId),
    type: row.type,
    severity: row.severity,
    summary: row.description,
    triggeredAt: row.triggeredAt,
    evidenceSummary: row.evidenceSummary,
    evidenceCutoff: row.observedAt,
    evidenceRefs: [`student-risk-flag:${row.id}`],
  }));
  return {
    classId: input.classId,
    learners: input.studentIds.map(learnerAliasFor),
    flags,
    evidenceRefs: flags.flatMap((flag) => flag.evidenceRefs),
    sourceCoverage: {
      classMembers: input.studentIds.length,
      includedStudents: new Set(flags.map((flag) => flag.learnerAlias)).size,
    },
    confidence: flags.length > 0 ? 'medium' : 'unavailable',
    limitations: flags.length > 0 ? [] : ['no-current-governed-risk-flags'],
    privacyClass: 'teacher-scoped',
  };
}

function projectFrozenCompetency(input: GovernedInput) {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of input.competencySnapshots) {
    // portrait-v2-legacy-compatibility-adapter: aggregate the frozen non-sovereign input only.
    for (const [dimension, value] of Object.entries(row.competencyVector)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const current = totals.get(dimension) ?? { sum: 0, count: 0 };
      current.sum += value;
      current.count += 1;
      totals.set(dimension, current);
    }
  }
  const dimensions = Object.fromEntries([...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dimension, value]) => [dimension, {
      mean: Math.round((value.sum / value.count) * 100) / 100,
      evidencedMembers: value.count,
      missingMembers: Math.max(input.studentIds.length - value.count, 0),
    }]));
  const coverage = input.studentIds.length === 0
    ? 0
    : input.competencySnapshots.length / input.studentIds.length;
  return {
    classId: input.classId,
    dimensions,
    evidenceRefs: input.competencySnapshots.map((row) => `student-competency-snapshot:${row.id}`),
    sourceCoverage: {
      classMembers: input.studentIds.length,
      includedStudents: input.competencySnapshots.length,
      coverage,
    },
    confidence: coverage >= 0.8 && input.competencySnapshots.length >= 5
      ? 'high'
      : coverage > 0 ? 'medium' : 'unavailable',
    limitations: coverage === 0 ? ['no-current-competency-snapshots'] : [],
    privacyClass: 'teacher-scoped',
  };
}

function projectFrozenKnowledgeProgress(
  input: GovernedInput,
  learnerAliasFor: (userId: string) => string,
) {
  const progress = input.knowledgeProgress.map((row) => ({
    learnerAlias: learnerAliasFor(row.userId),
    knowledgeNodeId: row.nodeId,
    status: row.status,
    progress: row.progress,
    timeSpentSeconds: row.timeSpent,
    lastVisitedAt: row.lastVisited,
    evidenceRefs: [`knowledge-progress:${row.id}`],
  }));
  return {
    classId: input.classId,
    learners: input.studentIds.map(learnerAliasFor),
    progress,
    evidenceRefs: progress.flatMap((row) => row.evidenceRefs),
    sourceCoverage: {
      classMembers: input.studentIds.length,
      includedStudents: new Set(progress.map((row) => row.learnerAlias)).size,
      progressRows: progress.length,
    },
    confidence: progress.length > 0 ? 'medium' : 'unavailable',
    limitations: progress.length > 0 ? [] : ['no-knowledge-progress-evidence'],
    privacyClass: 'teacher-scoped',
  };
}

function compactAssignmentsForProvider(projection: ReturnType<typeof projectFrozenAssignments>) {
  const assignments = selectRepresentativeScoredRows(
    projection.assignments,
    MAX_PROVIDER_OUTCOME_ROWS,
    (assignment) => assignment.scorePercent,
  );
  return {
    ...projection,
    assignments,
    evidenceRefs: assignments.flatMap((row) => row.evidenceRefs),
    aggregate: assignmentScoreAggregate(projection.assignments),
    providerProjection: providerProjectionMetadata(projection.assignments.length, assignments.length),
  };
}

function compactAssessmentsForProvider(projection: ReturnType<typeof projectFrozenAssessments>) {
  const assessments = selectRepresentativeScoredRows(
    projection.assessments,
    MAX_PROVIDER_OUTCOME_ROWS,
    (assessment) => assessment.score,
  );
  return {
    ...projection,
    assessments,
    evidenceRefs: assessments.flatMap((row) => row.evidenceRefs),
    aggregate: scoreAggregate(projection.assessments),
    providerProjection: providerProjectionMetadata(projection.assessments.length, assessments.length),
  };
}

function compactRiskFlagsForProvider(projection: ReturnType<typeof projectFrozenRiskFlags>) {
  const ordered = [...projection.flags].sort((left, right) => (
    `${riskSeverityRank(right.severity)}:${right.type}:${right.evidenceRefs[0]}`.localeCompare(
      `${riskSeverityRank(left.severity)}:${left.type}:${left.evidenceRefs[0]}`,
    )
  ));
  const flags = takeEvenlyDistributed(ordered, MAX_PROVIDER_RISK_ROWS);
  return {
    ...projection,
    learners: [],
    flags,
    evidenceRefs: flags.flatMap((flag) => flag.evidenceRefs),
    aggregate: {
      total: projection.flags.length,
      byType: countBy(projection.flags, (flag) => flag.type),
      bySeverity: countBy(projection.flags, (flag) => flag.severity),
    },
    providerProjection: providerProjectionMetadata(projection.flags.length, flags.length),
  };
}

function compactCompetencyForProvider(projection: ReturnType<typeof projectFrozenCompetency>) {
  const evidenceRefs = takeEvenlyDistributed(projection.evidenceRefs, MAX_PROVIDER_EVIDENCE_REFS);
  return {
    ...projection,
    evidenceRefs,
    providerProjection: providerProjectionMetadata(projection.evidenceRefs.length, evidenceRefs.length),
  };
}

function compactKnowledgeProgressForProvider(projection: ReturnType<typeof projectFrozenKnowledgeProgress>) {
  const grouped = new Map<string, typeof projection.progress>();
  for (const row of projection.progress) {
    const key = `${row.knowledgeNodeId}\u0000${row.status}`;
    const rows = grouped.get(key) ?? [];
    rows.push(row);
    grouped.set(key, rows);
  }
  const progress = [...grouped.values()]
    .map((rows) => {
      const representative = takeEvenlyDistributed(
        [...rows].sort((left, right) => (
          left.progress - right.progress || left.evidenceRefs[0].localeCompare(right.evidenceRefs[0])
        )),
        MAX_PROVIDER_PROGRESS_EVIDENCE_REFS,
      );
      return {
        knowledgeNodeId: rows[0].knowledgeNodeId,
        status: rows[0].status,
        learnerCount: rows.length,
        meanProgress: round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length),
        minProgress: Math.min(...rows.map((row) => row.progress)),
        maxProgress: Math.max(...rows.map((row) => row.progress)),
        meanTimeSpentSeconds: round(rows.reduce((sum, row) => sum + row.timeSpentSeconds, 0) / rows.length),
        evidenceRefs: representative.flatMap((row) => row.evidenceRefs),
      };
    })
    .sort((left, right) => (
      left.knowledgeNodeId.localeCompare(right.knowledgeNodeId) || left.status.localeCompare(right.status)
    ));
  return {
    classId: projection.classId,
    progress,
    evidenceRefs: progress.flatMap((row) => row.evidenceRefs),
    sourceCoverage: projection.sourceCoverage,
    confidence: projection.confidence,
    limitations: projection.limitations,
    privacyClass: projection.privacyClass,
    providerProjection: providerProjectionMetadata(projection.progress.length, progress.length),
  };
}

function selectRepresentativeScoredRows<T extends { evidenceRefs: string[] }>(
  rows: T[],
  limit: number,
  scoreFor: (row: T) => number,
) {
  return takeEvenlyDistributed(
    [...rows].sort((left, right) => (
      scoreFor(left) - scoreFor(right) || left.evidenceRefs[0].localeCompare(right.evidenceRefs[0])
    )),
    limit,
  );
}

function takeEvenlyDistributed<T>(rows: T[], limit: number) {
  if (rows.length <= limit) return rows;
  return Array.from({ length: limit }, (_value, index) => (
    rows[Math.round((index * (rows.length - 1)) / (limit - 1))]
  ));
}

function scoreAggregate(rows: Array<{ score: number }>) {
  if (rows.length === 0) return { count: 0, mean: null, min: null, max: null, below60: 0, atLeast85: 0 };
  const scores = rows.map((row) => row.score);
  return {
    count: rows.length,
    mean: round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    min: Math.min(...scores),
    max: Math.max(...scores),
    below60: scores.filter((score) => score < 60).length,
    atLeast85: scores.filter((score) => score >= 85).length,
  };
}

function assignmentScoreAggregate(rows: Array<{ score: number; totalPoints: number; scorePercent: number }>) {
  if (rows.length === 0) return { count: 0, mean: null, min: null, max: null, below60: 0, atLeast85: 0 };
  const totalPoints = rows.reduce((sum, row) => sum + row.totalPoints, 0);
  const scores = rows.map((row) => row.scorePercent);
  return {
    count: rows.length,
    mean: round((rows.reduce((sum, row) => sum + row.score, 0) / totalPoints) * 100),
    min: Math.min(...scores),
    max: Math.max(...scores),
    below60: scores.filter((score) => score < 60).length,
    atLeast85: scores.filter((score) => score >= 85).length,
  };
}

function normalizeAssignmentScore(score: number, totalPoints: number) {
  return round((score / totalPoints) * 100);
}

function countBy<T>(rows: T[], keyFor: (row: T) => string) {
  return Object.fromEntries(rows.reduce((counts, row) => {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()));
}

function riskSeverityRank(severity: string) {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function providerProjectionMetadata(totalRecords: number, includedRecords: number) {
  return {
    totalRecords,
    includedRecords,
    selection: totalRecords === includedRecords ? 'complete' : 'deterministic-representative-sample',
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function auditToolResult(toolName: typeof DIAGNOSIS_TOOLS[number], result: unknown) {
  const record = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  return {
    toolName,
    evidenceRefs: collectEvidenceRefs(record),
    confidence: typeof record.confidence === 'string' ? record.confidence : null,
    sourceCoverage: record.sourceCoverage ?? null,
    limitations: Array.isArray(record.limitations) ? record.limitations : [],
  };
}

function collectEvidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(collectEvidenceRefs))];
  if (!value || typeof value !== 'object') return [];
  return [...new Set(Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => (
    key === 'evidenceRefs' && Array.isArray(child)
      ? child.filter((item): item is string => typeof item === 'string')
      : collectEvidenceRefs(child)
  )))];
}

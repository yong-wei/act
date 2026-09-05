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
  buildKnowledgeNodeWeaknessStats,
  DIAGNOSIS_WEAK_MIN_STUDENTS,
  DIAGNOSIS_WEAK_MIN_STUDENT_RATIO,
  DIAGNOSIS_WEAK_PROGRESS_THRESHOLD,
  governedInputSchema,
  weaknessEligibility,
  type DiagnosisNodeWeaknessStats,
  type GovernedDiagnosisInput,
  type GovernedInput,
} from '@/lib/diagnosis-governed-input';

export {
  buildKnowledgeNodeWeaknessStats,
  DIAGNOSIS_WEAK_MIN_STUDENTS,
  DIAGNOSIS_WEAK_MIN_STUDENT_RATIO,
  DIAGNOSIS_WEAK_PROGRESS_THRESHOLD,
  governedInputSchema,
  weaknessEligibility,
} from '@/lib/diagnosis-governed-input';
export type { DiagnosisNodeWeaknessStats, GovernedDiagnosisInput } from '@/lib/diagnosis-governed-input';
import {
  getOrCreateKonlingAgentSession,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { SmartLessonPlanError } from '@/lib/smart-lesson-plan/domain';
import {
  resolveSmartLessonStructuredProvider,
  TextJsonFallbackOutputError,
} from '@/lib/smart-lesson-plan/provider-runtime';
import {
  detectConflictEvidenceInconsistencies,
  diagnosisReportDeclaresConflict,
} from './diagnosis-conflict-evidence';
import { detectOverallSubgroupPseudoConflict, splitDiagnosisClauses } from './diagnosis-pseudo-conflict';

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

export class DiagnosisRiskFlagCoverageError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型把稀疏风险标志的命中数量误述为风险证据覆盖不足。');
    this.name = 'DiagnosisRiskFlagCoverageError';
    this.violations = violations;
  }
}

export class DiagnosisPseudoConflictError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型把班级总体表现与部分学生进度的总体—子群信号误述为证据冲突。');
    this.name = 'DiagnosisPseudoConflictError';
    this.violations = violations;
  }
}

export class DiagnosisConflictEvidenceError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型声明的证据冲突未被引用的作业与测评记录证明。');
    this.name = 'DiagnosisConflictEvidenceError';
    this.violations = violations;
  }
}

export class DiagnosisLimitationCoverageError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('诊断模型在结构化覆盖完整时生成了声称学生证据可能缺失的限制说明。');
    this.name = 'DiagnosisLimitationCoverageError';
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
  targetStudentId?: string | null,
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
    if (!weaknessEligibility(stat, targetStudentId).eligible) {
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

/**
 * 稀疏风险标志覆盖误读校验（Issue #1755）：风险标志是命中集合，
 * 命中数量不得被表述为风险证据覆盖人数或覆盖比例。模型在 summary 或
 * limitations 中把命中数当作覆盖率（如"风险数据仅覆盖 52 名学生"）时，
 * 按模型行为缺陷拒绝重试，不得持久化。只拦截这一类已知缺陷措辞，
 * 不做通用自然语言审查。
 */
const RISK_FLAG_COVERAGE_MISREAD_PATTERN = /风险[^。；\n]{0,40}覆盖[^。；\n]{0,20}(\d|%|名|人|占比)/;

export function enforceRiskFlagCoverageSemantics(reportBody: {
  summary: string;
  limitations: ReadonlyArray<string>;
}) {
  const violations: string[] = [];
  if (RISK_FLAG_COVERAGE_MISREAD_PATTERN.test(reportBody.summary)) {
    violations.push('summary');
  }
  reportBody.limitations.forEach((limitation, index) => {
    if (RISK_FLAG_COVERAGE_MISREAD_PATTERN.test(limitation)) {
      violations.push(`limitations[${index}]`);
    }
  });
  return violations;
}

// 限制×覆盖一致性（Issue #1904）：与 #1755 同哲学，只拦截已知缺陷措辞
// 家族（子群主语 + 数据/证据名词 + 缺失谓词，子句粒度，兼容主谓/动宾
// 两种语序），不做通用自然语言审查。覆盖不完整时该类限制是真实降级
// 原因，一律放行。
const LIMITATION_MISSING_DATA_SUBJECT_PATTERN = /(?:部分|少数|个别|某些)[^。；;\n]{0,16}(?:名)?(?:学生|同学)/;
const LIMITATION_MISSING_DATA_NOUN_PATTERN = /(?:数据|证据|进度|记录|学习行为)/g;
const LIMITATION_MISSING_DATA_VERB_PATTERN = /(?:缺失|缺少|未覆盖|未纳入|不完整|不全)/g;

function clauseClaimsMissingStudentData(clause: string): boolean {
  if (!LIMITATION_MISSING_DATA_SUBJECT_PATTERN.test(clause)) return false;
  const nouns = [...clause.matchAll(LIMITATION_MISSING_DATA_NOUN_PATTERN)];
  const verbs = [...clause.matchAll(LIMITATION_MISSING_DATA_VERB_PATTERN)];
  return nouns.some((noun) => verbs.some((verb) => (
    // 主谓序（数据缺失）：名词后 20 字符内出现缺失谓词；
    // 动宾序（缺少数据）：名词前 8 字符以内紧邻缺失谓词。
    (verb.index >= noun.index && verb.index <= noun.index + noun[0].length + 20)
    || (verb.index + verb[0].length <= noun.index && noun.index - (verb.index + verb[0].length) <= 8)
  )));
}

export interface DiagnosisLimitationCoverageSource {
  sourceCoverage: {
    classMembers?: number;
    includedStudents?: number;
    coverage?: number;
    assignment?: { missingStudents: number } | undefined;
    assessment?: { missingStudents: number } | undefined;
  };
  limitations: ReadonlyArray<string>;
}

export function enforceLimitationCoverageConsistency(reportBody: DiagnosisLimitationCoverageSource) {
  const coverage = reportBody.sourceCoverage;
  // 完整覆盖事实与历史投影 evidenceCoverageComplete 同语义：可选字段缺省
  // 不得当作完整；assignment/assessment 子组缺省（如 benchmark 扁平记录）
  // 时以顶层 coverage 数字为准。
  const coverageComplete = coverage.coverage === 1
    && typeof coverage.classMembers === 'number'
    && typeof coverage.includedStudents === 'number'
    && coverage.includedStudents >= coverage.classMembers
    && (coverage.assignment?.missingStudents ?? 0) === 0
    && (coverage.assessment?.missingStudents ?? 0) === 0;
  if (!coverageComplete) return [];
  const violations: string[] = [];
  reportBody.limitations.forEach((limitation, index) => {
    const contradicts = splitDiagnosisClauses(limitation).some(clauseClaimsMissingStudentData);
    if (contradicts) violations.push(`limitations[${index}]`);
  });
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
  const projected = buildDiagnosisProviderToolResults(governedInput.data, {
    attemptId: input.attemptId,
    targetStudentId: input.targetStudentId,
  });
  if (projected.observedRefs.size === 0) {
    throw new DiagnosisGenerationValidationError('diagnosis-evidence-unavailable');
  }
  const {
    providerToolResults, toolAudit, weaknessStats,
    learnerAliasFor, assignments, assessments, observedRefs,
  } = projected;

  const generated = await generateDiagnosisProviderOutput({
    attemptId: input.attemptId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    evidenceCutoffIso: input.evidenceCutoff.toISOString(),
    generatorVersion: input.generatorVersion,
    governedToolResults: providerToolResults,
    learnerAliasFor,
  });
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
  const calibrationViolations = enforceDiagnosisFindingCalibration(
    reportBody.findings,
    reportBody.confidence,
    reportBody.limitations,
    knowledgeNodeByEvidenceRef,
    weaknessStats,
    governedInput.data.studentIds,
    input.targetStudentId,
  );
  if (calibrationViolations.length > 0) {
    throw new DiagnosisFindingCalibrationError(calibrationViolations);
  }
  // 稀疏风险标志覆盖误读（Issue #1755）：与校准门同语义，模型行为缺陷重试。
  const riskFlagCoverageViolations = enforceRiskFlagCoverageSemantics(reportBody);
  if (riskFlagCoverageViolations.length > 0) {
    throw new DiagnosisRiskFlagCoverageError(riskFlagCoverageViolations);
  }
  // 总体—子群伪冲突（Issue #1872）：班级总体正常与部分学生薄弱学生范围
  // 不同，不得声明为证据冲突；命中按模型行为缺陷拒绝重试，不得持久化。
  const pseudoConflictViolations = detectOverallSubgroupPseudoConflict(reportBody);
  if (pseudoConflictViolations.length > 0) {
    throw new DiagnosisPseudoConflictError(pseudoConflictViolations);
  }
  // 限制×覆盖一致性（Issue #1904）：sourceCoverage 完整时，声称学生证据
  // 可能缺失的假设性限制与结构化事实矛盾，按模型行为缺陷拒绝重试。
  const limitationCoverageViolations = enforceLimitationCoverageConsistency(reportBody);
  if (limitationCoverageViolations.length > 0) {
    throw new DiagnosisLimitationCoverageError(limitationCoverageViolations);
  }
  // 冲突引用语义（Issue #1946）：声明冲突必须由同一学生、14 天时间窗、
  // 方向正确的作业/测评引用证明；命中按模型行为缺陷拒绝重试。
  const conflictEvidenceViolations = detectConflictEvidenceInconsistencies(
    reportBody,
    governedInput.data,
  );
  if (conflictEvidenceViolations.length > 0) {
    throw new DiagnosisConflictEvidenceError(conflictEvidenceViolations);
  }
  if (diagnosisReportDeclaresConflict(reportBody)) {
    reportBody.conflictEvidenceVerified = true;
  }
  return {
    reportBody,
    agentSessionId: agentSession.id,
    providerResponseId: generated.normalizedResponseId,
    toolAudit,
  };
}

const DIAGNOSIS_PROVIDER_SYSTEM_PROMPT_LINES = [
  '你是教师学情诊断生成器，只能依据给定的受治理工具结果生成结构化报告。',
  '所有面向教师的自然语言内容（summary、findings 标题与说明、limitations 说明）必须使用简体中文；不得输出英文分析段落。',
  'findings 中引用 knowledge-progress 证据的知识点发现必须携带与引用证据一致的有效 knowledgeNodeId；总体风险、成绩分布等非知识点发现不需要 knowledgeNodeId。',
  '不得创建输入中不存在的 evidenceRefs；不得推断学生身份或输出原始证据。',
  '无法确定知识节点 ID 时，必须省略 findings[].knowledgeNodeId；不得输出空字符串、null 或编造 ID。',
  '知识点薄弱判定必须锚定绝对弱势证据：绝对弱势指长期未开始（NOT_STARTED）或进度低于 40 且未完成。governedToolResults.knowledgeProgress.nodeWeakness 已按节点给出 weakStudentCount、coveredStudentCount、minimumWeakStudents 与 eligibleForWeaknessFinding 判定结果；知识点薄弱判定只应锚定 eligibleForWeaknessFinding 为 true 的节点，不得自行按聚合进度估算弱势人数。',
  '仅凭班级内相对较低、但仍处于正常范围（已完成或进度不低于 40）的排序位置，不得把节点判为薄弱；"学完但整体测评不理想"等班级整体问题用不带 knowledgeNodeId 的总体发现表达。',
  '全部知识节点均处于正常范围时，findings 应为空或只含非知识点发现，并在 summary 明确说明未发现明确薄弱节点；不得为了生成结论而强制选取最低节点。',
  '作业与测评证据冲突时不得单方面下强结论：写入 limitations 并降低 confidence；知识进度数据缺失影响判定时，必须在 limitations 说明覆盖情况。',
  '证据冲突声明必须满足可比性：只有相同学生范围、相近时间窗内方向相反的证据（如同一批学生作业高分、测评低分）才可声明冲突；「班级/整体/总体表现正常」与「部分/少数/个别学生薄弱」学生范围不同、可以同时成立，绝不可声明为证据冲突，应分别作为总体发现与子群发现呈现。',
  '引用作业与测评声明冲突时，evidenceRefs 必须属于同一学生，或每个被引用学生都同时具备作业与测评；作业 reviewedAt 与测评 completedAt 相差不超过 14 天；分值方向必须支持声明。跨学生误配、同分、方向不符或时间窗不可比不得声明冲突。',
  '逐人结果仅为确定性代表样本；聚合指标和 sourceCoverage 覆盖完整固定证据。',
  'sourceCoverage 覆盖完整（coverage 为 1 且各证据组纳入齐全）时，不得生成「若部分学生数据缺失」等假设性学生证据缺失限制；数据确有缺失时才能在 limitations 声明缺失。',
  '风险标志是稀疏命中集合：governedToolResults.riskFlags.hitSummary.flaggedStudentCount 是当前命中风险的学生数，不是风险数据的覆盖人数；未命中风险的学生不缺少任何证据，不得据此生成“风险数据仅覆盖 N 名学生”或等价覆盖比例限制。',
  '报告摘要不超过 1000 字符，最多 6 条 findings；每条摘要不超过 280 字符。',
  'evidenceRefs 总数不超过 16，每条 finding 最多引用 6 条；不得罗列逐个学生或逐条证据。',
];

/**
 * 生产诊断 system prompt（Issue #1729 review：live 评测复用同一提示词，
 * 候选版本对生产提示词的修改直接进入评测面）。
 */
export function buildDiagnosisProviderSystemPrompt(evidenceCutoffIso: string): string {
  return `${DIAGNOSIS_PROVIDER_SYSTEM_PROMPT_LINES.join('\n')}\nevidenceCutoff 必须严格等于 ${evidenceCutoffIso}。`;
}

/**
 * 生产 provider 调用封装（Issue #1729 review：live 评测复用同一调用协议——
 * 生产 provider schema、deferValidation/fallbackToTextJson 选项、text-JSON
 * 回退校验与超时/空输出转换，保证"评测通过"与"生产生成成功"同构）。
 */
export async function generateDiagnosisProviderOutput(options: {
  attemptId: string;
  classId: string;
  targetStudentId?: string | null;
  evidenceCutoffIso: string;
  generatorVersion: string;
  governedToolResults: ReturnType<typeof buildDiagnosisProviderToolResults>['providerToolResults'];
  learnerAliasFor: (userId: string) => string;
}) {
  const provider = await resolveSmartLessonStructuredProvider();
  let generated;
  try {
    generated = await provider.generate({
      schema: diagnosisProviderReportBodySchema,
      schemaVersion: 'teacher-diagnosis-report-body.v1',
      promptVersion: options.generatorVersion,
      system: buildDiagnosisProviderSystemPrompt(options.evidenceCutoffIso),
      prompt: JSON.stringify({
        scope: options.targetStudentId
          ? { type: 'student', classId: options.classId, learnerAlias: options.learnerAliasFor(options.targetStudentId) }
          : { type: 'class', classId: options.classId },
        evidenceCutoff: options.evidenceCutoffIso,
        governedToolResults: options.governedToolResults,
      }),
      idempotencyKey: options.attemptId,
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
  return generated;
}

/**
 * 生产 provider 工具投影（Issue #1729 review：live 评测复用同一投影链，
 * 含 nodeWeakness 判定与 compact 采样，保证评测输入与生产输入同构）。
 */
export function buildDiagnosisProviderToolResults(
  data: GovernedDiagnosisInput,
  options: { attemptId: string; targetStudentId?: string | null },
) {
  const learnerAliasFor = createReportLearnerAliasResolver(options.attemptId);
  const assignments = projectFrozenAssignments(data, learnerAliasFor);
  const assessments = projectFrozenAssessments(data, learnerAliasFor);
  const riskFlags = projectFrozenRiskFlags(data, learnerAliasFor);
  const competency = options.targetStudentId ? null : projectFrozenCompetency(data);
  const knowledgeProgress = projectFrozenKnowledgeProgress(data, learnerAliasFor);
  const weaknessStats = buildKnowledgeNodeWeaknessStats(data.knowledgeProgress);
  const toolAudit = [
    auditToolResult('get_class_assignment_outcomes', assignments),
    auditToolResult('get_class_assessment_outcomes', assessments),
    auditToolResult('get_student_risk_flags', riskFlags),
    ...(competency ? [auditToolResult('get_class_competency_summary', competency)] : []),
    auditToolResult('get_student_knowledge_progress', knowledgeProgress),
  ];
  const observedRefs = new Set(toolAudit.flatMap((entry) => entry.evidenceRefs));
  const providerToolResults = {
    assignments: compactAssignmentsForProvider(assignments),
    assessments: compactAssessmentsForProvider(assessments),
    riskFlags: compactRiskFlagsForProvider(riskFlags),
    competency: competency ? compactCompetencyForProvider(competency) : null,
    knowledgeProgress: compactKnowledgeProgressForProvider(knowledgeProgress, weaknessStats, options.targetStudentId),
  };
  return { providerToolResults, toolAudit, observedRefs, weaknessStats, learnerAliasFor, assignments, assessments };
}

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
    // 稀疏命中集合（Issue #1755）：风险标志只含当前命中风险的学生，
    // 命中数不是覆盖人数；显式命名字段防止模型按 coverage 语义误读。
    hitSummary: {
      flaggedStudentCount: new Set(flags.map((flag) => flag.learnerAlias)).size,
      flagRecordCount: flags.length,
      diagnosedStudentCount: input.studentIds.length,
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

function compactKnowledgeProgressForProvider(
  projection: ReturnType<typeof projectFrozenKnowledgeProgress>,
  weaknessStats: DiagnosisNodeWeaknessStats,
  targetStudentId?: string | null,
) {
  const grouped = new Map<string, typeof projection.progress>();
  for (const row of projection.progress) {
    const key = `${row.knowledgeNodeId}\u0000${row.status}`;
    const rows = grouped.get(key) ?? [];
    rows.push(row);
    grouped.set(key, rows);
  }
  // 逐节点确定性弱势统计（Issue #1728 review）：进度分组只有聚合值，
  // 模型无法自行数出弱势人数；把资格判定结果一并投影，保证提示词
  // 指令与确定性校准门使用同一输入语义。
  const nodeWeakness = [...weaknessStats.entries()]
    .map(([nodeId, stat]) => {
      const { minimumWeakStudents, eligible } = weaknessEligibility(stat, targetStudentId);
      return {
        knowledgeNodeId: nodeId,
        weakStudentCount: stat.weakStudents.size,
        coveredStudentCount: stat.coveredStudents.size,
        minimumWeakStudents,
        eligibleForWeaknessFinding: eligible,
      };
    })
    .sort((left, right) => left.knowledgeNodeId.localeCompare(right.knowledgeNodeId));
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
    nodeWeakness,
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

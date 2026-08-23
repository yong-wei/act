import { createHash } from 'node:crypto';

import { parseStoredDiagnosisReportBody, type DiagnosisRiskSummary } from '@/lib/diagnosis-persistence';

export const DIAGNOSIS_DELIVERY_PROJECTION_VERSION = 'diagnosis-delivery.v1';
export const TEACHER_DIAGNOSIS_ROLE_VERSION = 'teacher-report.v1';
export const STUDENT_DIAGNOSIS_ROLE_VERSION = 'student-safe-report.v1';

type DeliverySource = {
  id: string;
  scopeType: string;
  scopeId: string;
  classId: string;
  targetUserId: string | null;
  reportBody: unknown;
  riskSummary: unknown;
  evidenceCutoff: Date;
  generatorVersion: string;
  ruleVersion: string | null;
  generationReason: string | null;
  forceReason: string | null;
  generatedAt: Date;
};

export type DiagnosisEvidenceSummary = {
  state: 'available' | 'unavailable';
  total: number;
  sources: Array<{ kind: 'risk' | 'competency' | 'progress'; label: string; count: number }>;
  limitation?: string;
};

export type DiagnosisDeliveryFinding = {
  targetKey: string;
  title: string;
  summary?: string;
  riskType?: 'stagnation' | 'constraint' | 'cross_domain';
  severity?: 'low' | 'medium' | 'high';
  confidence?: 'high' | 'medium' | 'low' | 'unavailable';
  evidence: DiagnosisEvidenceSummary;
  hasPreparationEntry: boolean;
};

export type DiagnosisDeliverySuggestion = {
  targetKey: string;
  source: 'finding' | 'summary';
  text: string;
};

type DiagnosisDeliveryBase = {
  reportId: string;
  projectionVersion: typeof DIAGNOSIS_DELIVERY_PROJECTION_VERSION;
  roleVersion: string;
  audienceUserId: string | null;
  scopeType: 'class' | 'student';
  classId: string;
  targetUserId: string | null;
  title: string;
  summary: string;
  findings: DiagnosisDeliveryFinding[];
  suggestions: DiagnosisDeliverySuggestion[];
  confidence: 'high' | 'medium' | 'low' | 'unavailable';
  limitations: string[];
  evidenceCutoff: string;
  generatedAt: string;
  generatorVersion: string;
  ruleVersion: string | null;
  privacyNotice: string;
};

export type TeacherDiagnosisDeliveryProjection = DiagnosisDeliveryBase & {
  role: 'teacher';
  riskSummary: DiagnosisRiskSummary;
  generationReason: string | null;
  forceReason: string | null;
};

export type StudentDiagnosisDeliveryProjection = DiagnosisDeliveryBase & {
  role: 'student';
};

export type DiagnosisDeliveryProjection =
  | TeacherDiagnosisDeliveryProjection
  | StudentDiagnosisDeliveryProjection;

export class DiagnosisDeliveryProjectionError extends Error {
  constructor(readonly code: 'invalid-report' | 'student-projection-unavailable') {
    super(code);
    this.name = 'DiagnosisDeliveryProjectionError';
  }
}

export function projectTeacherDiagnosisReport(source: DeliverySource): TeacherDiagnosisDeliveryProjection {
  const base = projectBase(source, TEACHER_DIAGNOSIS_ROLE_VERSION, null);
  return {
    ...base,
    role: 'teacher',
    title: source.scopeType === 'student' ? '学生学情诊断报告（教师版）' : '班级学情诊断报告（教师版）',
    riskSummary: parseRiskSummary(source.riskSummary),
    generationReason: source.generationReason,
    forceReason: source.forceReason,
    privacyNotice: '教师内部受控材料；不得包含原始答案、私密对话或隐藏评测内容。',
  };
}

export function projectStudentSafeDiagnosisReport(source: DeliverySource): StudentDiagnosisDeliveryProjection {
  if (source.scopeType !== 'student' || !source.targetUserId || source.scopeId !== source.targetUserId) {
    throw new DiagnosisDeliveryProjectionError('student-projection-unavailable');
  }
  const base = projectBase(source, STUDENT_DIAGNOSIS_ROLE_VERSION, source.targetUserId);
  return {
    ...base,
    findings: base.findings.map((finding) => ({ ...finding, hasPreparationEntry: false })),
    role: 'student',
    title: '个人学情诊断报告',
    privacyNotice: '本报告仅呈现你的个人结论和安全证据摘要，不包含同伴数据或教师内部说明。',
  };
}

export function diagnosisProjectionContentHash(projection: DiagnosisDeliveryProjection) {
  return sha256(canonicalJson(projection));
}

export function diagnosisArtifactIdentity(projection: DiagnosisDeliveryProjection) {
  return sha256(canonicalJson({
    reportId: projection.reportId,
    projectionVersion: projection.projectionVersion,
    roleVersion: projection.roleVersion,
    audienceUserId: projection.audienceUserId ?? '',
  }));
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function projectBase(source: DeliverySource, roleVersion: string, audienceUserId: string | null): DiagnosisDeliveryBase {
  const parsed = parseStoredDiagnosisReportBody(source.reportBody);
  if (!parsed.success || !validDate(source.evidenceCutoff) || !validDate(source.generatedAt)) {
    throw new DiagnosisDeliveryProjectionError('invalid-report');
  }
  return {
    reportId: source.id,
    projectionVersion: DIAGNOSIS_DELIVERY_PROJECTION_VERSION,
    roleVersion,
    audienceUserId,
    scopeType: source.scopeType === 'student' ? 'student' : 'class',
    classId: source.classId,
    targetUserId: source.targetUserId,
    title: '',
    summary: parsed.data.summary,
    findings: parsed.data.findings.map((finding, index) => ({
      targetKey: `finding:${index + 1}`,
      title: finding.title,
      ...(finding.summary ? { summary: finding.summary } : {}),
      ...(finding.riskType ? { riskType: finding.riskType } : {}),
      ...(finding.severity ? { severity: finding.severity } : {}),
      ...(finding.confidence ? { confidence: finding.confidence } : {}),
      evidence: summarizeEvidence(finding.evidenceRefs),
      hasPreparationEntry: Boolean(finding.knowledgeNodeId),
    })),
    suggestions: projectSuggestions(parsed.data.findings),
    confidence: parsed.data.confidence,
    limitations: [...parsed.data.limitations],
    evidenceCutoff: source.evidenceCutoff.toISOString(),
    generatedAt: source.generatedAt.toISOString(),
    generatorVersion: source.generatorVersion,
    ruleVersion: source.ruleVersion,
    privacyNotice: '',
  };
}

function projectSuggestions(
  findings: Array<{ title: string; knowledgeNodeId?: string }>,
): DiagnosisDeliverySuggestion[] {
  if (findings.length === 0) {
    return [{
      targetKey: 'report',
      source: 'summary',
      text: '建议根据当前诊断摘要复核已学内容，并在补充可核验证据后查看新的诊断。',
    }];
  }
  return findings.map((finding, index) => ({
    targetKey: `finding:${index + 1}`,
    source: 'finding' as const,
    text: finding.knowledgeNodeId
      ? `建议围绕“${finding.title}”复核关联知识点，并完成一次针对性练习后查看新的诊断。`
      : `建议围绕“${finding.title}”复核当前学习过程，并补充可核验证据后查看新的诊断。`,
  }));
}

function summarizeEvidence(refs: string[]): DiagnosisEvidenceSummary {
  const counts = { risk: 0, competency: 0, progress: 0 };
  for (const ref of new Set(refs)) {
    if (ref.startsWith('student-risk-flag:')) counts.risk += 1;
    if (ref.startsWith('student-competency-snapshot:')) counts.competency += 1;
    if (ref.startsWith('knowledge-progress:')) counts.progress += 1;
  }
  const sources = [
    { kind: 'risk' as const, label: '受治理风险证据', count: counts.risk },
    { kind: 'competency' as const, label: '能力快照', count: counts.competency },
    { kind: 'progress' as const, label: '知识点学习进度', count: counts.progress },
  ].filter((source) => source.count > 0);
  const total = sources.reduce((sum, source) => sum + source.count, 0);
  return total > 0
    ? { state: 'available', total, sources }
    : { state: 'unavailable', total: 0, sources: [], limitation: '该结论没有可公开下钻的结构化证据摘要。' };
}

function parseRiskSummary(value: unknown): DiagnosisRiskSummary {
  const fallback: DiagnosisRiskSummary = {
    total: 0,
    byType: { stagnation: 0, constraint: 0, cross_domain: 0 },
    bySeverity: { low: 0, medium: 0, high: 0 },
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<DiagnosisRiskSummary>;
  return {
    total: safeCount(candidate.total),
    byType: {
      stagnation: safeCount(candidate.byType?.stagnation),
      constraint: safeCount(candidate.byType?.constraint),
      cross_domain: safeCount(candidate.byType?.cross_domain),
    },
    bySeverity: {
      low: safeCount(candidate.bySeverity?.low),
      medium: safeCount(candidate.bySeverity?.medium),
      high: safeCount(candidate.bySeverity?.high),
    },
  };
}

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, sortValue(child)]));
}

function validDate(value: Date) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

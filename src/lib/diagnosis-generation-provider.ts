import { type Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  DiagnosisGenerationOutputValidationError,
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
import { resolveSmartLessonStructuredProvider } from '@/lib/smart-lesson-plan/provider-runtime';

const DIAGNOSIS_TOOLS = [
  'get_class_assignment_outcomes',
  'get_class_assessment_outcomes',
  'get_student_risk_flags',
  'get_class_competency_summary',
  'get_student_knowledge_progress',
] as const;

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
    totalPoints: z.number(),
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
  const assignments = projectFrozenAssignments(governedInput.data);
  const assessments = projectFrozenAssessments(governedInput.data);
  const riskFlags = projectFrozenRiskFlags(governedInput.data);
  const competency = input.targetStudentId ? null : projectFrozenCompetency(governedInput.data);
  const knowledgeProgress = projectFrozenKnowledgeProgress(governedInput.data);
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

  const provider = await resolveSmartLessonStructuredProvider();
  const generated = await provider.generate({
    schema: diagnosisReportBodySchema,
    schemaVersion: 'teacher-diagnosis-report-body.v1',
    promptVersion: input.generatorVersion,
    system: [
      '你是教师学情诊断生成器，只能依据给定的受治理工具结果生成结构化报告。',
      '不得创建输入中不存在的 evidenceRefs；不得推断学生身份或输出原始证据。',
      '无法确定知识节点 ID 时，必须省略 findings[].knowledgeNodeId；不得输出空字符串、null 或编造 ID。',
      `evidenceCutoff 必须严格等于 ${input.evidenceCutoff.toISOString()}。`,
    ].join('\n'),
    prompt: JSON.stringify({
      scope: input.targetStudentId
        ? { type: 'student', classId: input.classId, studentId: input.targetStudentId }
        : { type: 'class', classId: input.classId },
      evidenceCutoff: input.evidenceCutoff.toISOString(),
      governedToolResults: { assignments, assessments, riskFlags, competency, knowledgeProgress },
    }),
    idempotencyKey: input.attemptId,
    maxOutputTokens: 8_000,
    deferValidation: true,
    timeoutMs: 120_000,
  });
  const parsedReportBody = diagnosisReportBodySchema.safeParse(generated.output);
  if (!parsedReportBody.success) {
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
  const citedRefs = [
    ...reportBody.evidenceRefs,
    ...reportBody.findings.flatMap((finding) => finding.evidenceRefs),
  ];
  if (citedRefs.some((ref) => !observedRefs.has(ref))) {
    throw new DiagnosisGenerationValidationError('diagnosis-unobserved-evidence-reference');
  }
  return {
    reportBody,
    agentSessionId: agentSession.id,
    providerResponseId: generated.normalizedResponseId,
    toolAudit,
  };
}

type GovernedInput = z.infer<typeof governedInputSchema>;

function projectFrozenAssignments(input: GovernedInput) {
  const assignments = (input.assignmentSubmissions ?? []).map((row) => ({
    studentId: row.userId,
    assignmentRevisionId: row.assignmentRevisionId,
    contentHash: row.contentHash,
    score: row.score,
    totalPoints: row.totalPoints,
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

function projectFrozenAssessments(input: GovernedInput) {
  const assessments = (input.assessmentSessions ?? []).map((row) => ({
    studentId: row.userId,
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
  rows: Array<{ studentId: string; score: number }>,
) {
  const includedStudents = new Set(rows.map((row) => row.studentId)).size;
  return {
    availability: 'available' as const,
    includedStudents,
    missingStudents: Math.max(studentIds.length - includedStudents, 0),
    evidenceCount: rows.length,
    scoredCount: rows.filter((row) => Number.isFinite(row.score)).length,
  };
}

function projectFrozenRiskFlags(input: GovernedInput) {
  const flags = input.riskFlags.map((row) => ({
    studentId: row.userId,
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
    students: input.studentIds,
    flags,
    evidenceRefs: flags.flatMap((flag) => flag.evidenceRefs),
    sourceCoverage: {
      classMembers: input.studentIds.length,
      includedStudents: new Set(flags.map((flag) => flag.studentId)).size,
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

function projectFrozenKnowledgeProgress(input: GovernedInput) {
  const progress = input.knowledgeProgress.map((row) => ({
    studentId: row.userId,
    knowledgeNodeId: row.nodeId,
    status: row.status,
    progress: row.progress,
    timeSpentSeconds: row.timeSpent,
    lastVisitedAt: row.lastVisited,
    evidenceRefs: [`knowledge-progress:${row.id}`],
  }));
  return {
    classId: input.classId,
    students: input.studentIds,
    progress,
    evidenceRefs: progress.flatMap((row) => row.evidenceRefs),
    sourceCoverage: {
      classMembers: input.studentIds.length,
      includedStudents: new Set(progress.map((row) => row.studentId)).size,
      progressRows: progress.length,
    },
    confidence: progress.length > 0 ? 'medium' : 'unavailable',
    limitations: progress.length > 0 ? [] : ['no-knowledge-progress-evidence'],
    privacyClass: 'teacher-scoped',
  };
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

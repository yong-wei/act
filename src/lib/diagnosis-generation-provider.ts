import type { PrismaClient } from '@prisma/client';

import {
  diagnosisReportBodySchema,
  type DiagnosisReportBody,
} from '@/lib/diagnosis-persistence';
import {
  buildKonlingRuntimeContext,
  buildKonlingToolRuntime,
  getOrCreateKonlingAgentSession,
  verifyKonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { resolveSmartLessonStructuredProvider } from '@/lib/smart-lesson-plan/provider-runtime';

const DIAGNOSIS_TOOLS = [
  'get_student_risk_flags',
  'get_class_competency_summary',
  'get_student_knowledge_progress',
] as const;

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
  },
) {
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
  const context = await buildKonlingRuntimeContext(db, {
    authenticatedUserId: input.teacherId,
    role: 'TEACHER',
    targetUserId: scope.targetUserId,
    classId: input.classId,
    courseId: scope.courseId,
    pageId: scope.pageId,
    teachingAssistantModeId: 'teacher-diagnosis',
    currentUserQuery: '生成受治理的教师学情诊断报告',
    evidenceCutoff: input.evidenceCutoff.toISOString(),
    now: input.evidenceCutoff,
  });
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
  const tools = buildKonlingToolRuntime({
    db,
    scope,
    context: { ...context, permittedTools: [...DIAGNOSIS_TOOLS] },
    agentSessionId: agentSession.id,
    permittedTools: [...DIAGNOSIS_TOOLS],
    evidenceCutoff: input.evidenceCutoff,
  });
  const studentArgs = input.targetStudentId ? { studentId: input.targetStudentId } : {};
  const riskFlags = await tools.getStudentRiskFlags(studentArgs);
  const competency = input.targetStudentId ? null : await tools.getClassCompetencySummary({});
  const knowledgeProgress = await tools.getStudentKnowledgeProgress(studentArgs);
  const toolAudit = [
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
      `evidenceCutoff 必须严格等于 ${input.evidenceCutoff.toISOString()}。`,
    ].join('\n'),
    prompt: JSON.stringify({
      scope: input.targetStudentId
        ? { type: 'student', classId: input.classId, studentId: input.targetStudentId }
        : { type: 'class', classId: input.classId },
      evidenceCutoff: input.evidenceCutoff.toISOString(),
      governedToolResults: { riskFlags, competency, knowledgeProgress },
    }),
    idempotencyKey: input.attemptId,
    maxOutputTokens: 8_000,
    timeoutMs: 120_000,
  });
  const reportBody = diagnosisReportBodySchema.parse(generated.output) as DiagnosisReportBody;
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

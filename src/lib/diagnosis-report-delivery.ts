import 'server-only';

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import {
  DIAGNOSIS_DELIVERY_PROJECTION_VERSION,
  DiagnosisDeliveryProjectionError,
  STUDENT_DIAGNOSIS_ROLE_VERSION,
  TEACHER_DIAGNOSIS_ROLE_VERSION,
  projectStudentSafeDiagnosisReport,
  projectTeacherDiagnosisReport,
  type DiagnosisDeliveryProjection,
} from '@/lib/diagnosis-report-delivery-projection';
import { renderDiagnosisReportPdf } from '@/lib/diagnosis-report-pdf';
import { parseStoredDiagnosisReportBody } from '@/lib/diagnosis-persistence';

export const diagnosisDispositionInputSchema = z.object({
  targetKind: z.enum(['report', 'finding']),
  targetKey: z.string().trim().min(1).max(200),
  action: z.enum(['viewed', 'pending', 'intervention-arranged', 'completed']),
  actionRef: z.string().trim().min(1).max(500).nullable().optional(),
  idempotencyKey: z.string().uuid(),
}).strict();

export type DiagnosisDispositionInput = z.output<typeof diagnosisDispositionInputSchema>;

export type DiagnosisDeliveryAction = {
  kind: 'student' | 'preparation';
  label: string;
  href: string;
  targetKey: string;
};

export class DiagnosisDeliveryError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 500,
    readonly code: string,
  ) {
    super(code);
    this.name = 'DiagnosisDeliveryError';
  }
}

export async function readTeacherDiagnosisDelivery(input: {
  teacherId: string;
  classId: string;
  reportId: string;
  role: 'teacher' | 'student';
}) {
  const report = await loadTeacherReport(input);
  const projection = project(input.role, report);
  if (input.role === 'student') {
    return { projection, actions: [], dispositionEvents: [] };
  }
  const [actions, dispositionEvents] = await Promise.all([
    resolveTeacherDeliveryActions(report),
    prisma.diagnosisReportDispositionEvent.findMany({
      where: { reportId: report.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        targetKind: true,
        targetKey: true,
        action: true,
        actionRef: true,
        result: true,
        createdAt: true,
      },
    }),
  ]);
  return { projection, actions, dispositionEvents };
}

export async function readStudentDiagnosisDelivery(input: { studentId: string; reportId: string }) {
  const report = await prisma.diagnosisReport.findFirst({
    where: {
      id: input.reportId,
      scopeType: 'student',
      scopeId: input.studentId,
      targetUserId: input.studentId,
    },
    select: reportSelect,
  });
  if (!report) throw new DiagnosisDeliveryError(404, 'diagnosis-delivery-not-found');
  return { projection: projectStudentSafeDiagnosisReport(report), actions: [], dispositionEvents: [] };
}

export async function exportTeacherDiagnosisPdf(input: {
  teacherId: string;
  classId: string;
  reportId: string;
  role: 'teacher' | 'student';
}) {
  const report = await loadTeacherReport(input);
  return exportProjection(project(input.role, report), input.teacherId);
}

export async function exportStudentDiagnosisPdf(input: { studentId: string; reportId: string }) {
  const { projection } = await readStudentDiagnosisDelivery(input);
  return exportProjection(projection, input.studentId);
}

export async function recordDiagnosisDisposition(input: {
  teacherId: string;
  classId: string;
  reportId: string;
  disposition: DiagnosisDispositionInput;
}) {
  const parsed = diagnosisDispositionInputSchema.parse(input.disposition);
  const report = await loadTeacherReport(input);
  const projection = projectTeacherDiagnosisReport(report);
  if (parsed.targetKind === 'report' && parsed.targetKey !== 'report') {
    throw new DiagnosisDeliveryError(400, 'diagnosis-disposition-target-invalid');
  }
  if (parsed.targetKind === 'finding' && !projection.findings.some((finding) => finding.targetKey === parsed.targetKey)) {
    throw new DiagnosisDeliveryError(400, 'diagnosis-disposition-target-invalid');
  }
  const idempotencyWhere = {
    reportId_actorId_idempotencyKey: {
      reportId: report.id,
      actorId: input.teacherId,
      idempotencyKey: parsed.idempotencyKey,
    },
  };
  // 同键重放先于动作引用校验：历史事件引用的动作可能已被移除（如 remediation 入口下线），
  // 幂等重放必须返回既有事件而不是 403。
  const existing = await prisma.diagnosisReportDispositionEvent.findUnique({
    where: idempotencyWhere,
    select: {
      id: true,
      targetKind: true,
      targetKey: true,
      action: true,
      actionRef: true,
      result: true,
      idempotencyKey: true,
      createdAt: true,
    },
  });
  if (existing) {
    if (existing.targetKind !== parsed.targetKind
      || existing.targetKey !== parsed.targetKey
      || existing.action !== parsed.action
      || existing.actionRef !== (parsed.actionRef ?? null)) {
      throw new DiagnosisDeliveryError(409, 'diagnosis-disposition-idempotency-conflict');
    }
    const { idempotencyKey, ...publicEvent } = existing;
    void idempotencyKey;
    return publicEvent;
  }
  if (parsed.action === 'intervention-arranged') {
    if (!parsed.actionRef) throw new DiagnosisDeliveryError(400, 'diagnosis-disposition-action-ref-required');
    const actions = resolveTeacherDeliveryActions(report);
    if (!actions.some((action) => action.href === parsed.actionRef && action.targetKey === parsed.targetKey)) {
      throw new DiagnosisDeliveryError(403, 'diagnosis-disposition-action-ref-forbidden');
    }
  } else if (parsed.actionRef) {
    throw new DiagnosisDeliveryError(400, 'diagnosis-disposition-action-ref-not-allowed');
  }
  const event = await prisma.diagnosisReportDispositionEvent.upsert({
    where: idempotencyWhere,
    update: {},
    create: {
      reportId: report.id,
      actorId: input.teacherId,
      targetKind: parsed.targetKind,
      targetKey: parsed.targetKey,
      action: parsed.action,
      actionRef: parsed.actionRef ?? null,
      idempotencyKey: parsed.idempotencyKey,
    },
    select: {
      id: true,
      targetKind: true,
      targetKey: true,
      action: true,
      actionRef: true,
      result: true,
      idempotencyKey: true,
      createdAt: true,
    },
  });
  if (event.targetKind !== parsed.targetKind
    || event.targetKey !== parsed.targetKey
    || event.action !== parsed.action
    || event.actionRef !== (parsed.actionRef ?? null)) {
    throw new DiagnosisDeliveryError(409, 'diagnosis-disposition-idempotency-conflict');
  }
  const { idempotencyKey, ...publicEvent } = event;
  void idempotencyKey;
  return publicEvent;
}

async function loadTeacherReport(input: { teacherId: string; classId: string; reportId: string }) {
  const report = await prisma.diagnosisReport.findFirst({
    where: {
      id: input.reportId,
      classId: input.classId,
      class: { teacherId: input.teacherId },
    },
    select: reportSelect,
  });
  if (!report) throw new DiagnosisDeliveryError(404, 'diagnosis-delivery-not-found');
  if (report.targetUserId) {
    const member = await prisma.studentProfile.findFirst({
      where: { classId: report.classId, userId: report.targetUserId },
      select: { id: true },
    });
    if (!member) throw new DiagnosisDeliveryError(403, 'diagnosis-delivery-student-not-current');
  }
  return report;
}

function project(role: 'teacher' | 'student', report: Awaited<ReturnType<typeof loadTeacherReport>>) {
  try {
    return role === 'student'
      ? projectStudentSafeDiagnosisReport(report)
      : projectTeacherDiagnosisReport(report);
  } catch (error) {
    if (error instanceof DiagnosisDeliveryProjectionError) {
      throw new DiagnosisDeliveryError(409, error.code);
    }
    throw error;
  }
}

async function exportProjection(projection: DiagnosisDeliveryProjection, actorId: string) {
  const generated = await renderDiagnosisReportPdf(projection);
  const audienceUserId = projection.audienceUserId ?? '';
  const artifact = await prisma.diagnosisReportExportArtifact.upsert({
    where: {
      reportId_projectionVersion_roleVersion_audienceUserId: {
        reportId: projection.reportId,
        projectionVersion: DIAGNOSIS_DELIVERY_PROJECTION_VERSION,
        roleVersion: projection.roleVersion,
        audienceUserId,
      },
    },
    update: {},
    create: {
      reportId: projection.reportId,
      projectionVersion: DIAGNOSIS_DELIVERY_PROJECTION_VERSION,
      roleVersion: projection.roleVersion,
      audienceUserId,
      contentHash: generated.contentHash,
      artifactHash: generated.artifactHash,
      artifactBytes: Uint8Array.from(generated.bytes),
      artifactSizeBytes: generated.bytes.byteLength,
      pageCount: generated.pageCount,
      createdById: actorId,
    },
  });
  if (artifact.contentHash !== generated.contentHash) {
    throw new DiagnosisDeliveryError(409, 'diagnosis-delivery-artifact-content-drift');
  }
  await prisma.diagnosisReportExportEvent.create({ data: { artifactId: artifact.id, actorId } });
  return {
    artifactId: artifact.id,
    bytes: new Uint8Array(artifact.artifactBytes),
    artifactHash: artifact.artifactHash,
    contentHash: artifact.contentHash,
    roleVersion: artifact.roleVersion,
  };
}

function resolveTeacherDeliveryActions(
  report: Awaited<ReturnType<typeof loadTeacherReport>>,
): DiagnosisDeliveryAction[] {
  const parsedBody = parseStoredDiagnosisReportBody(report.reportBody);
  if (!parsedBody.success) throw new DiagnosisDeliveryError(409, 'invalid-report');
  const actions: DiagnosisDeliveryAction[] = [];
  actions.push({
    kind: 'preparation',
    label: '进入备课工作台',
    href: '/teacher/smart-prep',
    targetKey: 'report',
  });
  if (report.targetUserId) {
    actions.push({
      kind: 'student',
      label: '查看学生详情',
      href: `/teacher/classes/${encodeURIComponent(report.classId)}/students/${encodeURIComponent(report.targetUserId)}`,
      targetKey: 'report',
    });
  }
  parsedBody.data.findings.forEach((finding, index) => {
    if (!finding.knowledgeNodeId) return;
    actions.push({
      kind: 'preparation',
      label: '进入备课工作台',
      href: '/teacher/smart-prep',
      targetKey: `finding:${index + 1}`,
    });
  });
  return actions;
}

const reportSelect = {
  id: true,
  scopeType: true,
  scopeId: true,
  classId: true,
  targetUserId: true,
  reportBody: true,
  riskSummary: true,
  evidenceCutoff: true,
  generatorVersion: true,
  ruleVersion: true,
  generationReason: true,
  forceReason: true,
  generatedAt: true,
} as const;

export const DIAGNOSIS_DELIVERY_ROLE_VERSIONS = {
  teacher: TEACHER_DIAGNOSIS_ROLE_VERSION,
  student: STUDENT_DIAGNOSIS_ROLE_VERSION,
} as const;

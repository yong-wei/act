import { prisma } from '@/lib/prisma';
import { buildDiagnosisPrepLink } from '@/lib/diagnosis-prep-link';
import { z } from 'zod';

export const diagnosisReportBodySchema = z.object({
  summary: z.string().trim().min(1).max(20_000),
  findings: z.array(z.record(z.string(), z.unknown())).default([]),
  evidenceRefs: z.array(z.string().trim().min(1).max(500)).min(1).max(500),
  evidenceCutoff: z.string().datetime({ offset: true }),
  sourceCoverage: z.record(z.string(), z.unknown()),
  confidence: z.enum(['high', 'medium', 'low', 'unavailable']),
  limitations: z.array(z.string().trim().min(1).max(500)).default([]),
}).passthrough();

export interface DiagnosisPersistenceDb {
  class: {
    findUnique(args: Record<string, unknown>): Promise<{
      id: string;
      teacherId: string;
      isActive: boolean;
    } | null>;
  };
  studentProfile: {
    findFirst(args: Record<string, unknown>): Promise<{ userId: string } | null>;
  };
  diagnosisReport: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findMany(args: Record<string, unknown>): Promise<unknown[]>;
  };
}

export class DiagnosisReportScopeError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = 'DiagnosisReportScopeError';
  }
}

const FORBIDDEN_REPORT_KEYS = new Set([
  'rawAnswer',
  'answerBody',
  'eventPayload',
  'evidenceJson',
  'privateDialogue',
  'submissionBody',
  'parserOutput',
  'localPath',
]);

function assertNoRawDiagnosisPayload(value: unknown, path = 'reportBody') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawDiagnosisPayload(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_REPORT_KEYS.has(key)) {
      throw new DiagnosisReportScopeError(400, `${path}.${key} is not permitted in a diagnosis report`);
    }
    assertNoRawDiagnosisPayload(nested, `${path}.${key}`);
  }
}

async function assertTeacherClassScope(
  db: DiagnosisPersistenceDb,
  input: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    requireActive?: boolean;
  },
) {
  const classRow = await db.class.findUnique({
    where: { id: input.classId },
    select: { id: true, teacherId: true, isActive: true },
  });
  if (!classRow) throw new DiagnosisReportScopeError(404, 'class-not-found');
  if (classRow.teacherId !== input.teacherId) {
    throw new DiagnosisReportScopeError(403, 'diagnosis-class-forbidden');
  }
  if (input.requireActive && !classRow.isActive) {
    throw new DiagnosisReportScopeError(409, 'diagnosis-class-inactive');
  }
  if (input.targetStudentId) {
    const member = await db.studentProfile.findFirst({
      where: {
        userId: input.targetStudentId,
        classId: input.classId,
      },
      select: { userId: true },
    });
    if (!member) throw new DiagnosisReportScopeError(403, 'diagnosis-student-not-in-class');
  }
}

export async function persistDiagnosisReport(
  params: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    reportBody: z.input<typeof diagnosisReportBodySchema>;
    riskSummary?: Record<string, unknown> | null;
    generatorVersion?: string;
  },
  db: DiagnosisPersistenceDb = prisma as unknown as DiagnosisPersistenceDb,
) {
  await assertTeacherClassScope(db, {
    teacherId: params.teacherId,
    classId: params.classId,
    targetStudentId: params.targetStudentId,
    requireActive: true,
  });
  const parsedReportBody = diagnosisReportBodySchema.parse(params.reportBody);
  const reportBody = {
    ...parsedReportBody,
    findings: parsedReportBody.findings.map((finding) => {
      const knowledgeNodeId = typeof finding.knowledgeNodeId === 'string'
        ? finding.knowledgeNodeId.trim()
        : '';
      return knowledgeNodeId
        ? {
            ...finding,
            prepLink: buildDiagnosisPrepLink(knowledgeNodeId, params.classId),
          }
        : finding;
    }),
  };
  assertNoRawDiagnosisPayload(reportBody);
  assertNoRawDiagnosisPayload(params.riskSummary, 'riskSummary');

  const scopeType = params.targetStudentId ? 'student' : 'class';
  const scopeId = params.targetStudentId ?? params.classId;
  return db.diagnosisReport.create({
    data: {
      scopeType,
      scopeId,
      classId: params.classId,
      userId: params.teacherId,
      targetUserId: params.targetStudentId ?? null,
      reportBody,
      riskSummary: params.riskSummary ?? undefined,
      evidenceCutoff: new Date(reportBody.evidenceCutoff),
      generatorVersion: params.generatorVersion ?? 'teacher-diagnosis.v1',
    },
  });
}

export async function readDiagnosisReports(
  params: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    limit?: number;
  },
  db: DiagnosisPersistenceDb = prisma as unknown as DiagnosisPersistenceDb,
) {
  await assertTeacherClassScope(db, {
    teacherId: params.teacherId,
    classId: params.classId,
    targetStudentId: params.targetStudentId,
  });
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  return db.diagnosisReport.findMany({
    where: {
      classId: params.classId,
      ...(params.targetStudentId
        ? { targetUserId: params.targetStudentId }
        : { targetUserId: null }),
    },
    orderBy: { generatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      scopeType: true,
      scopeId: true,
      classId: true,
      targetUserId: true,
      reportBody: true,
      riskSummary: true,
      evidenceCutoff: true,
      generatorVersion: true,
      generatedAt: true,
    },
  });
}

import { prisma } from '@/lib/prisma';
import { buildDiagnosisPrepLink } from '@/lib/diagnosis-prep-link';
import { z } from 'zod';

const diagnosisEvidenceRefSchema = z.string()
  .trim()
  .min(1)
  .max(500)
  .regex(
    /^(student-risk-flag|student-competency-snapshot|knowledge-progress):[A-Za-z0-9._:-]+$/,
    'diagnosis evidence reference uses an unsupported source',
  );

const diagnosisFindingSchema = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(2_000).optional(),
  knowledgeNodeId: z.string().trim().min(1).max(200).optional(),
  riskType: z.enum(['stagnation', 'constraint', 'cross_domain']).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  evidenceRefs: z.array(diagnosisEvidenceRefSchema).max(100).default([]),
  confidence: z.enum(['high', 'medium', 'low', 'unavailable']).optional(),
}).strict();

const diagnosisSourceCoverageSchema = z.object({
  classMembers: z.number().int().nonnegative().optional(),
  includedStudents: z.number().int().nonnegative().optional(),
  progressRows: z.number().int().nonnegative().optional(),
  coverage: z.number().min(0).max(1).optional(),
}).strict().refine(
  (coverage) => Object.keys(coverage).length > 0,
  'source coverage must contain at least one governed metric',
);

export const diagnosisReportBodySchema = z.object({
  summary: z.string().trim().min(1).max(20_000),
  findings: z.array(diagnosisFindingSchema).max(500).default([]),
  evidenceRefs: z.array(diagnosisEvidenceRefSchema).min(1).max(500),
  evidenceCutoff: z.string().datetime({ offset: true }),
  sourceCoverage: diagnosisSourceCoverageSchema,
  confidence: z.enum(['high', 'medium', 'low', 'unavailable']),
  limitations: z.array(z.string().trim().min(1).max(500)).default([]),
}).strict();

export const diagnosisReportWriteSchema = z.object({
  targetStudentId: z.string().trim().min(1).max(200).nullable().optional(),
  reportBody: diagnosisReportBodySchema,
}).strict();

export const DIAGNOSIS_REPORT_GENERATOR_VERSION = 'teacher-diagnosis.v1';

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

function buildRiskSummary(findings: z.output<typeof diagnosisFindingSchema>[]) {
  const byType = {
    stagnation: 0,
    constraint: 0,
    cross_domain: 0,
  };
  const bySeverity = {
    low: 0,
    medium: 0,
    high: 0,
  };
  let total = 0;

  for (const finding of findings) {
    if (!finding.riskType) continue;
    byType[finding.riskType] += 1;
    if (finding.severity) bySeverity[finding.severity] += 1;
    total += 1;
  }
  return { total, byType, bySeverity };
}

export async function persistDiagnosisReport(
  params: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    reportBody: z.input<typeof diagnosisReportBodySchema>;
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
  const riskSummary = buildRiskSummary(parsedReportBody.findings);

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
      riskSummary,
      evidenceCutoff: new Date(reportBody.evidenceCutoff),
      generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
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

import { prisma } from '@/lib/prisma';
import { buildDiagnosisPrepLink } from '@/lib/diagnosis-prep-link';
import { CURRENT_RISK_FLAG_TYPES } from '@/lib/risk-scanner';
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

export type DiagnosisReportFindingInput = z.output<typeof diagnosisFindingSchema>;
export type DiagnosisReportFinding = DiagnosisReportFindingInput & {
  prepLink?: string;
};

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

export type DiagnosisReportBody = Omit<z.output<typeof diagnosisReportBodySchema>, 'findings'> & {
  findings: DiagnosisReportFinding[];
};

export interface DiagnosisRiskSummary {
  total: number;
  byType: {
    stagnation: number;
    constraint: number;
    cross_domain: number;
  };
  bySeverity: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface DiagnosisReportReadModel {
  id: string;
  scopeType: 'class' | 'student';
  scopeId: string;
  classId: string;
  targetUserId: string | null;
  reportBody: DiagnosisReportBody;
  riskSummary: DiagnosisRiskSummary;
  evidenceCutoff: Date;
  generatorVersion: string;
  generatedAt: Date;
}

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
    findMany(args: Record<string, unknown>): Promise<Array<{ userId: string }>>;
  };
  studentRiskFlag: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      userId: string;
      flagType: string;
      evidenceObservedAt: Date;
    }>>;
  };
  studentCompetencySnapshot: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      userId: string;
      snapshotAt: Date;
    }>>;
  };
  knowledgeProgress: {
    findMany(args: Record<string, unknown>): Promise<Array<{
      id: string;
      userId: string;
      lastVisited: Date;
    }>>;
  };
  diagnosisReport: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findMany(args: Record<string, unknown>): Promise<DiagnosisReportReadModel[]>;
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

export async function assertTeacherClassScope(
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

type DiagnosisEvidenceSource =
  | 'student-risk-flag'
  | 'student-competency-snapshot'
  | 'knowledge-progress';

interface DiagnosisEvidenceRow {
  ref: string;
  userId: string;
  observedAt: Date;
}

function parseEvidenceRef(ref: string) {
  const separator = ref.indexOf(':');
  return {
    source: ref.slice(0, separator) as DiagnosisEvidenceSource,
    id: ref.slice(separator + 1),
  };
}

async function assertEvidenceScope(
  db: DiagnosisPersistenceDb,
  input: {
    classId: string;
    targetStudentId?: string | null;
    evidenceCutoff: Date;
    evidenceRefs: string[];
  },
) {
  const refsBySource = new Map<DiagnosisEvidenceSource, Set<string>>([
    ['student-risk-flag', new Set()],
    ['student-competency-snapshot', new Set()],
    ['knowledge-progress', new Set()],
  ]);
  for (const ref of new Set(input.evidenceRefs)) {
    const parsed = parseEvidenceRef(ref);
    refsBySource.get(parsed.source)?.add(parsed.id);
  }

  const riskFlagIds = [...refsBySource.get('student-risk-flag')!];
  const competencySnapshotIds = [...refsBySource.get('student-competency-snapshot')!];
  const knowledgeProgressIds = [...refsBySource.get('knowledge-progress')!];
  const [riskFlags, competencySnapshots, knowledgeProgressRows] = await Promise.all([
    riskFlagIds.length === 0
      ? []
      : db.studentRiskFlag.findMany({
          where: {
            id: { in: riskFlagIds },
            flagType: { in: [...CURRENT_RISK_FLAG_TYPES] },
          },
          select: {
            id: true,
            userId: true,
            flagType: true,
            evidenceObservedAt: true,
          },
        }),
    competencySnapshotIds.length === 0
      ? []
      : db.studentCompetencySnapshot.findMany({
          where: { id: { in: competencySnapshotIds } },
          select: { id: true, userId: true, snapshotAt: true },
        }),
    knowledgeProgressIds.length === 0
      ? []
      : db.knowledgeProgress.findMany({
          where: { id: { in: knowledgeProgressIds } },
          select: { id: true, userId: true, lastVisited: true },
        }),
  ]);
  const currentRiskTypes = new Set<string>(CURRENT_RISK_FLAG_TYPES);
  if (riskFlags.some((row) => !currentRiskTypes.has(row.flagType))) {
    throw new DiagnosisReportScopeError(400, 'diagnosis-evidence-unsupported-risk-type');
  }
  const evidenceRows: DiagnosisEvidenceRow[] = [
    ...riskFlags.map((row) => ({
      ref: `student-risk-flag:${row.id}`,
      userId: row.userId,
      observedAt: row.evidenceObservedAt,
    })),
    ...competencySnapshots.map((row) => ({
      ref: `student-competency-snapshot:${row.id}`,
      userId: row.userId,
      observedAt: row.snapshotAt,
    })),
    ...knowledgeProgressRows.map((row) => ({
      ref: `knowledge-progress:${row.id}`,
      userId: row.userId,
      observedAt: row.lastVisited,
    })),
  ];
  const resolvedRefs = new Set(evidenceRows.map((row) => row.ref));
  const requestedRefs = new Set(input.evidenceRefs);
  if (resolvedRefs.size !== requestedRefs.size
    || [...requestedRefs].some((ref) => !resolvedRefs.has(ref))) {
    throw new DiagnosisReportScopeError(400, 'diagnosis-evidence-not-found');
  }

  for (const row of evidenceRows) {
    if (!(row.observedAt instanceof Date)
      || !Number.isFinite(row.observedAt.getTime())
      || row.observedAt > input.evidenceCutoff) {
      throw new DiagnosisReportScopeError(400, 'diagnosis-evidence-after-cutoff');
    }
    if (input.targetStudentId && row.userId !== input.targetStudentId) {
      throw new DiagnosisReportScopeError(403, 'diagnosis-evidence-outside-target');
    }
  }

  if (!input.targetStudentId) {
    const evidenceUserIds = [...new Set(evidenceRows.map((row) => row.userId))];
    const members = await db.studentProfile.findMany({
      where: {
        classId: input.classId,
        userId: { in: evidenceUserIds },
      },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((member) => member.userId));
    if (evidenceUserIds.some((userId) => !memberIds.has(userId))) {
      throw new DiagnosisReportScopeError(403, 'diagnosis-evidence-outside-class');
    }
  }
}

export async function persistDiagnosisReport(
  params: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    reportBody: z.input<typeof diagnosisReportBodySchema>;
    generationJobId?: string | null;
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
  const evidenceCutoff = new Date(parsedReportBody.evidenceCutoff);
  await assertEvidenceScope(db, {
    classId: params.classId,
    targetStudentId: params.targetStudentId,
    evidenceCutoff,
    evidenceRefs: [
      ...parsedReportBody.evidenceRefs,
      ...parsedReportBody.findings.flatMap((finding) => finding.evidenceRefs),
    ],
  });
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
      evidenceCutoff,
      generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      generationJobId: params.generationJobId ?? null,
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

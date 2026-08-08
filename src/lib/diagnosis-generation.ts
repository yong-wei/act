import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  assertTeacherClassScope,
  DIAGNOSIS_REPORT_GENERATOR_VERSION,
  DiagnosisReportScopeError,
  persistDiagnosisReport,
  type DiagnosisReportBody,
} from '@/lib/diagnosis-persistence';

export const diagnosisGenerationRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  targetStudentId: z.string().trim().min(1).max(200).optional(),
}).strict();

export const diagnosisGenerationRetrySchema = z.object({
  action: z.literal('retry'),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export class DiagnosisGenerationError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 503,
  ) {
    super(code);
    this.name = 'DiagnosisGenerationError';
  }
}

const publicJobSelect = {
  id: true,
  classId: true,
  targetUserId: true,
  scopeType: true,
  scopeId: true,
  state: true,
  evidenceCutoff: true,
  generatorVersion: true,
  failureCode: true,
  failureMessage: true,
  retryable: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  report: { select: { id: true } },
} satisfies Prisma.DiagnosisGenerationJobSelect;

type PublicJobRow = Prisma.DiagnosisGenerationJobGetPayload<{ select: typeof publicJobSelect }>;

export function projectDiagnosisGenerationJob(job: PublicJobRow) {
  return {
    id: job.id,
    classId: job.classId,
    targetStudentId: job.targetUserId,
    scopeType: job.scopeType as 'class' | 'student',
    scopeId: job.scopeId,
    state: job.state,
    evidenceCutoff: job.evidenceCutoff.toISOString(),
    generatorVersion: job.generatorVersion,
    failureCode: job.failureCode,
    failureMessage: job.failureMessage,
    retryable: job.retryable,
    reportId: job.report?.id ?? null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export type DiagnosisGenerationJobApiItem = ReturnType<typeof projectDiagnosisGenerationJob>;

function activeScopeKey(teacherId: string, classId: string, targetStudentId?: string | null) {
  return `${teacherId}:${classId}:${targetStudentId ?? 'class'}`;
}

export async function startDiagnosisGenerationJob(
  db: PrismaClient,
  input: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    idempotencyKey: string;
    now?: Date;
  },
) {
  await assertTeacherClassScope(db as never, {
    teacherId: input.teacherId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    requireActive: true,
  });
  const scopeKey = activeScopeKey(input.teacherId, input.classId, input.targetStudentId);
  const existing = await db.diagnosisGenerationJob.findUnique({
    where: { userId_idempotencyKey: { userId: input.teacherId, idempotencyKey: input.idempotencyKey } },
    select: publicJobSelect,
  });
  if (existing) return existing;
  const active = await db.diagnosisGenerationJob.findUnique({
    where: { activeScopeKey: scopeKey },
    select: publicJobSelect,
  });
  if (active) return active;
  try {
    return await db.diagnosisGenerationJob.create({
      data: {
        userId: input.teacherId,
        classId: input.classId,
        targetUserId: input.targetStudentId ?? null,
        scopeType: input.targetStudentId ? 'student' : 'class',
        scopeId: input.targetStudentId ?? input.classId,
        activeScopeKey: scopeKey,
        idempotencyKey: input.idempotencyKey,
        evidenceCutoff: input.now ?? new Date(),
        generatorVersion: DIAGNOSIS_REPORT_GENERATOR_VERSION,
      },
      select: publicJobSelect,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const raced = await db.diagnosisGenerationJob.findFirst({
      where: {
        OR: [
          { userId: input.teacherId, idempotencyKey: input.idempotencyKey },
          { activeScopeKey: scopeKey },
        ],
      },
      select: publicJobSelect,
    });
    if (raced) return raced;
    throw error;
  }
}

export async function getDiagnosisGenerationJob(
  db: PrismaClient,
  input: { teacherId: string; jobId: string },
) {
  const job = await db.diagnosisGenerationJob.findFirst({
    where: { id: input.jobId, userId: input.teacherId },
    select: publicJobSelect,
  });
  if (!job) throw new DiagnosisGenerationError('diagnosis-generation-job-not-found', 404);
  await assertTeacherClassScope(db as never, {
    teacherId: input.teacherId,
    classId: job.classId,
    targetStudentId: job.targetUserId,
  });
  return job;
}

export async function retryDiagnosisGenerationJob(
  db: PrismaClient,
  input: { teacherId: string; jobId: string; idempotencyKey: string },
) {
  const job = await getDiagnosisGenerationJob(db, input);
  if (['QUEUED', 'RUNNING', 'COMPLETED'].includes(job.state)) return job;
  if (!['FAILED', 'TIMED_OUT'].includes(job.state) || !job.retryable) {
    throw new DiagnosisGenerationError('diagnosis-generation-not-retryable', 409);
  }
  await assertTeacherClassScope(db as never, {
    teacherId: input.teacherId,
    classId: job.classId,
    targetStudentId: job.targetUserId,
    requireActive: true,
  });
  const updated = await db.diagnosisGenerationJob.updateMany({
    where: { id: job.id, userId: input.teacherId, state: { in: ['FAILED', 'TIMED_OUT'] }, retryable: true },
    data: {
      state: 'QUEUED',
      activeScopeKey: activeScopeKey(input.teacherId, job.classId, job.targetUserId),
      failureCode: null,
      failureMessage: null,
      retryable: false,
      startedAt: null,
      completedAt: null,
      deliveryGeneration: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw new DiagnosisGenerationError('diagnosis-generation-retry-conflict', 409);
  return db.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: job.id }, select: publicJobSelect });
}

export async function markDiagnosisDeliveryFailure(db: PrismaClient, jobId: string) {
  await db.diagnosisGenerationJob.updateMany({
    where: { id: jobId, state: 'QUEUED' },
    data: {
      state: 'FAILED',
      activeScopeKey: null,
      failureCode: 'queue-unavailable',
      failureMessage: 'Diagnosis generation queue is unavailable.',
      retryable: true,
      completedAt: new Date(),
    },
  });
  return db.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: jobId }, select: publicJobSelect });
}

export async function claimDiagnosisGenerationAttempt(db: PrismaClient, jobId: string) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.diagnosisGenerationJob.updateMany({
      where: { id: jobId, state: 'QUEUED' },
      data: { state: 'RUNNING', startedAt: new Date(), failureCode: null, failureMessage: null },
    });
    if (claimed.count !== 1) return null;
    const count = await tx.diagnosisGenerationAttempt.count({ where: { jobId } });
    const attempt = await tx.diagnosisGenerationAttempt.create({
      data: { jobId, attemptNumber: count + 1 },
    });
    const job = await tx.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    return { job, attempt };
  });
}

export async function completeDiagnosisGenerationJob(
  db: PrismaClient,
  input: {
    jobId: string;
    attemptId: string;
    agentSessionId: string;
    providerResponseId?: string | null;
    toolAudit: Prisma.InputJsonValue;
    reportBody: DiagnosisReportBody;
  },
) {
  return db.$transaction(async (tx) => {
    const job = await tx.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: input.jobId } });
    if (job.state === 'COMPLETED') return tx.diagnosisReport.findUniqueOrThrow({ where: { generationJobId: job.id } });
    if (job.state !== 'RUNNING') throw new DiagnosisGenerationError('diagnosis-generation-state-conflict', 409);
    const report = await persistDiagnosisReport({
      teacherId: job.userId,
      classId: job.classId,
      targetStudentId: job.targetUserId,
      reportBody: input.reportBody,
      generationJobId: job.id,
    }, tx as never);
    await tx.diagnosisGenerationAttempt.update({
      where: { id: input.attemptId },
      data: {
        state: 'SUCCEEDED',
        agentSessionId: input.agentSessionId,
        providerResponseId: input.providerResponseId ?? null,
        toolAudit: input.toolAudit,
        completedAt: new Date(),
      },
    });
    await tx.diagnosisGenerationJob.update({
      where: { id: job.id },
      data: {
        state: 'COMPLETED',
        activeScopeKey: null,
        retryable: false,
        completedAt: new Date(),
      },
    });
    return report;
  });
}

export async function failDiagnosisGenerationAttempt(
  db: PrismaClient,
  input: {
    jobId: string;
    attemptId: string;
    code: string;
    message: string;
    retryable: boolean;
    timedOut?: boolean;
    willRetry?: boolean;
    agentSessionId?: string | null;
    toolAudit?: Prisma.InputJsonValue;
  },
) {
  return db.$transaction(async (tx) => {
    await tx.diagnosisGenerationAttempt.update({
      where: { id: input.attemptId },
      data: {
        state: input.timedOut ? 'TIMED_OUT' : 'FAILED',
        agentSessionId: input.agentSessionId ?? null,
        toolAudit: input.toolAudit ?? [],
        errorCode: input.code,
        errorMessage: input.message.slice(0, 2_000),
        completedAt: new Date(),
      },
    });
    return tx.diagnosisGenerationJob.update({
      where: { id: input.jobId },
      data: input.willRetry
        ? { state: 'QUEUED', startedAt: null }
        : {
            state: input.timedOut ? 'TIMED_OUT' : 'FAILED',
            activeScopeKey: null,
            failureCode: input.code,
            failureMessage: input.message.slice(0, 2_000),
            retryable: input.retryable,
            completedAt: new Date(),
          },
    });
  });
}

export function diagnosisGenerationErrorResponse(error: unknown) {
  if (error instanceof DiagnosisGenerationError || error instanceof DiagnosisReportScopeError) {
    return { status: error.status, body: { error: error.message } };
  }
  if (error instanceof z.ZodError) return { status: 400 as const, body: { error: 'invalid-diagnosis-generation-request' } };
  return null;
}

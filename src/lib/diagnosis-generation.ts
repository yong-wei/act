import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  assertTeacherClassScope,
  DiagnosisReportScopeError,
  persistDiagnosisReport,
  type DiagnosisReportBody,
} from '@/lib/diagnosis-persistence';
import {
  preflightDiagnosisGeneration,
} from '@/lib/diagnosis-generation-preflight';

export const diagnosisGenerationRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  targetStudentId: z.string().trim().min(1).max(200).optional(),
  force: z.boolean().optional().default(false),
  forceReason: z.string().trim().min(8).max(1_000).optional(),
}).strict().superRefine((value, context) => {
  if (value.force && !value.forceReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['forceReason'],
      message: 'force reason is required',
    });
  }
  if (!value.force && value.forceReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['forceReason'],
      message: 'force reason requires force intent',
    });
  }
});

export const diagnosisGenerationRetrySchema = z.object({
  action: z.literal('retry'),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export const DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS = 2 * 60 * 1_000;

export class DiagnosisGenerationError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 503,
  ) {
    super(code);
    this.name = 'DiagnosisGenerationError';
  }
}

export class DiagnosisGenerationOutputValidationError extends Error {
  constructor(readonly validationError: z.ZodError) {
    super('diagnosis-output-invalid');
    this.name = 'DiagnosisGenerationOutputValidationError';
  }
}

export function classifyDiagnosisGenerationOutputValidationError(error: unknown) {
  if (!(error instanceof DiagnosisGenerationOutputValidationError)) return null;
  const path = error.validationError.issues[0]?.path.map(String).join('.') || 'reportBody';
  return {
    code: 'diagnosis-output-invalid',
    message: `诊断结果结构无效：${path}。`,
  };
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
  ruleVersion: true,
  generationReason: true,
  forceReason: true,
  previousReportId: true,
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
    ...(job.ruleVersion ? { ruleVersion: job.ruleVersion } : {}),
    ...(job.generationReason ? { generationReason: job.generationReason } : {}),
    ...(job.forceReason ? { forceReason: job.forceReason } : {}),
    ...(job.previousReportId ? { previousReportId: job.previousReportId } : {}),
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

async function lockDiagnosisGenerationScope(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  scopeKey: string,
) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${`diagnosis-generation:${scopeKey}`}))
  `);
}

export async function startDiagnosisGenerationJob(
  db: PrismaClient,
  input: {
    teacherId: string;
    classId: string;
    targetStudentId?: string | null;
    idempotencyKey: string;
    force?: boolean;
    forceReason?: string | null;
    now?: Date;
  },
) {
  await assertTeacherClassScope(db as never, {
    teacherId: input.teacherId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    requireActive: true,
  });
  const forceReason = input.forceReason?.trim() ?? '';
  if (input.force && (forceReason.length < 8 || forceReason.length > 1_000)) {
    throw new DiagnosisGenerationError('diagnosis-generation-force-reason-required', 400);
  }
  if (!input.force && forceReason) {
    throw new DiagnosisGenerationError('diagnosis-generation-force-reason-without-force', 400);
  }
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
  const preflight = await preflightDiagnosisGeneration(db, {
    teacherId: input.teacherId,
    classId: input.classId,
    targetStudentId: input.targetStudentId,
    now: input.now,
  });
  if (preflight.status === 'UNAVAILABLE') {
    throw new DiagnosisGenerationError('diagnosis-generation-unavailable', 409);
  }
  if (preflight.status === 'ACTIVE_JOB') {
    const racedActive = await db.diagnosisGenerationJob.findUnique({
      where: { activeScopeKey: scopeKey },
      select: publicJobSelect,
    });
    if (racedActive) return racedActive;
    throw new DiagnosisGenerationError('diagnosis-generation-active-job-conflict', 409);
  }
  if (input.force && !preflight.canForce) {
    throw new DiagnosisGenerationError('diagnosis-generation-force-not-required', 409);
  }
  if (!input.force && !preflight.canGenerate) {
    throw new DiagnosisGenerationError('diagnosis-generation-no-effective-change', 409);
  }
  try {
    return await db.$transaction(async (tx) => {
      await lockDiagnosisGenerationScope(tx, scopeKey);
      const activeAfterLock = await tx.diagnosisGenerationJob.findUnique({
        where: { activeScopeKey: scopeKey },
        select: publicJobSelect,
      });
      if (activeAfterLock) return activeAfterLock;
      const latestReport = await tx.diagnosisReport.findFirst({
        where: {
          classId: input.classId,
          ...(input.targetStudentId
            ? { targetUserId: input.targetStudentId }
            : { targetUserId: null }),
        },
        orderBy: { generatedAt: 'desc' },
        select: { id: true },
      });
      if ((latestReport?.id ?? null) !== (preflight.previousReport?.id ?? null)) {
        throw new DiagnosisGenerationError('diagnosis-generation-predecessor-changed', 409);
      }
      return tx.diagnosisGenerationJob.create({
        data: {
          userId: input.teacherId,
          classId: input.classId,
          targetUserId: input.targetStudentId ?? null,
          scopeType: input.targetStudentId ? 'student' : 'class',
          scopeId: input.targetStudentId ?? input.classId,
          activeScopeKey: scopeKey,
          idempotencyKey: input.idempotencyKey,
          evidenceCutoff: preflight.evidenceCutoff,
          generatorVersion: preflight.generatorVersion,
          ruleVersion: preflight.ruleVersion,
          generationReason: input.force ? 'teacher-forced' : preflight.generationReason,
          forceReason: input.force ? forceReason : null,
          previousReportId: preflight.previousReport?.id ?? null,
          inputSummary: preflight.inputSummary,
          governedInput: preflight.governedInput,
          inputDigest: preflight.inputDigest,
          ordinaryGenerationIdentity: input.force ? null : preflight.ordinaryGenerationIdentity,
        },
        select: publicJobSelect,
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const raced = await db.diagnosisGenerationJob.findFirst({
      where: {
        OR: [
          { userId: input.teacherId, idempotencyKey: input.idempotencyKey },
          { activeScopeKey: scopeKey },
          ...(!input.force
            ? [{ ordinaryGenerationIdentity: preflight.ordinaryGenerationIdentity }]
            : []),
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
  const scopeKey = activeScopeKey(input.teacherId, job.classId, job.targetUserId);
  const active = await db.diagnosisGenerationJob.findUnique({
    where: { activeScopeKey: scopeKey },
    select: publicJobSelect,
  });
  if (active && active.id !== job.id) return active;
  let updated: { count: number };
  try {
    updated = await db.diagnosisGenerationJob.updateMany({
      where: { id: job.id, userId: input.teacherId, state: { in: ['FAILED', 'TIMED_OUT'] }, retryable: true },
      data: {
        state: 'QUEUED',
        activeScopeKey: scopeKey,
        failureCode: null,
        failureMessage: null,
        retryable: false,
        startedAt: null,
        completedAt: null,
        deliveryGeneration: { increment: 1 },
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const raced = await db.diagnosisGenerationJob.findUnique({
      where: { activeScopeKey: scopeKey },
      select: publicJobSelect,
    });
    if (raced && raced.id !== job.id) return raced;
    throw new DiagnosisGenerationError('diagnosis-generation-retry-conflict', 409);
  }
  if (updated.count !== 1) {
    const raced = await db.diagnosisGenerationJob.findUnique({
      where: { activeScopeKey: scopeKey },
      select: publicJobSelect,
    });
    if (raced && raced.id !== job.id) return raced;
    throw new DiagnosisGenerationError('diagnosis-generation-retry-conflict', 409);
  }
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

export async function claimDiagnosisGenerationAttempt(
  db: PrismaClient,
  jobId: string,
  now = new Date(),
) {
  return db.$transaction(async (tx) => {
    const staleBefore = new Date(now.getTime() - DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS);
    const claimed = await tx.diagnosisGenerationJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { state: 'QUEUED' },
          { state: 'RUNNING', startedAt: { lt: staleBefore } },
        ],
      },
      data: { state: 'RUNNING', startedAt: now, failureCode: null, failureMessage: null },
    });
    if (claimed.count !== 1) return null;
    await tx.diagnosisGenerationAttempt.updateMany({
      where: { jobId, state: 'RUNNING' },
      data: {
        state: 'TIMED_OUT',
        errorCode: 'diagnosis-generation-timeout',
        errorMessage: 'Diagnosis generation attempt exceeded its execution deadline.',
        completedAt: now,
      },
    });
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
    let job = await tx.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: input.jobId } });
    await lockDiagnosisGenerationScope(tx, activeScopeKey(job.userId, job.classId, job.targetUserId));
    job = await tx.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: input.jobId } });
    if (job.state === 'COMPLETED') return tx.diagnosisReport.findUniqueOrThrow({ where: { generationJobId: job.id } });
    if (job.state !== 'RUNNING') throw new DiagnosisGenerationError('diagnosis-generation-state-conflict', 409);
    const attempt = await tx.diagnosisGenerationAttempt.findFirst({
      where: { id: input.attemptId, jobId: job.id, state: 'RUNNING' },
      select: { id: true },
    });
    if (!attempt) throw new DiagnosisGenerationError('diagnosis-generation-attempt-conflict', 409);
    const report = await persistDiagnosisReport({
      teacherId: job.userId,
      classId: job.classId,
      targetStudentId: job.targetUserId,
      reportBody: input.reportBody,
      generationJobId: job.id,
      generatorVersion: job.generatorVersion,
      ruleVersion: job.ruleVersion,
      generationReason: job.generationReason,
      forceReason: job.forceReason,
      previousReportId: job.previousReportId,
      inputSummary: job.inputSummary,
      inputDigest: job.inputDigest,
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
    const updatedAttempt = await tx.diagnosisGenerationAttempt.updateMany({
      where: { id: input.attemptId, jobId: input.jobId, state: 'RUNNING' },
      data: {
        state: input.timedOut ? 'TIMED_OUT' : 'FAILED',
        agentSessionId: input.agentSessionId ?? null,
        toolAudit: input.toolAudit ?? [],
        errorCode: input.code,
        errorMessage: input.message.slice(0, 2_000),
        completedAt: new Date(),
      },
    });
    if (updatedAttempt.count !== 1) {
      return tx.diagnosisGenerationJob.findUniqueOrThrow({ where: { id: input.jobId } });
    }
    return tx.diagnosisGenerationJob.update({
      where: { id: input.jobId, state: 'RUNNING' },
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

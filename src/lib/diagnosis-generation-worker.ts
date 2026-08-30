import type { PrismaClient } from '@prisma/client';
import { NoOutputGeneratedError } from 'ai';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';

import {
  claimDiagnosisGenerationAttempt,
  classifyDiagnosisGenerationOutputValidationError,
  completeDiagnosisGenerationJob,
  DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS,
  DIAGNOSIS_GENERATION_LOCK_DURATION_MS,
  failDiagnosisGenerationAttempt,
} from '@/lib/diagnosis-generation';
import {
  DiagnosisGenerationFindingAttributionError,
  DiagnosisGenerationProviderEmptyOutputError,
  DiagnosisGenerationProviderLanguageError,
  DiagnosisGenerationValidationError,
  generateGovernedDiagnosisReport,
} from '@/lib/diagnosis-generation-provider';
import { prisma } from '@/lib/prisma';

export const DIAGNOSIS_GENERATION_QUEUE = 'teacher-diagnosis-generation';
let worker: Worker<{ jobId: string }> | null = null;

function isProviderWindowTimeout(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'advisory-provider-timeout',
  );
}

function classifyDiagnosisGenerationFailure(error: unknown) {
  if (
    error instanceof DiagnosisGenerationProviderEmptyOutputError
    || NoOutputGeneratedError.isInstance(error)
    || isProviderWindowTimeout(error)
  ) {
    return {
      validation: false,
      code: 'diagnosis-provider-empty-output',
      message: '诊断模型未返回可用的结构化结果。',
    };
  }
  // 语言回归与空输出同类（模型行为缺陷），在既有尝试预算内重试而非直接终止。
  if (error instanceof DiagnosisGenerationProviderLanguageError) {
    return {
      validation: false,
      code: 'diagnosis-provider-language-mismatch',
      message: error.message,
    };
  }
  // 知识节点归因缺失与空输出同类（模型行为缺陷），在既有尝试预算内重试而非直接终止。
  if (error instanceof DiagnosisGenerationFindingAttributionError) {
    return {
      validation: false,
      code: 'diagnosis-finding-attribution-invalid',
      message: error.message,
    };
  }
  if (error instanceof DiagnosisGenerationValidationError) {
    return {
      validation: true,
      code: error.code,
      message: error.message,
    };
  }
  const outputValidation = classifyDiagnosisGenerationOutputValidationError(error);
  if (outputValidation) {
    return {
      validation: true,
      ...outputValidation,
    };
  }
  return {
    validation: false,
    code: null,
    message: error instanceof Error ? error.message : 'Diagnosis generation failed.',
  };
}

export async function ensureDiagnosisGenerationWorker(connection: Redis) {
  if (worker) return worker;
  const candidate = new Worker<{ jobId: string }>(
    DIAGNOSIS_GENERATION_QUEUE,
    (job) => processDiagnosisGenerationJob(prisma, job.data.jobId, job),
    {
      connection: connection.duplicate({ maxRetriesPerRequest: null }),
      concurrency: 2,
      lockDuration: DIAGNOSIS_GENERATION_LOCK_DURATION_MS,
      ...(queuePrefix() ? { prefix: queuePrefix() } : {}),
    },
  );
  candidate.on('error', (error) => console.error('[DiagnosisGenerationWorker]', error));
  worker = candidate;
  try {
    await candidate.waitUntilReady();
    return candidate;
  } catch (error) {
    worker = null;
    await candidate.close(true).catch(() => undefined);
    throw error;
  }
}

export async function processDiagnosisGenerationJob(
  db: PrismaClient,
  jobId: string,
  queueJob?: Pick<Job, 'attemptsMade' | 'opts'>,
  generate = generateGovernedDiagnosisReport,
) {
  const claim = await claimDiagnosisGenerationAttempt(db, jobId);
  if (!claim) return { jobId, skipped: true };
  let audit: Awaited<ReturnType<typeof generate>> | null = null;
  try {
    audit = await withGenerationTimeout(generate(db, {
      jobId,
      attemptId: claim.attempt.id,
      teacherId: claim.job.userId,
      classId: claim.job.classId,
      targetStudentId: claim.job.targetUserId,
      evidenceCutoff: claim.job.evidenceCutoff,
      generatorVersion: claim.job.generatorVersion,
      governedInput: claim.job.governedInput,
      inputDigest: claim.job.inputDigest,
    }));
    await completeDiagnosisGenerationJob(db, {
      jobId,
      attemptId: claim.attempt.id,
      agentSessionId: audit.agentSessionId,
      providerResponseId: audit.providerResponseId,
      toolAudit: audit.toolAudit,
      reportBody: audit.reportBody,
    });
    return { jobId, state: 'COMPLETED' as const };
  } catch (error) {
    const failure = classifyDiagnosisGenerationFailure(error);
    const timedOut = isTimeout(error);
    const maxAttempts = queueJob?.opts.attempts ?? 3;
    const willRetry = !failure.validation && (queueJob?.attemptsMade ?? 0) + 1 < maxAttempts;
    await failDiagnosisGenerationAttempt(db, {
      jobId,
      attemptId: claim.attempt.id,
      code: failure.code ?? (timedOut ? 'diagnosis-generation-timeout' : 'diagnosis-provider-unavailable'),
      message: failure.message,
      retryable: !failure.validation,
      timedOut,
      willRetry,
      agentSessionId: audit?.agentSessionId,
      toolAudit: audit?.toolAudit,
    });
    if (failure.validation) throw new UnrecoverableError(failure.message);
    throw error;
  }
}

function isTimeout(error: unknown) {
  if (isProviderWindowTimeout(error)) return false;
  return error instanceof Error && /timeout|timed out|aborted/i.test(`${error.name} ${error.message}`);
}

async function withGenerationTimeout<T>(operation: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Diagnosis generation timed out.')),
          DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function queuePrefix() {
  return process.env.DIAGNOSIS_GENERATION_REDIS_PREFIX?.trim() || undefined;
}

export async function closeDiagnosisGenerationWorker() {
  await worker?.close();
  worker = null;
}

import { Prisma } from '@prisma/client';
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

import {
  claimDiagnosisGenerationAttempt,
  DiagnosisGenerationOutputValidationError,
  DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS,
  diagnosisGenerationRequestSchema,
  projectDiagnosisGenerationJob,
  retryDiagnosisGenerationJob,
  startDiagnosisGenerationJob,
} from '@/lib/diagnosis-generation';
import { diagnosisReportBodySchema } from '@/lib/diagnosis-persistence';
import { processDiagnosisGenerationJob } from '@/lib/diagnosis-generation-worker';

const now = new Date('2026-08-08T08:00:00.000Z');

function publicJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    classId: 'class-1',
    targetUserId: null,
    scopeType: 'class',
    scopeId: 'class-1',
    state: 'QUEUED',
    evidenceCutoff: now,
    generatorVersion: 'teacher-diagnosis.v1',
    failureCode: null,
    failureMessage: null,
    retryable: false,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    report: null,
    ...overrides,
  };
}

function dbFixture() {
  return {
    class: {
      findUnique: vi.fn().mockResolvedValue({ id: 'class-1', teacherId: 'teacher-1', isActive: true }),
    },
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue({ userId: 'student-1' }),
    },
    diagnosisGenerationJob: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    diagnosisGenerationAttempt: {
      updateMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function workerDbFixture() {
  const tx = {
    diagnosisGenerationJob: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'job-1',
        userId: 'teacher-1',
        classId: 'class-1',
        targetUserId: null,
        evidenceCutoff: now,
        generatorVersion: 'teacher-diagnosis.v1',
      }),
      update: vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    diagnosisGenerationAttempt: {
      updateMany: vi.fn()
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'attempt-1', attemptNumber: 1 }),
    },
  };
  return {
    db: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    },
    tx,
  };
}

describe('teacher diagnosis generation contracts', () => {
  it('records malformed provider output as non-retryable and stops the worker', async () => {
    const parsed = diagnosisReportBodySchema.safeParse({
      summary: 'Malformed diagnosis output.',
      findings: [],
      evidenceRefs: [],
      evidenceCutoff: now.toISOString(),
      sourceCoverage: { progressRows: 1 },
      confidence: 'medium',
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const { db, tx } = workerDbFixture();
    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw new DiagnosisGenerationOutputValidationError(parsed.error); },
    )).rejects.toBeInstanceOf(UnrecoverableError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-output-invalid',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        activeScopeKey: null,
        failureCode: 'diagnosis-output-invalid',
        retryable: false,
      }),
    }));
  });

  it('keeps ordinary provider failures retryable', async () => {
    const providerError = new Error('provider unavailable');
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw providerError; },
    )).rejects.toBe(providerError);

    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'FAILED',
        errorCode: 'diagnosis-provider-unavailable',
      }),
    }));
    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('keeps non-report Zod errors on the ordinary retry path', async () => {
    const metadataError = z.object({ responseId: z.string().max(3) }).safeParse({ responseId: 'response-id-too-long' });
    expect(metadataError.success).toBe(false);
    if (metadataError.success) return;
    const { db, tx } = workerDbFixture();

    await expect(processDiagnosisGenerationJob(
      db as never,
      'job-1',
      { attemptsMade: 0, opts: { attempts: 3 } } as never,
      async () => { throw metadataError.error; },
    )).rejects.toBe(metadataError.error);

    expect(tx.diagnosisGenerationJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: 'QUEUED', startedAt: null },
    }));
  });

  it('rejects factual report content from the browser', () => {
    expect(() => diagnosisGenerationRequestSchema.parse({
      idempotencyKey: 'request-123',
      reportBody: { summary: 'browser-authored' },
    })).toThrow();
  });

  it('reuses the same idempotency key', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique.mockResolvedValueOnce(publicJob());

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-123',
      now,
    });

    expect(result.id).toBe('job-1');
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('reuses an active scope for a different request key', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(publicJob());

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      idempotencyKey: 'request-456',
      now,
    });

    expect(result.id).toBe('job-1');
    expect(db.diagnosisGenerationJob.create).not.toHaveBeenCalled();
  });

  it('creates a new immutable evidence snapshot after terminal jobs', async () => {
    const db = dbFixture();
    db.diagnosisGenerationJob.findUnique.mockResolvedValue(null);
    db.diagnosisGenerationJob.create.mockResolvedValue(publicJob({ id: 'job-2' }));

    const result = await startDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      classId: 'class-1',
      targetStudentId: 'student-1',
      idempotencyKey: 'request-789',
      now,
    });

    expect(result.id).toBe('job-2');
    expect(db.diagnosisGenerationJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activeScopeKey: 'teacher-1:class-1:student-1',
        evidenceCutoff: now,
        scopeType: 'student',
        scopeId: 'student-1',
      }),
    }));
    expect(projectDiagnosisGenerationJob(result as never)).toMatchObject({
      id: 'job-2',
      evidenceCutoff: now.toISOString(),
    });
  });

  it('reclaims a stale running job and records the interrupted attempt as timed out', async () => {
    const db = dbFixture();
    const tx = {
      diagnosisGenerationJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'job-1' }),
      },
      diagnosisGenerationAttempt: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: 'attempt-2', attemptNumber: 2 }),
      },
    };
    db.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const claim = await claimDiagnosisGenerationAttempt(db as never, 'job-1', now);

    expect(claim).toMatchObject({ attempt: { id: 'attempt-2', attemptNumber: 2 } });
    expect(tx.diagnosisGenerationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { state: 'QUEUED' },
          { state: 'RUNNING', startedAt: { lt: new Date(now.getTime() - DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS) } },
        ]),
      }),
    }));
    expect(tx.diagnosisGenerationAttempt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { jobId: 'job-1', state: 'RUNNING' },
      data: expect.objectContaining({ state: 'TIMED_OUT', completedAt: now }),
    }));
  });

  it('reuses a newer active scope instead of reviving an older failed job into a uniqueness conflict', async () => {
    const db = dbFixture();
    const failed = publicJob({ id: 'job-old', state: 'FAILED', retryable: true });
    const active = publicJob({ id: 'job-new', state: 'RUNNING', retryable: false });
    db.diagnosisGenerationJob.findFirst.mockResolvedValue(failed);
    db.diagnosisGenerationJob.findUnique.mockResolvedValue(active);

    const result = await retryDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      jobId: 'job-old',
      idempotencyKey: 'retry-123',
    });

    expect(result.id).toBe('job-new');
    expect(db.diagnosisGenerationJob.updateMany).not.toHaveBeenCalled();
  });

  it('reuses an active scope created between retry lookup and the unique-key write', async () => {
    const db = dbFixture();
    const failed = publicJob({ id: 'job-old', state: 'FAILED', retryable: true });
    const active = publicJob({ id: 'job-new', state: 'QUEUED', retryable: false });
    db.diagnosisGenerationJob.findFirst.mockResolvedValue(failed);
    db.diagnosisGenerationJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(active);
    db.diagnosisGenerationJob.updateMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'active scope already claimed',
      { code: 'P2002', clientVersion: 'test' },
    ));

    const result = await retryDiagnosisGenerationJob(db as never, {
      teacherId: 'teacher-1',
      jobId: 'job-old',
      idempotencyKey: 'retry-456',
    });

    expect(result.id).toBe('job-new');
    expect(db.diagnosisGenerationJob.findUnique).toHaveBeenCalledTimes(2);
  });
});

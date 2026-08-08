import { describe, expect, it, vi } from 'vitest';

import {
  claimDiagnosisGenerationAttempt,
  DIAGNOSIS_GENERATION_ATTEMPT_TIMEOUT_MS,
  diagnosisGenerationRequestSchema,
  projectDiagnosisGenerationJob,
  retryDiagnosisGenerationJob,
  startDiagnosisGenerationJob,
} from '@/lib/diagnosis-generation';

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

describe('teacher diagnosis generation contracts', () => {
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
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({
  enqueueDocumentConversion: vi.fn(),
  enqueueGradingRun: vi.fn(),
  materializeTextAnswerEvidence: vi.fn(),
}));

vi.mock('../math-document-grading-persistence', () => persistence);

import { drainTeacherAssignmentResubmissionIntakes } from '../teacher-assignment-resubmission-intake';

describe('teacher assignment resubmission intake', () => {
  beforeEach(() => vi.clearAllMocks());

  it('takes over an expired claim and queues a new grading run against the resubmitted attempt', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const updateMany = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
      return { count: 1 };
    });
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'intake-1',
            attemptId: 'attempt-new',
            state: 'PROCESSING',
            claimToken: 'stale-worker',
            leaseExpiresAt: new Date('2026-07-17T02:59:00.000Z'),
            availableAt: now,
            createdAt: now,
            attemptCount: 1,
          })
          .mockResolvedValueOnce(null),
        updateMany,
        findUnique: vi.fn(async () => ({
          id: 'intake-1',
          attemptId: 'attempt-new',
          state: 'PROCESSING',
          claimToken,
          grant: {
            state: 'CONSUMED',
            consumedAttemptId: 'attempt-new',
            sourceReviewId: 'review-1',
          },
          attempt: { answer: { responseType: 'SUBJECTIVE_TEXT', assets: [] } },
          sourceGradingRun: { policyId: 'grading-policy-1', answerEvidence: null },
        })),
      },
      answerEvidence: {
        findFirst: vi.fn().mockResolvedValue({ id: 'evidence-new', readiness: 'READY' }),
      },
    };

    persistence.enqueueGradingRun.mockResolvedValue({ gradingRun: { id: 'run-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toEqual({
      claimed: 1,
      queued: 1,
      waiting: 0,
      retryable: 0,
      blocked: 0,
    });
    expect(persistence.enqueueGradingRun).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'attempt-new',
      evidenceId: 'evidence-new',
      policyId: 'grading-policy-1',
      idempotencyKey: 'resubmission-grading:attempt-new',
    }));
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ state: 'PROCESSING', claimToken }),
      data: expect.objectContaining({ state: 'QUEUED', claimToken: null }),
    }));
  });

  it('requeues grading when the source run resolved policy at runtime', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn().mockResolvedValueOnce({ id: 'intake-runtime-policy', attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 }).mockResolvedValueOnce(null),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({
          id: 'intake-runtime-policy', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-1' },
          attempt: { answer: { responseType: 'SUBJECTIVE_TEXT', assets: [] } },
          sourceGradingRun: { policyId: null, policySnapshot: null, policySnapshotHash: null, answerEvidence: null },
        })),
      },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue({ id: 'evidence-new', readiness: 'READY' }) },
    };
    persistence.enqueueGradingRun.mockResolvedValue({ gradingRun: { id: 'run-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toMatchObject({ queued: 1, blocked: 0 });
    expect(persistence.enqueueGradingRun).toHaveBeenCalledWith(expect.objectContaining({ policyId: null, policySnapshot: null, policySnapshotHash: null }));
  });

  it('blocks an intake whose consumed grant does not point at the resubmitted attempt', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const updateMany = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
      return { count: 1 };
    });
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'intake-2', attemptId: 'attempt-new', state: 'PENDING', claimToken: null,
            availableAt: now, createdAt: now, attemptCount: 0,
          })
          .mockResolvedValueOnce(null),
        updateMany,
        findUnique: vi.fn(async () => ({
          id: 'intake-2', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'different-attempt' },
          attempt: { answer: { responseType: 'SUBJECTIVE_TEXT', assets: [] } },
          sourceGradingRun: { policyId: 'grading-policy-1', answerEvidence: null },
        })),
      },
    };

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toEqual({
      claimed: 1,
      queued: 0,
      waiting: 0,
      retryable: 0,
      blocked: 1,
    });
    expect(persistence.enqueueGradingRun).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ state: 'PROCESSING', claimToken }),
      data: expect.objectContaining({ state: 'BLOCKED', lastErrorCode: 'resubmission-intake-lineage-invalid' }),
    }));
  });

  it.each([
    ['image/png', 'asset-image'],
    ['application/pdf', 'asset-pdf'],
  ])('reselects conversion policy from the new %s asset instead of inheriting the old policy', async (mimeType, assetId) => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const updateMany = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
      return { count: 1 };
    });
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: `intake-${assetId}`, attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 })
          .mockResolvedValueOnce(null),
        updateMany,
        findUnique: vi.fn(async () => ({
          id: `intake-${assetId}`, attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-1' },
          attempt: { answer: { responseType: 'SUBJECTIVE_FILE', assets: [{ id: assetId, mimeType }] } },
          sourceGradingRun: {
            policyId: 'grading-policy-1',
            answerEvidence: { conversion: { adapterVersion: 'mathpix.v1', policyId: 'old-opposite-mime-policy' } },
          },
        })),
      },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue(null) },
      documentConversion: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    persistence.enqueueDocumentConversion.mockResolvedValue({ conversion: { id: 'conversion-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toMatchObject({
      claimed: 1, waiting: 1, blocked: 0,
    });
    expect(persistence.enqueueDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({
      assetId,
      attemptId: 'attempt-new',
      adapterVersion: 'mathpix.v1',
    }));
    expect(persistence.enqueueDocumentConversion.mock.calls[0]?.[0]).not.toHaveProperty('policyId');
  });

  it('uses governed router lineage when legacy source evidence has no conversion', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: 'intake-legacy', attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 })
          .mockResolvedValueOnce(null),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({
          id: 'intake-legacy', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-legacy' },
          attempt: { answer: { responseType: 'SUBJECTIVE_FILE', assets: [{ id: 'asset-new', mimeType: 'application/pdf' }] } },
          sourceGradingRun: { policyId: 'grading-policy-1', answerEvidence: null },
        })),
      },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue(null) },
      documentConversion: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    persistence.enqueueDocumentConversion.mockResolvedValue({ conversion: { id: 'conversion-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toMatchObject({ waiting: 1, blocked: 0 });
    expect(persistence.enqueueDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'asset-new', adapterVersion: 'router.v1',
    }));
    expect(persistence.enqueueDocumentConversion.mock.calls[0]?.[0]).not.toHaveProperty('policyId');
  });
});

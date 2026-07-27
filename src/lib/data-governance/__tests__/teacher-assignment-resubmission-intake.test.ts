import { beforeEach, describe, expect, it, vi } from 'vitest';

const persistence = vi.hoisted(() => ({
  enqueueDocumentConversion: vi.fn(),
  enqueueGradingRun: vi.fn(),
  materializeAssignmentAnswerEvidence: vi.fn(),
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
  ])('uses governed assignment understanding for the new %s asset instead of inheriting the old policy', async (mimeType, assetId) => {
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
      gradingProviderPolicy: {
        findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: { endsWith: string } } }) => ({
          id: `grading-provider:mathpix:v2${where.id.endsWith}`,
        })),
      },
    };
    persistence.enqueueDocumentConversion.mockResolvedValue({ conversion: { id: 'conversion-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toMatchObject({
      claimed: 1, waiting: 1, blocked: 0,
    });
    expect(persistence.enqueueDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({
      assetId,
      attemptId: 'attempt-new',
      adapterVersion: 'assignment-understanding.v1',
      policyId: mimeType.startsWith('image/')
        ? 'grading-provider:mathpix:v2:image'
        : 'grading-provider:mathpix:v2:document',
      allowDefaultPolicyDiscovery: false,
    }));
    expect(db.gradingProviderPolicy.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        provider: 'mathpix',
        purpose: 'answer-conversion',
        enabled: true,
        disabledAt: null,
        id: {
          endsWith: mimeType.startsWith('image/') ? ':image' : ':document',
        },
      }),
    }));
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
      gradingProviderPolicy: {
        findFirst: vi.fn().mockResolvedValue({ id: 'grading-provider:mathpix:v2:document' }),
      },
    };
    persistence.enqueueDocumentConversion.mockResolvedValue({ conversion: { id: 'conversion-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now })).resolves.toMatchObject({ waiting: 1, blocked: 0 });
    expect(persistence.enqueueDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'asset-new',
      adapterVersion: 'assignment-understanding.v1',
      policyId: 'grading-provider:mathpix:v2:document',
      allowDefaultPolicyDiscovery: false,
    }));
  });

  it('routes an attachment-only resubmission by attempt content even for a legacy text answer', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: 'intake-attachment-only', attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 })
          .mockResolvedValueOnce(null),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({
          id: 'intake-attachment-only', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-1' },
          attempt: {
            textSnapshot: null,
            answer: { responseType: 'SUBJECTIVE_TEXT', assets: [{ id: 'asset-new', mimeType: 'application/pdf' }] },
          },
          sourceGradingRun: { policyId: 'grading-policy-1', answerEvidence: null },
        })),
      },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue(null) },
      documentConversion: { findFirst: vi.fn().mockResolvedValue(null) },
      gradingProviderPolicy: {
        findFirst: vi.fn().mockResolvedValue({ id: 'grading-provider:mathpix:v2:document' }),
      },
    };

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now }))
      .resolves.toMatchObject({ waiting: 1, blocked: 0 });
    expect(persistence.enqueueDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({
      assetId: 'asset-new',
      attemptId: 'attempt-new',
    }));
    expect(persistence.materializeTextAnswerEvidence).not.toHaveBeenCalled();
  });

  it('routes a text-only resubmission by attempt content even for a legacy file answer', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: 'intake-text-only', attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 })
          .mockResolvedValueOnce(null),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({
          id: 'intake-text-only', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-1' },
          attempt: {
            textSnapshot: '只提交正文',
            answer: { responseType: 'SUBJECTIVE_FILE', assets: [] },
          },
          sourceGradingRun: { policyId: 'grading-policy-1', policySnapshot: null, policySnapshotHash: null, answerEvidence: null },
        })),
      },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    persistence.materializeTextAnswerEvidence.mockResolvedValue({
      evidence: { id: 'text-evidence', readiness: 'READY' },
    });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now }))
      .resolves.toMatchObject({ queued: 1, blocked: 0 });
    expect(persistence.materializeTextAnswerEvidence).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'attempt-new',
    }));
    expect(persistence.enqueueDocumentConversion).not.toHaveBeenCalled();
    expect(persistence.enqueueGradingRun).toHaveBeenCalledWith(expect.objectContaining({
      evidenceId: 'text-evidence',
    }));
  });

  it('materializes aggregate v2 evidence before grading an attachment resubmission', async () => {
    const now = new Date('2026-07-17T03:00:00.000Z');
    let claimToken: string | null = null;
    const asset = {
      id: 'asset-resubmitted',
      mimeType: 'application/pdf',
      originalName: 'answer.pdf',
      checksum: 'sha256:resubmitted',
      orderIndex: 0,
      assetRole: 'ATTACHMENT',
    };
    const db = {
      teacherAssignmentResubmissionIntake: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: 'intake-aggregate', attemptId: 'attempt-new', state: 'PENDING', availableAt: now, createdAt: now, attemptCount: 0 })
          .mockResolvedValueOnce(null),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (data.state === 'PROCESSING') claimToken = String(data.claimToken);
          return { count: 1 };
        }),
        findUnique: vi.fn(async () => ({
          id: 'intake-aggregate', attemptId: 'attempt-new', state: 'PROCESSING', claimToken,
          grant: { state: 'CONSUMED', consumedAttemptId: 'attempt-new', sourceReviewId: 'review-1' },
          attempt: {
            answerVersion: 2,
            textSnapshot: 'resubmitted explanation',
            answer: { responseType: 'SUBJECTIVE_FILE', assets: [asset] },
          },
          sourceGradingRun: { policyId: 'grading-policy-1', policySnapshot: null, policySnapshotHash: null, answerEvidence: null },
        })),
      },
      answerEvidence: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      documentConversion: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'conversion-resubmitted',
          adapter: 'mathpix',
          adapterVersion: 'assignment-understanding.v1',
          state: 'SUCCEEDED',
          canonicalMarkdown: 'converted answer',
          normalizedBlocks: [{ id: 'page-1', blockIndex: 0, pageNumber: 1, text: 'converted answer', precision: 'page' }],
          warningCodes: [],
          failureCode: null,
        }),
      },
    };
    persistence.materializeAssignmentAnswerEvidence.mockResolvedValue({
      evidence: { id: 'aggregate-v2', readiness: 'READY', anchorVersion: 'assignment-answer-evidence.v2' },
    });
    persistence.enqueueGradingRun.mockResolvedValue({ gradingRun: { id: 'run-new' } });

    await expect(drainTeacherAssignmentResubmissionIntakes({ db, now: () => now }))
      .resolves.toMatchObject({ queued: 1, blocked: 0, retryable: 0 });

    expect(db.answerEvidence.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        attemptId: 'attempt-new',
        anchorVersion: 'assignment-answer-evidence.v2',
      }),
    }));
    expect(persistence.materializeAssignmentAnswerEvidence).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'attempt-new',
      answerVersion: 2,
      sourceManifest: expect.objectContaining({
        version: 'assignment-answer-evidence.v2',
      }),
    }));
    expect(persistence.enqueueGradingRun).toHaveBeenCalledWith(expect.objectContaining({
      evidenceId: 'aggregate-v2',
    }));
  });
});

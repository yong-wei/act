import { beforeAll, describe, expect, it, vi } from 'vitest';

let runMigration: typeof import(
  '../../../../scripts/assignments/migrate-legacy-assignment-attachment-understanding'
)['runLegacyAssignmentAttachmentUnderstandingMigration'];

beforeAll(async () => {
  process.env.ASSIGNMENT_ATTACHMENT_MIGRATION_IMPORT = '1';
  ({ runLegacyAssignmentAttachmentUnderstandingMigration: runMigration } =
    await import(
      '../../../../scripts/assignments/migrate-legacy-assignment-attachment-understanding'
    ));
});

describe('legacy assignment attachment migration', () => {
  it('preserves approved history while blocking active reruns and settling parent jobs', async () => {
    const approvedRun = {
      id: 'run-approved',
      state: 'APPROVED',
      evidenceState: 'COMPLETE',
      approvalSnapshot: null,
      jobs: [],
    };
    const activeRun = {
      id: 'run-active',
      state: 'AWAITING_REVIEW',
      evidenceState: 'COMPLETE',
      approvalSnapshot: null,
      jobs: [{ id: 'job-run-active', state: 'RUNNING' }],
    };
    const batch = {
      id: 'batch-1',
      state: 'RUNNING',
      items: [
        { id: 'item-approved', state: 'SUCCEEDED' },
        { id: 'item-active', state: 'GRADING' },
      ],
      jobs: [{ id: 'job-batch', state: 'RUNNING' }],
    };
    const approvedItem = {
      id: 'item-approved',
      state: 'SUCCEEDED',
      gradingRun: approvedRun,
      batch,
      jobs: [],
    };
    const activeItem = {
      id: 'item-active',
      state: 'GRADING',
      gradingRun: activeRun,
      batch,
      jobs: [{ id: 'job-item-active', state: 'QUEUED' }],
    };
    const conversion = {
      id: 'conversion-local',
      state: 'SUCCEEDED',
      cancellationRequestedAt: null,
      jobs: [{ id: 'job-conversion-active', state: 'RUNNING' }],
      answerEvidence: {
        id: 'evidence-local',
        readiness: 'READY',
        limitationState: 'none',
        limitations: [],
        approvalSnapshots: [],
        gradingRuns: [approvedRun, activeRun],
        batchItems: [approvedItem, activeItem],
      },
      batchItems: [approvedItem, activeItem],
    };
    const tx = {
      documentConversion: { update: vi.fn() },
      answerEvidence: { update: vi.fn() },
      gradingRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      gradingBatchItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([
          { state: 'SUCCEEDED' },
          { state: 'BLOCKED' },
        ]),
      },
      gradingBatch: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      gradingJob: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const db = {
      documentConversion: {
        findMany: vi.fn().mockResolvedValue([conversion]),
      },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    };

    const report = await runMigration(db, {
      mode: 'apply',
      runId: 'stable-run',
    });

    expect(report).toMatchObject({
      candidateCount: 1,
      approvedPreservedCount: 1,
      blockedCount: 1,
      batchCount: 1,
      activeJobCount: 4,
    });
    expect(tx.documentConversion.update).not.toHaveBeenCalled();
    expect(tx.answerEvidence.update).not.toHaveBeenCalled();
    expect(tx.gradingRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['run-active'] } }),
      }),
    );
    expect(tx.gradingBatchItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['item-active'] } }),
      }),
    );
    expect(tx.gradingBatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'PARTIAL', progress: 100 }),
      }),
    );
    expect(tx.gradingJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          batchId: 'batch-1',
          state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] },
        },
        data: expect.objectContaining({ state: 'BLOCKED' }),
      }),
    );
  });
});

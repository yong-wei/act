import { describe, expect, it, vi } from 'vitest';

import {
  bindKonlingCandidateSelectionToolRun,
  completeKonlingCandidateSelectionToolRun,
  KonlingCandidateSelectionToolRunError,
} from '@/lib/konling-candidate-selection-tool-run';

const input = {
  toolRunId: 'run-1', actorUserId: 'student-1', targetUserId: 'student-1',
  batchId: 'batch-1', candidateId: 'candidate-1', pathId: 'path-1',
  goalId: 'goal-1', selectedOptionId: 'option-1', selectedStyleId: 'guided',
  studentSafeRationale: 'Selected the guided path.', idempotencyKey: 'choice-1',
};

function runningRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1', status: 'running', startedAt: new Date('2026-08-05T00:00:00Z'),
    inputSummary: { batchId: 'batch-1', candidateId: 'candidate-1', pathId: 'path-1', goalId: 'goal-1' },
    outputSummary: null,
    ...overrides,
  };
}

describe('candidate selection AgentToolRun commit', () => {
  it('binds the resolved natural-language candidate before the choice mutation', async () => {
    const db = {
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(runningRun({
          inputSummary: { batchId: 'batch-1', naturalLanguageIntent: '挑战冲刺路径' },
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await bindKonlingCandidateSelectionToolRun(db, input);
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'run-1', status: 'running', inputSummary: { equals: expect.any(Object) } }),
      data: {
        inputSummary: expect.objectContaining({
          batchId: 'batch-1', candidateId: 'candidate-1', pathId: 'path-1', goalId: 'goal-1',
        }),
      },
    }));
  });

  it('rejects rebinding a running tool run to a different candidate', async () => {
    const db = { agentToolRun: { findFirst: vi.fn().mockResolvedValue(runningRun()), updateMany: vi.fn() } };
    await expect(bindKonlingCandidateSelectionToolRun(db, { ...input, candidateId: 'candidate-2' }))
      .rejects.toBeInstanceOf(KonlingCandidateSelectionToolRunError);
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
  });

  it('converges when an identical candidate binding wins the compare-and-set race', async () => {
    const db = {
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(runningRun({ inputSummary: { batchId: 'batch-1' } }))
          .mockResolvedValueOnce(runningRun()),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    await expect(bindKonlingCandidateSelectionToolRun(db, input)).resolves.toBeUndefined();
    expect(db.agentToolRun.findFirst).toHaveBeenCalledTimes(2);
  });

  it('converges when the same selection completes before a reused run binds', async () => {
    const db = {
      agentToolRun: {
        findFirst: vi.fn().mockResolvedValue(runningRun({ status: 'succeeded' })),
        updateMany: vi.fn(),
      },
    };
    await expect(bindKonlingCandidateSelectionToolRun(db, input)).resolves.toBeUndefined();
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
  });

  it('validates without completing before the governed choice mutation', async () => {
    const db = { agentToolRun: { findFirst: vi.fn().mockResolvedValue(runningRun()), updateMany: vi.fn() } };
    await completeKonlingCandidateSelectionToolRun(db, { ...input, complete: false });
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
  });

  it('completes the same scoped run after the choice mutation succeeds', async () => {
    const db = { agentToolRun: { findFirst: vi.fn().mockResolvedValue(runningRun()), updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    await completeKonlingCandidateSelectionToolRun(db, input);
    expect(db.agentToolRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-1', status: 'running' },
      data: expect.objectContaining({
        status: 'succeeded',
        outputSummary: expect.objectContaining({
          batchId: 'batch-1', candidateId: 'candidate-1', selectedOptionId: 'option-1',
          selectedStyleId: 'guided', studentSafeRationale: 'Selected the guided path.',
        }),
      }),
    }));
  });

  it('converges when an identical completion wins the status update race', async () => {
    const outputSummary = {
      status: 'selected', toolRunId: 'run-1', batchId: 'batch-1', candidateId: 'candidate-1',
      pathId: 'path-1', goalId: 'goal-1', selectedOptionId: 'option-1', selectedStyleId: 'guided',
      studentSafeRationale: 'Selected the guided path.', idempotencyKey: 'choice-1', autoStart: false,
    };
    const db = {
      agentToolRun: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(runningRun())
          .mockResolvedValueOnce(runningRun({ status: 'succeeded', outputSummary })),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    await expect(completeKonlingCandidateSelectionToolRun(db, input)).resolves.toBeUndefined();
    expect(db.agentToolRun.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rejects a mismatched run before any completion write', async () => {
    const db = { agentToolRun: { findFirst: vi.fn().mockResolvedValue(runningRun({ inputSummary: { batchId: 'batch-2' } })), updateMany: vi.fn() } };
    await expect(completeKonlingCandidateSelectionToolRun(db, { ...input, complete: false }))
      .rejects.toBeInstanceOf(KonlingCandidateSelectionToolRunError);
    expect(db.agentToolRun.updateMany).not.toHaveBeenCalled();
  });
});

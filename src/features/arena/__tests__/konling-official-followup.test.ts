import { describe, expect, it, vi } from 'vitest';

import {
  buildArenaOfficialKonlingSuggestion,
  createArenaOfficialKonlingFollowup,
  readArenaOfficialRevisit,
} from '../student/konling-official-followup';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

function submission(input: {
  id: string;
  submittedAt: string;
  valid: boolean;
  score?: number;
  failures?: string[];
  params?: Record<string, number>;
  taskId?: string;
  classId?: string;
  metrics?: Record<string, number>;
}): ArenaSubmissionRecord {
  return {
    id: input.id,
    userId: 'student-1',
    taskId: input.taskId ?? 'task-1',
    classId: input.classId,
    studentLabel: '学生',
    artifactHash: input.id,
    artifact: { id: input.id, taskId: input.taskId ?? 'task-1', method: 'pid', params: input.params ?? {}, createdAt: input.submittedAt },
    evaluation: {
      taskId: input.taskId ?? 'task-1',
      artifact: {} as ArenaSubmissionRecord['artifact'],
      valid: input.valid,
      score: input.score ?? 50,
      metrics: input.metrics ?? {},
      satisfaction: {},
      hardConstraintResults: (input.failures ?? []).map((label) => ({ id: label, label, passed: false, reason: `${label} 未通过` })),
      penalties: [],
      explanation: [],
    },
    submittedAt: input.submittedAt,
    reusedEvaluation: false,
  } as ArenaSubmissionRecord;
}

describe('Arena official Konling followup', () => {
  it('prioritizes unchanged failed constraints after three parameter changes', () => {
    const history = [
      submission({ id: 's1', submittedAt: '2026-08-01T00:00:00.000Z', valid: false, failures: ['稳定性'], params: { kp: 1 } }),
      submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: false, failures: ['稳定性'], params: { kp: 2 } }),
      submission({ id: 's3', submittedAt: '2026-08-03T00:00:00.000Z', valid: false, failures: ['稳定性'], params: { kp: 3 } }),
    ];

    expect(buildArenaOfficialKonlingSuggestion(history[2]!, history)?.kind).toBe('stagnation');
  });

  it('uses only same-task official history and reports current constraint evidence', () => {
    const first = submission({ id: 's1', submittedAt: '2026-08-01T00:00:00.000Z', valid: false, failures: ['超调'] });
    const current = submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: false, failures: ['稳态误差'] });
    const otherTask = submission({ id: 's3', taskId: 'task-2', submittedAt: '2026-08-03T00:00:00.000Z', valid: false, failures: ['超调'] });

    const suggestion = buildArenaOfficialKonlingSuggestion(current, [first, otherTask, current]);

    expect(suggestion?.kind).toBe('continuous-failure');
    expect(suggestion?.evidence.join(' ')).toContain('稳态误差');
  });

  it('does not use another class history for the same task', () => {
    const first = submission({ id: 's1', classId: 'class-a', submittedAt: '2026-08-01T00:00:00.000Z', valid: false, failures: ['超调'] });
    const current = submission({ id: 's2', classId: 'class-b', submittedAt: '2026-08-02T00:00:00.000Z', valid: false, failures: ['稳态误差'] });

    expect(buildArenaOfficialKonlingSuggestion(current, [first, current])?.kind).toBe('constraint-violation');
  });

  it('does not create a duplicate suggestion for the same formal evaluation', async () => {
    const current = submission({ id: 's1', submittedAt: '2026-08-01T00:00:00.000Z', valid: false, failures: ['稳定性'] });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing', evidence: {}, createdAt: new Date() }),
        create: vi.fn(),
      },
    };

    const result = await createArenaOfficialKonlingFollowup({ db, submission: current, history: [current] });

    expect(result?.id).toBe('existing');
    expect(db.aIIntervention.create).not.toHaveBeenCalled();
  });

  it('returns the concurrently created suggestion after the partial unique index rejects a duplicate', async () => {
    const current = submission({ id: 's1', submittedAt: '2026-08-01T00:00:00.000Z', valid: false, failures: ['稳定性'] });
    const duplicate = Object.assign(new Error('duplicate'), { code: 'P2002' });
    const db = {
      aIIntervention: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'concurrent', evidence: {}, createdAt: new Date() }),
        create: vi.fn().mockRejectedValue(duplicate),
      },
    };

    await expect(createArenaOfficialKonlingFollowup({ db, submission: current, history: [current] })).resolves.toMatchObject({ id: 'concurrent' });
  });

  it('compares a later formal evaluation with the advice baseline', async () => {
    const current = submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: true, score: 80, metrics: { settlingTime: 2 } });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          evidence: {
            sourceSubmission: {
              score: 60,
              metrics: { settlingTime: 3 },
              hardConstraintResults: [{ id: '稳定性', label: '稳定性', passed: false }],
            },
          },
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await expect(readArenaOfficialRevisit({ db, submission: current })).resolves.toContain('调节时间 -1');
    expect(db.aIIntervention.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'advice-1' }),
      data: expect.objectContaining({
        outcome: expect.objectContaining({
          status: 'revisited',
          revisitedBySubmissionId: 's2',
        }),
      }),
    }));
  });

  it('still revisits after helpfulness feedback occupies outcome', async () => {
    const current = submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: true, score: 80, metrics: { settlingTime: 2 } });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: { feedback: 'rated', helpful: true, recordedAt: '2026-08-01T00:30:00.000Z' },
          evidence: {
            sourceSubmission: {
              score: 60,
              metrics: { settlingTime: 3 },
              hardConstraintResults: [{ id: '稳定性', label: '稳定性', passed: false }],
            },
          },
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await expect(readArenaOfficialRevisit({ db, submission: current })).resolves.toContain('调节时间 -1');
    expect(db.aIIntervention.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'advice-1' }),
      data: {
        outcome: expect.objectContaining({
          status: 'revisited',
          revisitedBySubmissionId: 's2',
          claimedSubmittedAt: '2026-08-02T00:00:00.000Z',
        }),
      },
    }));
  });

  it('does not reopen an already revisited official follow-up', async () => {
    const current = submission({ id: 's3', submittedAt: '2026-08-03T00:00:00.000Z', valid: true, score: 82 });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: { status: 'revisited', revisitedBySubmissionId: 's2' },
          evidence: { sourceSubmission: { score: 60, metrics: {}, hardConstraintResults: [] } },
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(readArenaOfficialRevisit({ db, submission: current })).resolves.toBeNull();
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
  });

  it('does not let a later concurrent submission steal an earlier successor revisit', async () => {
    const earlier = submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: true, score: 70 });
    const later = submission({ id: 's3', submittedAt: '2026-08-03T00:00:00.000Z', valid: true, score: 80 });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: { helpful: true },
          evidence: { sourceSubmission: { score: 60, metrics: {}, hardConstraintResults: [] } },
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    await expect(readArenaOfficialRevisit({
      db,
      submission: later,
      history: [earlier, later],
    })).resolves.toBeNull();
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
  });

  it('returns null when another request already claimed the revisit', async () => {
    const current = submission({ id: 's2', submittedAt: '2026-08-02T00:00:00.000Z', valid: true, score: 80, metrics: { settlingTime: 2 } });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: null,
          evidence: { sourceSubmission: { score: 60, metrics: { settlingTime: 3 }, hardConstraintResults: [] } },
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(readArenaOfficialRevisit({ db, submission: current })).resolves.toBeNull();
  });

  it('does not let a later persisted submission close the round while an earlier reserved successor is pending', async () => {
    const later = submission({ id: 's3', submittedAt: '2026-08-03T00:00:00.000Z', valid: true, score: 80 });
    const queryRaw = vi.fn().mockResolvedValue([{
      id: 'reservation-s2',
      submissionId: null,
      lockedUntil: new Date(Date.now() + 30_000),
    }]);
    const executeRaw = vi.fn().mockResolvedValue(1);
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: { helpful: true },
          evidence: {
            sourceSubmission: {
              score: 60,
              submittedAt: '2026-08-01T00:00:00.000Z',
              metrics: {},
              hardConstraintResults: [],
            },
          },
        }),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      arenaSubmission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $queryRaw: queryRaw,
      $executeRaw: executeRaw,
    };

    await expect(readArenaOfficialRevisit({
      db,
      submission: later,
      history: [later],
    })).resolves.toBeNull();
    expect(queryRaw).toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(db.aIIntervention.updateMany).not.toHaveBeenCalled();
    expect(db.arenaSubmission.findFirst).not.toHaveBeenCalled();
  });

  it('uses a locked database check so a later submission cannot claim an earlier successor', async () => {
    const later = submission({ id: 's3', submittedAt: '2026-08-03T00:00:00.000Z', valid: true, score: 80 });
    const db = {
      aIIntervention: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'advice-1',
          createdAt: new Date('2026-08-01T00:00:00.000Z'),
          outcome: { status: 'revisited', claimedSubmittedAt: '2026-08-03T00:00:00.000Z' },
          evidence: {
            sourceSubmission: {
              score: 60,
              submittedAt: '2026-08-01T00:00:00.000Z',
              metrics: {},
              hardConstraintResults: [],
            },
          },
        }),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      arenaSubmission: {
        findFirst: vi.fn().mockResolvedValue({ id: 's2' }),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
    };

    await expect(readArenaOfficialRevisit({
      db,
      submission: later,
      history: [later],
    })).resolves.toBeNull();
    expect(db.arenaSubmission.findFirst).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});

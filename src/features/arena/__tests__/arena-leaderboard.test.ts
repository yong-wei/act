import { describe, expect, it, vi } from 'vitest';

import { hashControllerArtifact } from '../submissions/artifact-hash';
import { createArenaSubmission } from '../submissions/submission-service';
import { createPersistedArenaSubmission } from '../submissions/persistence';
import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
import { buildArenaTaskStats } from '../stats';
import { ARENA_CORE_EVENT_TYPES, buildArenaCoreEvent } from '../telemetry';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import type { ControllerArtifact } from '../types';

const pidArtifact: ControllerArtifact = {
  id: 'artifact-a',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-10T10:00:00.000Z',
};

describe('arena submissions and leaderboards', () => {
  it('hashes controller artifacts independent of parameter key order', () => {
    const reordered: ControllerArtifact = {
      ...pidArtifact,
      params: { kd: 0.35, kp: 2.4, ki: 0.8 },
    };

    expect(hashControllerArtifact(pidArtifact)).toBe(hashControllerArtifact(reordered));
    expect(hashControllerArtifact(pidArtifact)).toMatch(/^artifact-[a-f0-9]{64}$/);
  });

  it('reuses duplicate evaluation results for identical task and controller artifact', () => {
    const first = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-b' },
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });

    expect(second.reusedEvaluation).toBe(true);
    expect(second.evaluation.score).toBe(first.evaluation.score);
    expect(second.artifactHash).toBe(first.artifactHash);
  });

  it('orders main and method leaderboards by score and stable tie breakers', () => {
    const good = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const weaker = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-c',
        params: { kp: 0.8, ki: 0.1, kd: 0 },
      },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [good],
    });

    const main = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'main' });
    const method = buildArenaLeaderboard([weaker, good], { taskId: 'task-second-order-lead-pid', type: 'method', method: 'pid' });

    expect(main.entries[0]?.studentLabel).toBe('学生甲');
    expect(main.entries[0]?.rank).toBe(1);
    expect(method.entries).toHaveLength(2);
    expect(method.entries.every((entry) => entry.method === 'pid')).toBe(true);
  });

  it('uses leaderboard policy metric tie breakers before submitted time', () => {
    const first = createArenaSubmission({
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        ...pidArtifact,
        id: 'artifact-tie-a',
        taskId: 'task-integrator-low-frequency-balance',
        params: { kp: 1.6, ki: 0.4, kd: 0.12 },
      },
      studentLabel: '误差较大',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = createArenaSubmission({
      taskId: 'task-integrator-low-frequency-balance',
      artifact: {
        ...pidArtifact,
        id: 'artifact-tie-b',
        taskId: 'task-integrator-low-frequency-balance',
        params: { kp: 1.8, ki: 0.6, kd: 0.12 },
      },
      studentLabel: '误差较小',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });
    first.evaluation.score = 80;
    second.evaluation.score = 80;
    first.evaluation.metrics.steadyStateError = 0.08;
    second.evaluation.metrics.steadyStateError = 0.03;

    const leaderboard = buildArenaLeaderboard([first, second], {
      taskId: 'task-integrator-low-frequency-balance',
      type: 'main',
    });

    expect(leaderboard.entries[0]?.studentLabel).toBe('误差较小');
  });

  it('keeps only each student best submission on the main leaderboard', () => {
    const first = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-repeat-a',
        params: { kp: 0.8, ki: 0.1, kd: 0 },
      },
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const improved = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });
    const other = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: {
        ...pidArtifact,
        id: 'artifact-repeat-b',
        params: { kp: 1.2, ki: 0.2, kd: 0.05 },
      },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:03:00.000Z',
      existingSubmissions: [first, improved],
    });

    const leaderboard = buildArenaLeaderboard([
      { ...first, userId: 'student-a' },
      { ...improved, userId: 'student-a' },
      { ...first, userId: 'student-a' },
      { ...other, userId: 'student-b' },
    ], { taskId: 'task-second-order-lead-pid', type: 'main' });

    expect(leaderboard.entries).toHaveLength(2);
    expect(leaderboard.entries.map((entry) => entry.studentLabel)).toContain('学生甲');
    expect(leaderboard.entries.find((entry) => entry.studentLabel === '学生甲')?.submissionId).toBe(improved.id);
  });

  it('defines core Arena telemetry events compatible with the L0 event boundary', () => {
    expect(ARENA_CORE_EVENT_TYPES).toEqual([
      'arena_challenge_open',
      'arena_workspace_start',
      'arena_simulation_run',
      'arena_submit',
      'arena_leaderboard_view',
    ]);

    expect(buildArenaCoreEvent('arena_submit', {
      taskId: 'task-second-order-lead-pid',
      score: 88.6,
    })).toMatchObject({
      type: 'arena_submit',
      resourceKey: 'arena:task-second-order-lead-pid',
      priority: 'core',
    });
    expect(isCoreEvent('arena_submit')).toBe(true);
    expect(isCoreEvent('arena_leaderboard_view')).toBe(true);
  });

  it('reuses official evaluations from the persistence store instead of route-local memory', async () => {
    const calls: string[] = [];
    const store = {
      findEvaluationByHash: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'eval-existing',
          taskId: pidArtifact.taskId,
          artifactHash: hashControllerArtifact(pidArtifact),
          protocolVersion: 'whitebox-v1',
          result: createArenaSubmission({
            taskId: pidArtifact.taskId,
            artifact: pidArtifact,
            studentLabel: '学生甲',
            submittedAt: '2026-05-10T10:01:00.000Z',
            existingSubmissions: [],
          }).evaluation,
          completedAt: '2026-05-10T10:01:00.000Z',
        }),
      createEvaluation: vi.fn(async (evaluation) => {
        calls.push('createEvaluation');
        return { ...evaluation, id: 'eval-created' };
      }),
      upsertArtifact: vi.fn(async (artifact) => {
        calls.push('upsertArtifact');
        return { ...artifact, id: 'artifact-row' };
      }),
      createSubmission: vi.fn(async (submission) => {
        calls.push('createSubmission');
        return { ...submission, id: `stored-${calls.length}` };
      }),
    };

    const first = await createPersistedArenaSubmission({
      taskId: pidArtifact.taskId,
      artifact: pidArtifact,
      userId: 'student-1',
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      store,
    });
    const second = await createPersistedArenaSubmission({
      taskId: pidArtifact.taskId,
      artifact: { ...pidArtifact, id: 'artifact-duplicate' },
      userId: 'student-1',
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:02:00.000Z',
      store,
    });

    expect(first.reusedEvaluation).toBe(false);
    expect(second.reusedEvaluation).toBe(true);
    expect(store.findEvaluationByHash).toHaveBeenCalledWith(pidArtifact.taskId, hashControllerArtifact(pidArtifact), 'whitebox-v1');
    expect(store.createEvaluation).toHaveBeenCalledTimes(1);
    expect(store.createEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      protocolVersion: 'whitebox-v1',
    }));
    expect(store.createSubmission).toHaveBeenCalledTimes(2);
  });

  it('builds task stats from real submissions and leaves empty tasks without fake scores', () => {
    const first = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: pidArtifact,
      studentLabel: '学生甲',
      submittedAt: '2026-05-10T10:01:00.000Z',
      existingSubmissions: [],
    });
    const second = createArenaSubmission({
      taskId: 'task-second-order-lead-pid',
      artifact: { ...pidArtifact, id: 'artifact-stats-b', params: { kp: 1.1, ki: 0.2, kd: 0.08 } },
      studentLabel: '学生乙',
      submittedAt: '2026-05-10T10:02:00.000Z',
      existingSubmissions: [first],
    });

    const stats = buildArenaTaskStats([first, second], [
      'task-second-order-lead-pid',
      'task-ship-roll-comfort',
    ]);

    expect(stats['task-second-order-lead-pid']).toMatchObject({
      participantCount: 2,
      submissionCount: 2,
    });
    expect(stats['task-second-order-lead-pid']?.topScore).toBe(Math.max(first.evaluation.score, second.evaluation.score));
    expect(stats['task-ship-roll-comfort']).toEqual({
      participantCount: 0,
      submissionCount: 0,
      topScore: null,
    });
  });
});

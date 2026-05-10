import { describe, expect, it } from 'vitest';

import { hashControllerArtifact } from '../submissions/artifact-hash';
import { createArenaSubmission } from '../submissions/submission-service';
import { buildArenaLeaderboard } from '../leaderboards/leaderboard';
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
});

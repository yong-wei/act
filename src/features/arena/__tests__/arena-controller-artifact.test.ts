import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildControllerArtifactFromParams,
  getEvaluableControllerMethods,
} from '../submissions/controller-artifact-builder';
import type { ChallengeTask } from '../types';

const baseTask: ChallengeTask = {
  id: 'task-second-order-lead-pid',
  objectId: 'plant-second-order-underdamped',
  title: '二阶对象快速稳定挑战',
  goal: '缩短调节时间，同时限制超调量和稳态误差。',
  difficulty: '基础',
  allowedMethods: ['serial-compensator', 'pid'],
  metricProfileId: 'metric-whitebox-time-domain-balanced',
  leaderboardPolicyId: 'leaderboard-whitebox-default',
  leaderboardTypes: ['main', 'method', 'metric'],
  primaryMetrics: ['settlingTime', 'overshoot', 'steadyStateError', 'itae'],
  workspaceMode: 'multi-representation-linkage',
  homeworkPolicy: '可作为作业挑战',
  homeworkEligible: true,
  practiceMode: 'open',
};

describe('arena controller artifact builder', () => {
  it('builds PID controller artifacts from string inputs', () => {
    const artifact = buildControllerArtifactFromParams({
      task: baseTask,
      method: 'pid',
      values: { kp: '2.4', ki: '0.8', kd: '0.35' },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: baseTask.id,
      method: 'pid',
      params: { kp: 2.4, ki: 0.8, kd: 0.35 },
      createdAt: '2026-05-10T10:00:00.000Z',
    });
  });

  it('builds serial compensator artifacts from gain-zero-pole inputs', () => {
    const artifact = buildControllerArtifactFromParams({
      task: baseTask,
      method: 'serial-compensator',
      values: { gain: '3', zero: '1.2', pole: '6' },
      now: '2026-05-10T10:00:00.000Z',
    });

    expect(artifact).toMatchObject({
      taskId: baseTask.id,
      method: 'serial-compensator',
      params: { gain: 3, zero: 1.2, pole: 6 },
    });
  });

  it('rejects non-finite parameters before calling the official evaluator', () => {
    expect(() => buildControllerArtifactFromParams({
      task: baseTask,
      method: 'serial-compensator',
      values: { gain: '3', zero: 'bad', pole: '6' },
      now: '2026-05-10T10:00:00.000Z',
    })).toThrow('zero 必须是有限数字');
  });

  it('only exposes methods supported by the current official evaluator', () => {
    expect(getEvaluableControllerMethods({
      ...baseTask,
      allowedMethods: ['composite-compensation', 'serial-compensator'],
    })).toEqual(['serial-compensator']);
    expect(getEvaluableControllerMethods({
      ...baseTask,
      allowedMethods: ['black-box-control'],
    })).toEqual([]);
  });

  it('keeps the submission panel wired through the controller artifact builder', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/arena-submission-panel.tsx'),
      'utf8',
    );

    expect(source).toContain('buildControllerArtifactFromParams');
    expect(source).toContain('getEvaluableControllerMethods');
    expect(source).toContain('sendArenaCoreEvent');
    expect(source).toContain("'arena_controller_save'");
    expect(source).toContain("'arena_submit'");
    expect(source).toContain("'arena_evaluation_complete'");
    expect(source).toContain('JSON.stringify({ taskId: task.id, artifact })');
    expect(source).not.toContain('提交 PID 控制器');
  });

  it('mounts the submission panel based on current evaluator-supported methods', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/challenge-detail.tsx'),
      'utf8',
    );

    expect(source).toContain('getEvaluableControllerMethods(task).length > 0');
    expect(source).toContain('<ArenaChallengeTelemetry');
    expect(source).toContain('<ArenaWorkspaceLink');
    expect(source).toContain('<ArenaSubmissionPanel task={task} initialSubmissions={submissions} />');
  });
});

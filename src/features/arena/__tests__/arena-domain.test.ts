import { describe, expect, it } from 'vitest';

import {
  ARENA_CHALLENGE_OBJECTS,
  ARENA_CHALLENGE_TASKS,
  ARENA_LEADERBOARD_POLICIES,
  ARENA_METRIC_PROFILES,
  getArenaChallengeObject,
  getArenaChallengeTask,
} from '../data/seed-challenges';
import type { ChallengeTask } from '../types';

describe('arena domain model', () => {
  it('keeps controlled objects separate from challenge tasks', () => {
    expect(ARENA_CHALLENGE_OBJECTS.length).toBeGreaterThanOrEqual(8);
    expect(ARENA_CHALLENGE_TASKS.length).toBeGreaterThanOrEqual(2);

    for (const object of ARENA_CHALLENGE_OBJECTS) {
      expect(object).not.toHaveProperty('leaderboardPolicyId');
      expect(object).not.toHaveProperty('metricProfileId');
    }

    for (const task of ARENA_CHALLENGE_TASKS) {
      expect(getArenaChallengeObject(task.objectId)?.id).toBe(task.objectId);
      expect(task.metricProfileId).toMatch(/^metric-/);
      expect(task.leaderboardPolicyId).toMatch(/^leaderboard-/);
      expect('participantCount' in task).toBe(false);
      expect('topScore' in task).toBe(false);
    }
  });

  it('defines task methods, metric profiles, and leaderboard policies explicitly', () => {
    const methods = new Set(ARENA_CHALLENGE_TASKS.flatMap((task) => task.allowedMethods));

    expect(methods.has('serial-compensator')).toBe(true);
    expect(methods.has('pid')).toBe(true);

    for (const task of ARENA_CHALLENGE_TASKS) {
      expect(task.primaryMetrics.length).toBeGreaterThanOrEqual(4);
      expect(task.primaryMetrics.length).toBeLessThanOrEqual(6);
      expect(task.leaderboardTypes).toContain('main');
      expect(task.leaderboardTypes.length).toBeGreaterThanOrEqual(3);
      expect(typeof task.homeworkEligible).toBe('boolean');
      expect(['open', 'guided', 'project']).toContain(task.practiceMode);
    }
  });

  it('can resolve a task by id and preserve task-first workspace routing', () => {
    const task = getArenaChallengeTask('task-second-order-lead-pid') as ChallengeTask;

    expect(task.objectId).toBe('plant-second-order-underdamped');
    expect(task.workspaceMode).toBe('multi-representation-linkage');
    expect(task.goal).toContain('调节时间');
  });

  it('covers every required object source with task and evaluation policy records', () => {
    const taskSources = new Set(
      ARENA_CHALLENGE_TASKS
        .map((task) => getArenaChallengeObject(task.objectId)?.source)
        .filter(Boolean),
    );

    expect(Array.from(taskSources)).toEqual(expect.arrayContaining([
      'typical',
      'homework',
      'control-odyssey',
      'virtual-simulation',
    ]));
    expect(ARENA_CHALLENGE_TASKS.length).toBeGreaterThanOrEqual(8);
    expect(ARENA_METRIC_PROFILES.map((profile) => profile.id)).toEqual(expect.arrayContaining([
      'metric-whitebox-time-domain-balanced',
      'metric-homework-margin-balanced',
      'metric-odyssey-growth',
      'metric-virtual-blackbox-closed-loop',
    ]));
    expect(ARENA_LEADERBOARD_POLICIES.flatMap((policy) => policy.types)).toEqual(expect.arrayContaining([
      'main',
      'method',
      'metric',
      'pareto',
      'class',
      'season',
    ]));
  });

  it('allows black-box virtual simulation objects without exposing transfer functions', () => {
    const blackBoxObject = getArenaChallengeObject('plant-cruise-roll-blackbox');
    const blackBoxTask = getArenaChallengeTask('task-cruise-roll-blackbox-identification');

    expect(blackBoxObject?.visibility).toBe('black-box');
    expect(blackBoxObject?.model).toBeUndefined();
    expect(blackBoxObject?.adapterType).toBe('virtual-simulation');
    expect(blackBoxTask?.workspaceMode).toBe('black-box-identification');
    expect(blackBoxTask?.allowedMethods).toContain('black-box-control');
  });

  it('defines a bounded MPC advanced-method task with hidden scenario ranking', () => {
    const mpcTask = getArenaChallengeTask('task-ship-roll-mpc-hidden-scenarios');

    expect(mpcTask?.allowedMethods).toEqual(['mpc']);
    expect(mpcTask?.workspaceMode).toBe('predictive-control');
    expect(mpcTask?.leaderboardTypes).toContain('method');
    expect(mpcTask?.primaryMetrics).toContain('hiddenScenarioWorst');
    expect(ARENA_METRIC_PROFILES.find((profile) => profile.id === mpcTask?.metricProfileId)?.hardConstraints)
      .toContain('hidden_scenarios_passed');
  });
});

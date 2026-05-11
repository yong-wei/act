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

  it('keeps task primary metrics aligned with ranking metric profiles', () => {
    for (const task of ARENA_CHALLENGE_TASKS) {
      const profile = ARENA_METRIC_PROFILES.find((item) => item.id === task.metricProfileId);
      const rankingMetricIds = new Set(profile?.rankingMetrics.map((metric) => metric.id) ?? []);

      for (const metricId of task.primaryMetrics) {
        expect(rankingMetricIds.has(metricId), `${task.id} primary metric ${metricId} must be rankable`).toBe(true);
      }
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

  it('defines a bounded optimization-tuning task for robust PID design', () => {
    const methods = new Set(ARENA_CHALLENGE_TASKS.flatMap((task) => task.allowedMethods));
    const optimizationTask = getArenaChallengeTask('task-ship-roll-optimized-pid-robust');

    expect(methods.has('optimized-pid')).toBe(true);
    expect(optimizationTask?.allowedMethods).toEqual(['optimized-pid']);
    expect(optimizationTask?.workspaceMode).toBe('predictive-control');
    expect(optimizationTask?.primaryMetrics).toContain('hiddenScenarioWorst');
    expect(ARENA_METRIC_PROFILES.find((profile) => profile.id === optimizationTask?.metricProfileId)?.diagnosticMetrics)
      .toContain('optimizationBudget');
  });

  it('covers unstable typical plants with a stabilization challenge', () => {
    const unstableObject = getArenaChallengeObject('plant-unstable-first-order');
    const stabilizationTask = getArenaChallengeTask('task-unstable-first-order-stabilization');

    expect(unstableObject?.source).toBe('typical');
    expect(unstableObject?.visibility).toBe('white-box');
    expect(unstableObject?.model?.display).toContain('s-1');
    expect(stabilizationTask?.objectId).toBe('plant-unstable-first-order');
    expect(stabilizationTask?.title).toContain('镇定');
    expect(stabilizationTask?.allowedMethods).toEqual(expect.arrayContaining(['serial-compensator', 'pid']));
    expect(stabilizationTask?.primaryMetrics).toEqual(expect.arrayContaining(['settlingTime', 'overshoot']));
  });

  it('defines a standalone robust disturbance challenge with hidden-scenario scoring', () => {
    const robustTask = getArenaChallengeTask('task-ship-roll-robust-disturbance');
    const robustProfile = ARENA_METRIC_PROFILES.find((profile) => profile.id === robustTask?.metricProfileId);

    expect(robustTask?.objectId).toBe('plant-ship-roll-whitebox');
    expect(robustTask?.title).toContain('鲁棒');
    expect(robustTask?.allowedMethods).toEqual(expect.arrayContaining(['serial-compensator', 'pid']));
    expect(robustTask?.leaderboardTypes).toEqual(expect.arrayContaining(['main', 'method', 'metric', 'pareto']));
    expect(robustTask?.primaryMetrics).toEqual(expect.arrayContaining(['hiddenScenarioWorst', 'controlEnergy']));
    expect(robustProfile?.hardConstraints).toContain('control_not_saturated');
    expect(robustProfile?.hardConstraints).toContain('hidden_scenarios_passed');
    expect(robustProfile?.rankingMetrics.map((metric) => metric.id)).toEqual(expect.arrayContaining([
      'hiddenScenarioWorst',
      'settlingTime',
      'controlEnergy',
      'overshoot',
    ]));
  });
});

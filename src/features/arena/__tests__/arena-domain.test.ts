import { describe, expect, it } from 'vitest';

import {
  ARENA_CHALLENGE_OBJECTS,
  ARENA_CHALLENGE_TASKS,
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
});

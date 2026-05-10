import { describe, expect, it } from 'vitest';

import { filterArenaChallengeTasks } from '../filtering';
import { ARENA_CHALLENGE_TASKS } from '../data/seed-challenges';

describe('arena task filtering', () => {
  it('filters by source, method, difficulty, and visibility without mutating seed tasks', () => {
    const result = filterArenaChallengeTasks(ARENA_CHALLENGE_TASKS, {
      source: 'typical',
      method: 'pid',
      difficulty: '基础',
      visibility: 'white-box',
    });

    expect(result.map((task) => task.id)).toEqual(['task-second-order-lead-pid']);
    expect(ARENA_CHALLENGE_TASKS.length).toBeGreaterThan(1);
  });

  it('filters homework-capable tasks and leaderboard visibility', () => {
    const result = filterArenaChallengeTasks(ARENA_CHALLENGE_TASKS, {
      homework: 'homework-capable',
      leaderboard: 'class',
    });

    expect(result.map((task) => task.id)).toContain('task-integrator-low-frequency-balance');
    expect(result.every((task) => task.leaderboardTypes.includes('class'))).toBe(true);
  });

  it('keeps homework and open-practice filters independent of display wording', () => {
    const renamed = ARENA_CHALLENGE_TASKS.map((task) => ({
      ...task,
      homeworkPolicy: task.homeworkEligible ? '课程评价候选' : '项目展示候选',
    }));

    expect(filterArenaChallengeTasks(renamed, { homework: 'homework-capable' }).map((task) => task.id)).toContain(
      'task-integrator-low-frequency-balance',
    );
    expect(filterArenaChallengeTasks(renamed, { homework: 'open-practice' }).map((task) => task.id)).toEqual([
      'task-second-order-lead-pid',
    ]);
  });

  it('searches by object name, task title, goal, and related knowledge', () => {
    const result = filterArenaChallengeTasks(ARENA_CHALLENGE_TASKS, {
      query: '横摇 舒适度',
    });

    expect(result.map((task) => task.id)).toEqual(['task-ship-roll-comfort']);
  });
});

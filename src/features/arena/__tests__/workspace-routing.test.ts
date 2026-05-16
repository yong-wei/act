import { describe, expect, it } from 'vitest';

import { ARENA_CHALLENGE_TASKS, getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import { getArenaWorkspaceHref } from '../workspace-routing';

function routeFor(taskId: string, params?: Record<string, string>) {
  const task = getArenaChallengeTask(taskId);
  expect(task).toBeDefined();
  const object = getArenaChallengeObject(task!.objectId);
  expect(object).toBeDefined();
  const href = getArenaWorkspaceHref(task!, object, params);
  return new URL(href, 'https://example.edu');
}

describe('Arena workspace routing', () => {
  it('routes white-box, black-box, block-diagram, and predictive tasks to the unified control workbench', () => {
    const cases = [
      ['task-second-order-lead-pid', 'multi-representation-linkage'],
      ['task-cruise-roll-blackbox-identification', 'black-box-identification'],
      ['task-third-order-block-diagram', 'block-diagram-workbench'],
      ['task-ship-roll-mpc-hidden-scenarios', 'predictive-control'],
    ] as const;

    for (const [taskId, preset] of cases) {
      const url = routeFor(taskId);

      expect(url.pathname).toBe('/interactive-learning/control-workbench');
      expect(url.searchParams.get('arenaTask')).toBe(taskId);
      expect(url.searchParams.get('preset')).toBe(preset);
    }
  });

  it('keeps Control Odyssey tasks on the dedicated Odyssey route', () => {
    const url = routeFor('task-odyssey-level-one-growth');

    expect(url.pathname).toBe('/interactive-learning/control-odyssey');
    expect(url.searchParams.get('arenaTask')).toBe('task-odyssey-level-one-growth');
    expect(url.searchParams.get('preset')).toBeNull();
  });

  it('preserves publication and caller query parameters without allowing arenaTask override', () => {
    const url = routeFor('task-second-order-lead-pid', {
      publicationId: 'publication-a',
      classId: 'class-a',
      seasonId: 'season-a',
      arenaTask: 'forged-task',
    });

    expect(url.pathname).toBe('/interactive-learning/control-workbench');
    expect(url.searchParams.get('arenaTask')).toBe('task-second-order-lead-pid');
    expect(url.searchParams.get('publicationId')).toBe('publication-a');
    expect(url.searchParams.get('classId')).toBe('class-a');
    expect(url.searchParams.get('seasonId')).toBe('season-a');
    expect(url.searchParams.get('preset')).toBe('multi-representation-linkage');
  });

  it('keeps every non-Odyssey Arena task on the unified control workbench by default', () => {
    for (const task of ARENA_CHALLENGE_TASKS) {
      const object = getArenaChallengeObject(task.objectId);
      const url = new URL(getArenaWorkspaceHref(task, object), 'https://example.edu');

      if (task.workspaceMode === 'control-odyssey' || object?.source === 'control-odyssey') {
        expect(url.pathname).toBe('/interactive-learning/control-odyssey');
        continue;
      }

      expect(url.pathname).toBe('/interactive-learning/control-workbench');
      expect(url.searchParams.get('preset')).toBe(task.workspaceMode);
    }
  });
});

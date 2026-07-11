import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { ARENA_CHALLENGE_TASKS, getArenaChallengeObject, getArenaChallengeTask } from '../data/seed-challenges';
import { getArenaWorkspaceHref } from '../workspace-routing';

const validPathContext = {
  source: 'adaptive-path-center',
  goal: 'control-correction',
  goalId: 'control-correction',
  pathId: 'path-arena',
  nodeId: 'arena-task:task-second-order-lead-pid',
  intent: 'path-execution',
  returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-arena&nodeId=arena-task%3Atask-second-order-lead-pid',
  resourceType: 'arena_task',
};

function routeFor(taskId: string, params?: Record<string, string | undefined>) {
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
    const url = routeFor('task-odyssey-level-one-growth', {
      publicationId: 'publication-odyssey',
    });

    expect(url.pathname).toBe('/interactive-learning/control-odyssey');
    expect(url.searchParams.get('arenaTask')).toBe('task-odyssey-level-one-growth');
    expect(url.searchParams.get('publicationId')).toBe('publication-odyssey');
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

  it('preserves normalized adaptive path context alongside publication context', () => {
    const url = routeFor('task-second-order-lead-pid', {
      publicationId: 'publication-a',
      classId: 'class-a',
      seasonId: 'season-a',
      ...validPathContext,
    });

    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      publicationId: 'publication-a',
      classId: 'class-a',
      seasonId: 'season-a',
      ...validPathContext,
      arenaTask: 'task-second-order-lead-pid',
      preset: 'multi-representation-linkage',
    });
  });

  it('drops the complete adaptive path context when task identity or return context is invalid', () => {
    const wrongTask = routeFor('task-second-order-lead-pid', {
      publicationId: 'publication-a',
      ...validPathContext,
      nodeId: 'arena-task:task-cruise-roll-blackbox-identification',
    });
    const externalReturn = routeFor('task-second-order-lead-pid', {
      publicationId: 'publication-a',
      ...validPathContext,
      returnHref: 'https://attacker.example/path',
    });

    for (const url of [wrongTask, externalReturn]) {
      expect(url.searchParams.get('publicationId')).toBe('publication-a');
      expect(url.searchParams.has('source')).toBe(false);
      expect(url.searchParams.has('pathId')).toBe(false);
      expect(url.searchParams.has('nodeId')).toBe(false);
      expect(url.searchParams.has('returnHref')).toBe(false);
    }
  });

  it('omits optional publication context values that are absent', () => {
    const url = routeFor('task-second-order-lead-pid', {
      publicationId: 'publication-a',
      classId: undefined,
      seasonId: undefined,
    });

    expect(url.searchParams.get('publicationId')).toBe('publication-a');
    expect(url.searchParams.has('classId')).toBe(false);
    expect(url.searchParams.has('seasonId')).toBe(false);
    expect(url.href).not.toContain('undefined');
  });

  it('keeps publication, class, and season context wired from challenge detail to workbench', () => {
    const source = readFileSync(
      new URL('../challenge-detail.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain('publicationId, classId, seasonId');
    expect(source).toContain('getArenaWorkspaceHref(task, object, workspaceContext');
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

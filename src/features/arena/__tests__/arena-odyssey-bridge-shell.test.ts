import { describe, expect, it } from 'vitest';

import { buildOdysseyArenaReturnHref, pickViewerBestSubmission } from '../odyssey/odyssey-arena-bridge-shell';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

function submission(input: {
  id: string;
  userId?: string;
  score: number;
}): ArenaSubmissionRecord {
  return {
    id: input.id,
    taskId: 'task-odyssey-level-one-growth',
    userId: input.userId,
    studentLabel: input.userId ?? '匿名',
    artifactHash: `hash-${input.id}`,
    artifact: {
      id: `artifact-${input.id}`,
      taskId: 'task-odyssey-level-one-growth',
      method: 'pid',
      params: {},
      createdAt: '2026-05-17T00:00:00.000Z',
    },
    evaluation: {
      taskId: 'task-odyssey-level-one-growth',
      artifact: {
        id: `artifact-${input.id}`,
        taskId: 'task-odyssey-level-one-growth',
        method: 'pid',
        params: {},
        createdAt: '2026-05-17T00:00:00.000Z',
      },
      valid: true,
      score: input.score,
      metrics: {},
      satisfaction: {},
      hardConstraintResults: [],
      penalties: [],
      explanation: [],
    },
    submittedAt: '2026-05-17T00:00:00.000Z',
    reusedEvaluation: false,
  };
}

describe('Odyssey Arena bridge shell helpers', () => {
  it('preserves publication context on the return link', () => {
    const href = buildOdysseyArenaReturnHref(
      '/arena/challenges/task-odyssey-level-one-growth',
      new URLSearchParams({
        arenaTask: 'task-odyssey-level-one-growth',
        publicationId: 'publication-1',
        classId: 'class-a',
      }),
    );

    expect(href).toBe('/arena/challenges/task-odyssey-level-one-growth?publicationId=publication-1&classId=class-a');
  });

  it('preserves normalized adaptive path context on the challenge return link', () => {
    const href = buildOdysseyArenaReturnHref(
      '/arena/challenges/task-odyssey-level-one-growth',
      new URLSearchParams({
        arenaTask: 'task-odyssey-level-one-growth',
        source: 'adaptive-path-center',
        goal: 'control-correction',
        goalId: 'control-correction',
        pathId: 'path-odyssey',
        nodeId: 'arena-task:task-odyssey-level-one-growth',
        intent: 'path-execution',
        returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-odyssey&nodeId=arena-task%3Atask-odyssey-level-one-growth',
        resourceType: 'arena_task',
      }),
    );

    const url = new URL(href, 'https://example.edu');
    expect(url.searchParams.get('pathId')).toBe('path-odyssey');
    expect(url.searchParams.get('nodeId')).toBe('arena-task:task-odyssey-level-one-growth');
    expect(url.searchParams.get('returnHref')).toContain('/assessment/adaptive-practice?');
  });

  it('does not treat public submissions as current viewer status when viewer is unknown', () => {
    const best = pickViewerBestSubmission([
      submission({ id: 'other-high', userId: 'student-other', score: 98 }),
    ]);

    expect(best).toBeNull();
  });

  it('selects the current viewer best submission only', () => {
    const best = pickViewerBestSubmission([
      submission({ id: 'other-high', userId: 'student-other', score: 98 }),
      submission({ id: 'viewer-low', userId: 'student-viewer', score: 70 }),
      submission({ id: 'viewer-high', userId: 'student-viewer', score: 82 }),
    ], 'student-viewer');

    expect(best?.id).toBe('viewer-high');
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildArenaChallengeSearchParams,
  buildArenaPathCompletionRequest,
  resolveArenaPathLaunchParams,
} from '../arena-path-journey';

function validSearchParams() {
  return new URLSearchParams({
    source: 'adaptive-path-center',
    goal: 'control-correction',
    goalId: 'control-correction',
    pathId: 'path-arena',
    nodeId: 'arena-task:task-second-order-lead-pid',
    intent: 'path-execution',
    returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-arena&nodeId=arena-task%3Atask-second-order-lead-pid',
    resourceType: 'arena_task',
  });
}

describe('Arena adaptive path journey', () => {
  it('uses the first repeated challenge-route value consistently with URLSearchParams.get', () => {
    const params = buildArenaChallengeSearchParams({
      pathId: ['path-first', 'path-forged'],
      publicationId: ['publication-first', 'publication-forged'],
    });

    expect(params.get('pathId')).toBe('path-first');
    expect(params.get('publicationId')).toBe('publication-first');
  });

  it('accepts only a concrete matching Arena task launch context', () => {
    expect(resolveArenaPathLaunchParams(validSearchParams(), 'task-second-order-lead-pid')).toMatchObject({
      pathId: 'path-arena',
      nodeId: 'arena-task:task-second-order-lead-pid',
      resourceType: 'arena_task',
    });

    expect(resolveArenaPathLaunchParams(validSearchParams(), 'task-other')).toBeNull();
  });

  it('builds completion from an opaque server-owned ArenaSubmission id only', () => {
    const request = buildArenaPathCompletionRequest(
      validSearchParams(),
      'task-second-order-lead-pid',
      'arena-submission-1',
    );

    expect(request).toEqual({
      href: '/api/learning-paths/path-arena/execute',
      body: {
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        status: 'completed',
        arenaRef: { id: 'arena-submission-1' },
        idempotencyKey: 'path-arena-submission:path-arena:arena-task:task-second-order-lead-pid:arena-submission-1',
      },
    });
    expect(JSON.stringify(request)).not.toMatch(/score|metrics|hidden|valid/i);
  });

  it('does not build completion for a mismatched task or missing submission', () => {
    expect(buildArenaPathCompletionRequest(validSearchParams(), 'task-other', 'arena-submission-1')).toBeNull();
    expect(buildArenaPathCompletionRequest(validSearchParams(), 'task-second-order-lead-pid', '')).toBeNull();
  });

  it('binds official workbench results by submission id without client score decisions', () => {
    const whitebox = readFileSync(join(process.cwd(), 'src/features/arena/submissions/arena-submission-panel.tsx'), 'utf8');
    const blackbox = readFileSync(join(process.cwd(), 'src/features/control-workbench/presets/blackbox-identification-preset.tsx'), 'utf8');

    expect(whitebox).toContain('useArenaPathSubmissionCompletion');
    expect(whitebox).toContain('completeArenaPath(payload.submission.id)');
    expect(whitebox).not.toMatch(/completeArenaPath\([^)]*(score|valid|metrics)/);

    expect(blackbox).toContain('useArenaOfficialSubmissionPathSync');
    expect(blackbox).toContain('pathSync.synchronize(payload.submission.id)');
    expect(blackbox).not.toMatch(/pathSync\.synchronize\([^)]*(score|valid|metrics)/);
  });

  it('binds Odyssey continuation only from the server-created bridge submission id', () => {
    const game = readFileSync(join(process.cwd(), 'src/resources/interactive-learning/control-odyssey/index.tsx'), 'utf8');
    const recovery = readFileSync(join(process.cwd(), 'src/resources/interactive-learning/control-odyssey/submission-recovery.ts'), 'utf8');
    const action = readFileSync(join(process.cwd(), 'src/app/actions/control-odyssey.ts'), 'utf8');

    expect(action).toContain('arenaSubmissionId = bridgeResult.submission.id');
    expect(game).toContain('completeArenaPath,');
    expect(recovery).toContain('completeArenaPath(submissionResult.arenaSubmissionId)');
    expect(`${game}\n${recovery}`).not.toMatch(/completeArenaPath\([^)]*(finalScore|metrics|gameState)/);
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { selectResourceCompletionHandler } from '@/app/interactive-learning/resources/[id]/completion-boundary';

const resourcePageSource = readFileSync(
  path.join(process.cwd(), 'src/app/interactive-learning/resources/[id]/page.tsx'),
  'utf8',
);
const completionBoundarySource = readFileSync(
  path.join(process.cwd(), 'src/app/interactive-learning/resources/[id]/completion-boundary.ts'),
  'utf8',
);

describe('interactive resource completion boundary', () => {
  it('continues the path for historical resources instead of swallowing errors', async () => {
    const writeError = new Error('completion write failed');
    const continueCompletion = vi.fn().mockRejectedValue(writeError);
    const onComplete = selectResourceCompletionHandler(
      'lesson14-root-locus-precheck',
      continueCompletion,
    );

    await expect(onComplete()).rejects.toBe(writeError);
    expect(continueCompletion).toHaveBeenCalledOnce();
  });

  it('uses the registry ID when the database resource ID differs', async () => {
    const continueCompletion = vi.fn().mockResolvedValue(undefined);
    const databaseResourceId = 'cm-resource-record-123';
    const registryId = 'lesson15-series-precheck';

    expect(databaseResourceId).not.toBe(registryId);
    const onComplete = selectResourceCompletionHandler(registryId, continueCompletion);

    await expect(onComplete()).resolves.toBeUndefined();
    expect(continueCompletion).toHaveBeenCalledOnce();
  });

  it('propagates completion errors and continues the path for series precheck', async () => {
    const writeError = new Error('completion write failed');
    const continueCompletion = vi.fn().mockRejectedValue(writeError);
    const onComplete = selectResourceCompletionHandler(
      'lesson15-series-precheck',
      continueCompletion,
    );

    await expect(onComplete()).rejects.toBe(writeError);
    expect(continueCompletion).toHaveBeenCalledOnce();
  });

  it('propagates completion errors and continues the path for the cruise bridge registry entry', async () => {
    const writeError = new Error('completion write failed');
    const continueCompletion = vi.fn().mockRejectedValue(writeError);
    const onComplete = selectResourceCompletionHandler(
      'lesson13-cruise-bridge',
      continueCompletion,
    );

    await expect(onComplete()).rejects.toBe(writeError);
    expect(continueCompletion).toHaveBeenCalledOnce();
  });

  it('keeps path continue as the shared page contract without registry allowlists', () => {
    expect(resourcePageSource).toContain('continuePathAfterResourceComplete');
    expect(resourcePageSource).toContain('resolveAdaptivePathCompletionContinueHref');
    expect(resourcePageSource).toContain('window.location.assign(continueHref)');
    expect(resourcePageSource).toContain("throw new Error('当前资源不能通过路径完成接口确认进度')");
    expect(resourcePageSource).not.toContain('Failed to write path resource completion');
    expect(completionBoundarySource).not.toContain('STRICT_PATH_CONTINUE_IDS');
    expect(completionBoundarySource).not.toContain('STRICT_PATH_COMPLETION_IDS');
  });
});

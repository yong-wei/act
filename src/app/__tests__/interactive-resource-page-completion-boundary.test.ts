import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { selectResourceCompletionHandler } from '@/app/interactive-learning/resources/[id]/completion-boundary';

const resourcePageSource = readFileSync(
  path.join(process.cwd(), 'src/app/interactive-learning/resources/[id]/page.tsx'),
  'utf8',
);

describe('interactive resource completion boundary', () => {
  it('propagates completion write errors for the series precheck registry entry', async () => {
    const writeError = new Error('completion write failed');
    const strictCompletion = vi.fn().mockRejectedValue(writeError);
    const legacyCompletion = vi.fn().mockResolvedValue(undefined);
    const onComplete = selectResourceCompletionHandler(
      'lesson15-series-precheck',
      strictCompletion,
      legacyCompletion,
    );

    await expect(onComplete()).rejects.toBe(writeError);
    expect(strictCompletion).toHaveBeenCalledOnce();
    expect(legacyCompletion).not.toHaveBeenCalled();
  });

  it('uses the registry ID when the database resource ID differs', async () => {
    const strictCompletion = vi.fn().mockResolvedValue(undefined);
    const legacyCompletion = vi.fn().mockResolvedValue(undefined);
    const databaseResourceId = 'cm-resource-record-123';
    const registryId = 'lesson15-series-precheck';

    expect(databaseResourceId).not.toBe(registryId);
    const onComplete = selectResourceCompletionHandler(
      registryId,
      strictCompletion,
      legacyCompletion,
    );

    await expect(onComplete()).resolves.toBeUndefined();
    expect(strictCompletion).toHaveBeenCalledOnce();
    expect(legacyCompletion).not.toHaveBeenCalled();
  });

  it('keeps historical resources on the error-swallowing completion handler', async () => {
    const strictCompletion = vi.fn().mockRejectedValue(new Error('must not escape'));
    const legacyCompletion = vi.fn().mockResolvedValue(undefined);
    const onComplete = selectResourceCompletionHandler(
      'lesson14-root-locus-precheck',
      strictCompletion,
      legacyCompletion,
    );

    await expect(onComplete()).resolves.toBeUndefined();
    expect(legacyCompletion).toHaveBeenCalledOnce();
    expect(strictCompletion).not.toHaveBeenCalled();
  });

  it('propagates completion errors and continues the path for the cruise bridge registry entry', async () => {
    const writeError = new Error('completion write failed');
    const strictCompletion = vi.fn().mockResolvedValue(undefined);
    const legacyCompletion = vi.fn().mockResolvedValue(undefined);
    const continueCompletion = vi.fn().mockRejectedValue(writeError);
    const onComplete = selectResourceCompletionHandler(
      'lesson13-cruise-bridge',
      strictCompletion,
      legacyCompletion,
      continueCompletion,
    );

    await expect(onComplete()).rejects.toBe(writeError);
    expect(continueCompletion).toHaveBeenCalledOnce();
    expect(strictCompletion).not.toHaveBeenCalled();
    expect(legacyCompletion).not.toHaveBeenCalled();
  });

  it('writes path completion and navigates after a successful cruise-bridge continue', () => {
    expect(resourcePageSource).toContain('continuePathAfterResourceComplete');
    expect(resourcePageSource).toContain('resolveAdaptivePathCompletionContinueHref');
    expect(resourcePageSource).toContain('window.location.assign(continueHref)');
    expect(resourcePageSource).toContain("throw new Error('当前资源不能通过路径完成接口确认进度')");
  });
});

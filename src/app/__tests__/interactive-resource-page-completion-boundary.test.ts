import { describe, expect, it, vi } from 'vitest';

import { selectResourceCompletionHandler } from '@/app/interactive-learning/resources/[id]/completion-boundary';

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
});

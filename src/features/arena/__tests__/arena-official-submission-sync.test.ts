import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { submitAndSynchronizeArenaPath } from '../arena-official-submission-sync';

it('keeps the shared synchronization hook in a client module', () => {
  const source = readFileSync(join(
    process.cwd(),
    'src/features/arena/arena-official-submission-sync.ts',
  ), 'utf8');

  expect(source.startsWith("'use client';\n")).toBe(true);
});

describe.each([
  ['multi-representation Arena submit panel'],
  ['black-box identification preset'],
])('%s official submission synchronization', () => {
  it('retries path synchronization with the same official submission', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'submission-1' });
    const completeArenaPath = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const first = await submitAndSynchronizeArenaPath({
      submit,
      hasArenaPathContext: true,
      completeArenaPath,
    });
    const retried = await submitAndSynchronizeArenaPath({
      submission: first.submission,
      submit,
      hasArenaPathContext: true,
      completeArenaPath,
    });

    expect(first.pathSync).toBe('failed');
    expect(retried.pathSync).toBe('succeeded');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(completeArenaPath).toHaveBeenCalledTimes(2);
    expect(completeArenaPath).toHaveBeenNthCalledWith(1, 'submission-1');
    expect(completeArenaPath).toHaveBeenNthCalledWith(2, 'submission-1');
  });

  it('reports successful synchronization for a path submission', async () => {
    const outcome = await submitAndSynchronizeArenaPath({
      submit: vi.fn().mockResolvedValue({ id: 'submission-1' }),
      hasArenaPathContext: true,
      completeArenaPath: vi.fn().mockResolvedValue(true),
    });

    expect(outcome.pathSync).toBe('succeeded');
  });

  it('keeps non-path official submission behavior without requesting path completion', async () => {
    const completeArenaPath = vi.fn();
    const outcome = await submitAndSynchronizeArenaPath({
      submit: vi.fn().mockResolvedValue({ id: 'submission-1' }),
      hasArenaPathContext: false,
      completeArenaPath,
    });

    expect(outcome.pathSync).toBe('not-applicable');
    expect(completeArenaPath).not.toHaveBeenCalled();
  });
});

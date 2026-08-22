import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadAllStructuredTextbookBooks } from '@/lib/structured-textbook-runtime';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('structured textbook runtime', () => {
  it('returns an empty catalog when the optional runtime directory is unavailable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-structured-textbook-runtime-'));
    temporaryRoots.push(root);

    await expect(loadAllStructuredTextbookBooks(path.join(root, 'textbooks-v2'))).resolves.toEqual([]);
  });
});

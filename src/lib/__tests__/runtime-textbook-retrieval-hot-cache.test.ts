import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildRuntimeReleaseManifest } from '../runtime-release';
import {
  RuntimeTextbookHotCacheError,
  stageTextbookRetrievalHotCache,
} from '../runtime-textbook-retrieval-hot-cache';

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-hot-cache-'));
  roots.push(root);
  const index = path.join(root, 'runtime', 'resources', 'textbook-retrieval');
  await mkdir(index, { recursive: true });
  await Promise.all([
    writeFile(path.join(index, 'vectors.f32'), 'vectors'),
    writeFile(path.join(index, 'bodies.utf8'), 'bodies'),
    writeFile(path.join(index, 'lexical-postings.bin'), 'postings'),
    writeFile(path.join(index, 'not-cached.json'), 'not cached'),
  ]);
  const manifest = await buildRuntimeReleaseManifest(path.join(root, 'runtime'), {
    releaseId: 'runtime-hot-cache',
    sourceRevision: 'a'.repeat(40),
  });
  return { root, manifest, runtimeRoot: path.join(root, 'runtime'), cacheParent: path.join(root, 'cache') };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('digest-pinned textbook retrieval hot cache', () => {
  it('copies only the bounded hot index set and reuses only the exact manifest digest', async () => {
    const { manifest, runtimeRoot, cacheParent } = await fixture();
    const receipt = await stageTextbookRetrievalHotCache({ runtimeRoot, cacheParent, manifest });

    expect(receipt.manifestSha256).toBe(manifest.manifestSha256);
    expect(receipt.files).toHaveLength(3);
    await expect(readFile(path.join(receipt.cacheRoot, 'not-cached.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stageTextbookRetrievalHotCache({ runtimeRoot, cacheParent, manifest })).resolves.toMatchObject({
      manifestSha256: manifest.manifestSha256,
    });
  });

  it('rejects a mounted index object that no longer matches its release manifest', async () => {
    const { manifest, runtimeRoot, cacheParent } = await fixture();
    await writeFile(path.join(runtimeRoot, 'resources', 'textbook-retrieval', 'vectors.f32'), 'changed');

    await expect(stageTextbookRetrievalHotCache({ runtimeRoot, cacheParent, manifest }))
      .rejects.toMatchObject({ code: 'runtime-hot-cache-source-mismatch' } satisfies Partial<RuntimeTextbookHotCacheError>);
  });
});

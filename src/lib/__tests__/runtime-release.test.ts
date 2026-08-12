import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  buildRuntimeReleaseManifest,
  deriveRuntimeReleaseId,
  parseRuntimeReleaseManifest,
  runtimeReleaseManifestObjectKey,
  RuntimeReleaseValidationError,
  serializeRuntimeReleaseManifest,
  verifyRuntimeReleaseDirectory,
} from '../runtime-release';

const roots: string[] = [];
const revision = 'a'.repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'lesson.json'), '{"lesson":"1-1"}\n');
  await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
  await writeFile(path.join(root, '.DS_Store'), 'ignored');
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('act runtime release manifest', () => {
  it('is deterministic and binds each runtime object to its immutable release prefix', async () => {
    const root = await fixture();
    const [first, second] = await Promise.all([
      buildRuntimeReleaseManifest(root, { releaseId: 'runtime-20260811-a', sourceRevision: revision }),
      buildRuntimeReleaseManifest(root, { releaseId: 'runtime-20260811-a', sourceRevision: revision }),
    ]);

    expect(serializeRuntimeReleaseManifest(first)).toBe(serializeRuntimeReleaseManifest(second));
    expect(first.fileCount).toBe(2);
    expect(first.files.map((file) => file.path)).toEqual([
      'lessons/1-1/lesson.json',
      'lessons/1-1/media/intro.mp4',
    ]);
    expect(first.files[1].objectKey).toBe('runtime/releases/runtime-20260811-a/lessons/1-1/media/intro.mp4');
    expect(runtimeReleaseManifestObjectKey(first.releaseId)).toBe(`runtime/releases/runtime-20260811-a/${ACT_RUNTIME_RELEASE_MANIFEST_FILENAME}`);
    expect(deriveRuntimeReleaseId(first.sourceRevision, first.treeSha256)).toMatch(/^runtime-[a-f0-9]{55}$/);
  });

  it('rejects symlink source entries and invalid release ids', async () => {
    const root = await fixture();
    await symlink(path.join(root, 'lessons', '1-1', 'lesson.json'), path.join(root, 'lessons', '1-1', 'link.json'));
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'INVALID', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-id-invalid' } satisfies Partial<RuntimeReleaseValidationError>);
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-symlink-forbidden' } satisfies Partial<RuntimeReleaseValidationError>);
  });

  it('rejects control characters in normalized source paths', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'lessons', '1-1', 'bad\nname.json'), 'unsafe');
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-path-invalid' } satisfies Partial<RuntimeReleaseValidationError>);
  });

  it('rejects an empty runtime source and an empty manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-empty-'));
    roots.push(root);
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-empty' } satisfies Partial<RuntimeReleaseValidationError>);

    const populatedRoot = await fixture();
    const manifest = await buildRuntimeReleaseManifest(populatedRoot, { releaseId: 'valid-release', sourceRevision: revision });
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [], fileCount: 0, totalBytes: 0 }))
      .toThrow(/must not be empty/);
  });

  it('fails closed when a manifest path, digest, or source bytes diverge', async () => {
    const root = await fixture();
    const manifest = await buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision });
    await expect(verifyRuntimeReleaseDirectory(root, manifest)).resolves.toMatchObject({ treeSha256: manifest.treeSha256 });
    await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([4, 5, 6]));
    await expect(verifyRuntimeReleaseDirectory(root, manifest)).rejects.toMatchObject({ code: 'runtime-release-directory-mismatch' } satisfies Partial<RuntimeReleaseValidationError>);
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [{ ...manifest.files[0], path: '../escape' }] }))
      .toThrow(/Invalid runtime release path/);
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [{ ...manifest.files[0], path: 'nested\\escape' }] }))
      .toThrow(/Invalid runtime release path/);
  });
});
